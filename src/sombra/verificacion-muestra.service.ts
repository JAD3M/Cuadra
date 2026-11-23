import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { rolesConPermiso } from '../auth/permisos/matriz';
import { AccesosDenegados } from '../bitacora/accesos-denegados';
import { tomarCandadoDeConciliacion } from '../conciliacion/candado';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { ContextoDeConfirmacion } from '../resolucion/resolucion.service';
import type { Rol } from '../common/entities/tipos';
import type {
  CasoMuestraDto,
  CfdiMuestraDto,
  MarcaGuardadaDto,
  MarcaMuestra,
  MuestraDto,
  ResultadoMuestra,
} from './dto/muestra.dto';

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

interface FilaCaso {
  decisionId: string;
  movimientoId: string;
  estado: string;
  regla: string | null;
  confirmadaPorId: string | null;
  confirmadaPor: string | null;
  confirmadaAt: Date | null;
  fecha: string;
  descripcion: string;
  referencia: string | null;
  monto: string;
  moneda: string;
  banco: string | null;
  cfdis: CfdiMuestraDto[] | null;
  marca: ResultadoMuestra | null;
  marcadaPor: string | null;
  marcadaAt: Date | null;
}

const CASOS = `
  SELECT d.id AS "decisionId", d.movimiento_id AS "movimientoId", d.estado, d.regla,
         d.confirmada_por_id AS "confirmadaPorId", uc.nombre AS "confirmadaPor",
         d.confirmada_at AS "confirmadaAt",
         to_char(m.fecha, 'YYYY-MM-DD') AS fecha, m.descripcion, m.referencia,
         m.monto::text AS monto, m.moneda, m.banco,
         lc.cfdis,
         ult.resultado AS marca, uv.nombre AS "marcadaPor", ult.created_at AS "marcadaAt"
    FROM muestras_verificacion s
    JOIN decisiones d ON d.id = s.decision_id AND d.company_id = $1
    JOIN movimientos m ON m.id = d.movimiento_id AND m.company_id = $1
    LEFT JOIN users uc ON uc.id = d.confirmada_por_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
               'id', f.id, 'uuidFiscal', f.uuid_fiscal, 'serie', f.serie,
               'folio', f.folio, 'nombreEmisor', f.nombre_emisor,
               'nombreReceptor', f.nombre_receptor,
               'total', f.total::text, 'moneda', f.moneda) ORDER BY f.id) AS cfdis
        FROM decision_lineas l
        JOIN cfdi f ON f.company_id = $1 AND f.id = l.cfdi_id
       WHERE l.company_id = $1 AND l.decision_id = d.id
    ) lc ON true
    LEFT JOIN LATERAL (
      SELECT x.resultado, x.verificador_id, x.created_at
        FROM muestras_verificacion x
       WHERE x.company_id = $1 AND x.decision_id = s.decision_id
         AND x.mes = s.mes AND x.resultado IS NOT NULL
       ORDER BY x.created_at DESC, x.id DESC
       LIMIT 1
    ) ult ON true
    LEFT JOIN users uv ON uv.id = ult.verificador_id
   WHERE s.company_id = $1 AND s.mes = $2::date AND s.resultado IS NULL
   ORDER BY m.fecha, d.id`;

/**
 * Historia 9.4 (FR-63, AD-7, AD-10, AD-11). Verificar la muestra del mes caso
 * por caso. La tabla es de solo agregar: cada marca es una fila nueva y el
 * estado de un caso es su última marca. Nada se reabre desde aquí (la 5.7).
 *
 * Quién marca lo decide el servidor (`muestra.verificar` solo da el rol):
 * - la verifica una persona con rol `revisor`; si la empresa no tiene ninguna,
 *   el `admin`;
 * - quien confirmó el lote no la verifica si hay otra persona elegible.
 */
@Injectable()
export class VerificacionMuestraService {
  constructor(
    private readonly contexto: ContextoEmpresa,
    private readonly accesosDenegados: AccesosDenegados,
  ) {}

  async leer(
    companyId: string,
    userId: string,
    mesPedido?: string,
  ): Promise<MuestraDto> {
    if (mesPedido !== undefined && !MES.test(mesPedido)) {
      throw new BadRequestException('El mes debe ser AAAA-MM');
    }
    const manager = this.contexto.manager();
    const meses = (
      await manager.query<{ mes: string }[]>(
        `SELECT DISTINCT to_char(mes, 'YYYY-MM') AS mes
           FROM muestras_verificacion WHERE company_id = $1 ORDER BY mes DESC`,
        [companyId],
      )
    ).map((f) => f.mes);
    const mes = mesPedido ?? meses[0] ?? null;
    if (mes === null) {
      return {
        mes,
        meses,
        avance: { total: 0, conformes: 0, desacuerdos: 0, pendientes: 0 },
        casos: [],
      };
    }

    const filas = await manager.query<FilaCaso[]>(CASOS, [
      companyId,
      `${mes}-01`,
    ]);
    const elegibles = await this.elegibles(manager, companyId);
    const casos = filas.map((f) => aCaso(f, puedeMarcar(userId, elegibles, f)));
    return {
      mes,
      meses,
      avance: {
        total: casos.length,
        conformes: casos.filter((c) => c.marca === 'conforme').length,
        desacuerdos: casos.filter((c) => c.marca === 'desacuerdo').length,
        pendientes: casos.filter((c) => c.marca === 'pendiente').length,
      },
      casos,
    };
  }

  async verificar(
    companyId: string,
    decisionId: string,
    resultado: ResultadoMuestra,
    quien: ContextoDeConfirmacion,
  ): Promise<MarcaGuardadaDto> {
    const manager = this.contexto.manager();
    // Misma serialización que reabrir: no se marca un caso que otra petición
    // está reabriendo, ni dos marcas se cruzan.
    await tomarCandadoDeConciliacion(manager, companyId);
    const casos = await manager.query<
      { estado: string; confirmadaPorId: string | null; mes: string }[]
    >(
      `SELECT d.estado, d.confirmada_por_id AS "confirmadaPorId",
              to_char(s.mes, 'YYYY-MM') AS mes
         FROM muestras_verificacion s
         JOIN decisiones d ON d.id = s.decision_id AND d.company_id = $1
        WHERE s.company_id = $1 AND s.decision_id = $2 AND s.resultado IS NULL
        ORDER BY s.mes DESC
        LIMIT 1
          FOR UPDATE OF d`,
      [companyId, decisionId],
    );
    if (casos.length === 0) {
      throw new NotFoundException('Caso de la muestra no encontrado');
    }
    const caso = casos[0];

    // El 403 va antes del 409: quien no puede marcar no averigua el estado.
    const elegibles = await this.elegibles(manager, companyId);
    if (
      !puedeMarcar(quien.userId, elegibles, {
        confirmadaPorId: caso.confirmadaPorId,
        estado: 'confirmada',
      })
    ) {
      await this.accesosDenegados.registrar({
        companyId,
        userId: quien.userId,
        metodo: quien.metodo,
        ruta: quien.ruta,
        rolesRequeridos: [...rolesConPermiso('muestra.verificar')],
        permiso: 'muestra.verificar',
        rolesDelUsuario: await this.rolesDe(manager, companyId, quien.userId),
        ip: quien.ip,
        userAgent: quien.userAgent,
      });
      throw new ForbiddenException(
        'La muestra la verifica una persona con rol revisor (o el administrador si no hay ninguna), y no quien confirmó el lote',
      );
    }
    if (caso.estado !== 'confirmada') {
      throw new ConflictException(
        `La conciliación está '${caso.estado}': solo se verifica una confirmada`,
      );
    }

    const filas = await manager.query<
      { id: string; resultado: ResultadoMuestra; fecha: Date; por: string }[]
    >(
      `WITH nueva AS (
         INSERT INTO muestras_verificacion
                (company_id, mes, decision_id, verificador_id, resultado)
         VALUES ($1, $2::date, $3, $4, $5)
         RETURNING id, resultado, created_at
       ),
       auditoria AS (
         INSERT INTO bitacora
                (company_id, user_id, entidad, entidad_id, accion, datos, ip, user_agent)
         SELECT $1::uuid, $4::uuid, 'decisiones', $3::uuid, 'verificar_muestra',
                jsonb_build_object('marcaId', n.id, 'mes', $6::text,
                                   'resultado', n.resultado),
                $7::inet, $8
           FROM nueva n
         RETURNING id
       )
       SELECT n.id, n.resultado, n.created_at AS fecha, u.nombre AS por
         FROM nueva n
         JOIN users u ON u.id = $4
        WHERE (SELECT count(*) FROM auditoria) = 1`,
      [
        companyId,
        `${caso.mes}-01`,
        decisionId,
        quien.userId,
        resultado,
        caso.mes,
        quien.ip ?? null,
        quien.userAgent ?? null,
      ],
    );
    if (filas.length !== 1) {
      throw new ConflictException('No se pudo guardar la marca');
    }
    return {
      decisionId,
      marca: filas[0].resultado,
      marcadaPor: filas[0].por,
      marcadaAt: new Date(filas[0].fecha).toISOString(),
    };
  }

  /**
   * Las personas que pueden verificar: los revisores activos de la empresa y,
   * solo si no hay ninguno, los administradores activos.
   */
  private async elegibles(
    manager: EntityManager,
    companyId: string,
  ): Promise<ReadonlySet<string>> {
    const filas = await manager.query<{ userId: string; rol: Rol }[]>(
      `SELECT r.user_id AS "userId", r.rol
         FROM user_company_roles r
         JOIN users u ON u.id = r.user_id AND u.activo
        WHERE r.company_id = $1 AND r.rol IN ('revisor', 'admin')`,
      [companyId],
    );
    const revisores = filas.filter((f) => f.rol === 'revisor');
    const elegidos = revisores.length > 0 ? revisores : filas;
    return new Set(elegidos.map((f) => f.userId));
  }

  private async rolesDe(
    manager: EntityManager,
    companyId: string,
    userId: string,
  ): Promise<Rol[]> {
    const filas = await manager.query<{ rol: Rol }[]>(
      `SELECT rol FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
      [userId, companyId],
    );
    return filas.map((f) => f.rol);
  }
}

/**
 * Una sola definición de «puede marcar», la misma para el botón y para el
 * POST: es elegible y, si confirmó el lote, solo cuando no hay otra persona
 * elegible; un caso reabierto no se marca.
 */
function puedeMarcar(
  userId: string,
  elegibles: ReadonlySet<string>,
  caso: { confirmadaPorId: string | null; estado: string },
): boolean {
  if (caso.estado !== 'confirmada') return false;
  if (!elegibles.has(userId)) return false;
  if (caso.confirmadaPorId !== userId) return true;
  return [...elegibles].some((id) => id !== userId) === false;
}

function aCaso(f: FilaCaso, puede: boolean): CasoMuestraDto {
  const marca: MarcaMuestra = f.marca ?? 'pendiente';
  return {
    decisionId: f.decisionId,
    movimientoId: f.movimientoId,
    fecha: f.fecha,
    descripcion: f.descripcion,
    referencia: f.referencia,
    monto: f.monto,
    moneda: f.moneda,
    banco: f.banco,
    regla: f.regla,
    cfdis: f.cfdis ?? [],
    confirmadaPor: f.confirmadaPor,
    confirmadaAt: f.confirmadaAt
      ? new Date(f.confirmadaAt).toISOString()
      : null,
    marca,
    marcadaPor: f.marcadaPor,
    marcadaAt: f.marcadaAt ? new Date(f.marcadaAt).toISOString() : null,
    reabierta: f.estado !== 'confirmada',
    puedeMarcar: puede,
  };
}
