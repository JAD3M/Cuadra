import { Injectable, NotFoundException } from '@nestjs/common';
import { rolesConPermiso } from '../auth/permisos/matriz';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { EstadoMovimiento, Rol } from '../common/entities/tipos';
import type { EstadoBandeja } from '../bandeja/dto/bandeja.dto';
import { nivelDeConfianza } from '../conciliacion/evaluar-par';
import type { CfdiResumenDto } from '../bandeja/dto/bandeja.dto';
import type { PropuestaCasoDto, RespuestaCasoDto } from './dto/caso.dto';
import type { ComentarioDto } from '../resolucion/dto/comentar.dto';

/**
 * Una sola sentencia: movimiento, tolerancia de la empresa, propuestas
 * vigentes (o la confirmada), CFDI y quien confirmó salen de la misma
 * instantánea. Con dos sentencias, una confirmación concurrente podría dar
 * un movimiento abierto con una confirmada, o abierto sin propuestas.
 *
 * El CASE no tiene ELSE: un descartado no casa con ningún estado y no se
 * inventa propuesta. Las rechazadas tampoco casan nunca. `users` no tiene
 * company_id: el nombre se alcanza solo desde una conciliación filtrada por
 * empresa (mismo patrón que BitacoraService.historial).
 * Orden de propuestas: el mismo de la bandeja para su mejor propuesta.
 *
 * Una propuesta de grupo (4.5) tiene varias líneas: se agregan en `lc.cfdis`
 * (por id ascendente) para que salga UNA fila por decisión, no una por factura.
 */
const CONSULTA = `
  SELECT m.id AS movimiento_id, to_char(m.fecha,'YYYY-MM-DD') AS fecha,
         m.monto::text AS monto, m.moneda, m.descripcion, m.referencia,
         m.estado AS estado_movimiento, m.regla_sin_match, m.motivo_sin_match,
         co.tolerancia_monto::text AS tolerancia_monto,
         c.id AS conciliacion_id, c.estado AS estado_conciliacion, c.origen,
         c.score::text AS score, c.regla, c.motivo,
         c.diferencia_monto::text AS diferencia_monto,
         c.confirmada_at, u.nombre AS confirmada_por,
         c.confirmada_por_id, c.requiere_revision,
         lc.cfdis,
         d.motivo AS descarte_motivo, ud.nombre AS descarte_por,
         d.descartada_por_id AS descarte_por_id, d.descartada_at AS descarte_at
    FROM movimientos m
    JOIN companies co ON co.id = m.company_id AND co.id = $2
    LEFT JOIN decisiones c
           ON c.company_id = $2 AND c.movimiento_id = m.id
          AND c.tipo = 'conciliacion'
          AND c.estado = CASE m.estado WHEN 'conciliado' THEN 'confirmada'
                                       WHEN 'abierto'    THEN 'propuesta' END
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
               'id', f.id, 'uuidFiscal', f.uuid_fiscal, 'serie', f.serie,
               'folio', f.folio, 'nombreEmisor', f.nombre_emisor,
               'rfcReceptor', f.rfc_receptor,
               'nombreReceptor', f.nombre_receptor,
               'fechaEmision', to_char(f.fecha_emision,'YYYY-MM-DD'),
               'total', f.total::text, 'moneda', f.moneda,
               'metodoPago', f.metodo_pago, 'estado', f.estado) ORDER BY f.id) AS cfdis
        FROM decision_lineas l
        JOIN cfdi f ON f.company_id = $2 AND f.id = l.cfdi_id
       WHERE l.company_id = $2 AND l.decision_id = c.id
    ) lc ON true
    LEFT JOIN users u ON u.id = c.confirmada_por_id
    LEFT JOIN decisiones d
           ON d.company_id = $2 AND d.movimiento_id = m.id
          AND d.tipo = 'descarte' AND d.estado = 'descartada'
    LEFT JOIN users ud ON ud.id = d.descartada_por_id
   WHERE m.id = $1 AND m.company_id = $2
     AND m.estado <> 'pendiente_revision' -- estacionado (3.5): no es un caso
   ORDER BY c.score DESC NULLS LAST, c.id`;

interface FilaSql {
  movimiento_id: string;
  fecha: string;
  monto: string;
  moneda: string;
  descripcion: string;
  referencia: string | null;
  estado_movimiento: EstadoMovimiento;
  regla_sin_match: string | null;
  motivo_sin_match: string | null;
  tolerancia_monto: string;
  conciliacion_id: string | null;
  estado_conciliacion: 'propuesta' | 'confirmada' | null;
  origen: PropuestaCasoDto['origen'] | null;
  score: string | null;
  regla: string | null;
  motivo: string | null;
  diferencia_monto: string | null;
  confirmada_at: Date | null;
  confirmada_por: string | null;
  confirmada_por_id: string | null;
  requiere_revision: boolean | null;
  cfdis: CfdiResumenDto[] | null;
  descarte_motivo: string | null;
  descarte_por: string | null;
  descarte_por_id: string | null;
  descarte_at: Date | null;
}

/**
 * CU-23. Detalle de un caso: solo lectura. Lee con el manager de la
 * transacción de la petición (RLS como cuadra_app) y además filtra por
 * empresa en cada tabla. Nunca escribe ni vuelve a correr el motor. Los
 * montos viajan como texto desde SQL: sin Number ni Decimal.
 */
@Injectable()
export class CasosService {
  constructor(private readonly contexto: ContextoEmpresa) {}

  async obtener(
    companyId: string,
    movimientoId: string,
    userId: string,
  ): Promise<RespuestaCasoDto> {
    const filas = await this.contexto
      .manager()
      .query<FilaSql[]>(CONSULTA, [movimientoId, companyId]);
    if (filas.length === 0) {
      // Inexistente y ajeno son indistinguibles: RLS y el filtro lo ocultan.
      throw new NotFoundException('Movimiento no encontrado');
    }
    const m = filas[0];
    const propuestas = filas
      .filter((f) => f.conciliacion_id !== null)
      .map(aPropuesta);
    const estado: EstadoBandeja =
      m.estado_movimiento === 'conciliado'
        ? 'conciliado'
        : propuestas.length > 0
          ? 'sugerencia'
          : 'sin_match';
    const esSinMatch = estado === 'sin_match';
    // Un descartado guarda su regla, pero no es un "sin match" del motor.
    const conRegistro = esSinMatch && m.estado_movimiento !== 'descartado';
    const descarte =
      m.estado_movimiento === 'descartado' && m.descarte_motivo !== null
        ? {
            motivo: m.descarte_motivo,
            por: m.descarte_por,
            fecha: m.descarte_at ? new Date(m.descarte_at).toISOString() : null,
            puedeDeshacer: await this.puedeActuar(
              companyId,
              userId,
              m.descarte_por_id,
              'movimientos.deshacer_descarte',
            ),
          }
        : null;
    // Historia 5.7: solo una confirmación vigente se reabre.
    const confirmada = filas.find(
      (f) => f.estado_conciliacion === 'confirmada',
    );
    const puedeReabrir =
      m.estado_movimiento === 'conciliado' && confirmada !== undefined
        ? await this.puedeActuar(
            companyId,
            userId,
            confirmada.confirmada_por_id,
            'conciliaciones.reabrir',
          )
        : false;
    const comentarios = await this.comentarios(companyId, movimientoId);
    const puedeComentar =
      propuestas.length > 0 &&
      (await this.tienePermiso(companyId, userId, 'conciliaciones.comentar'));
    return {
      movimiento: {
        id: m.movimiento_id,
        fecha: m.fecha,
        monto: m.monto,
        moneda: m.moneda,
        descripcion: m.descripcion,
        referencia: m.referencia,
        estado: m.estado_movimiento,
      },
      estado,
      requiereRevision: propuestas.some((p) => p.requiereRevision),
      sinMatch: esSinMatch
        ? {
            regla: conRegistro ? m.regla_sin_match : null,
            motivo: conRegistro ? m.motivo_sin_match : null,
          }
        : null,
      descarte,
      puedeReabrir,
      comentarios,
      puedeComentar,
      toleranciaMonto: m.tolerancia_monto,
      propuestas,
    };
  }
  /** Historia 5.9: los comentarios de todas las decisiones del movimiento. */
  private async comentarios(
    companyId: string,
    movimientoId: string,
  ): Promise<ComentarioDto[]> {
    const filas = await this.contexto.manager().query<
      {
        id: string;
        decisionId: string;
        texto: string;
        por: string;
        fecha: Date;
      }[]
    >(
      `SELECT c.id, c.decision_id AS "decisionId", c.texto, u.nombre AS por,
              c.created_at AS fecha
         FROM decision_comentarios c
         JOIN decisiones d ON d.id = c.decision_id AND d.company_id = c.company_id
         JOIN users u ON u.id = c.autor_id
        WHERE c.company_id = $1 AND d.movimiento_id = $2
        ORDER BY c.created_at, c.id`,
      [companyId, movimientoId],
    );
    return filas.map((f) => ({
      id: f.id,
      decisionId: f.decisionId,
      texto: f.texto,
      por: f.por,
      fecha: new Date(f.fecha).toISOString(),
    }));
  }

  private async tienePermiso(
    companyId: string,
    userId: string,
    permiso: 'conciliaciones.comentar',
  ): Promise<boolean> {
    const roles = await this.contexto
      .manager()
      .query<{ rol: Rol }[]>(
        `SELECT rol FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
        [userId, companyId],
      );
    const conPermiso = rolesConPermiso(permiso);
    return roles.some((fila) => conPermiso.includes(fila.rol));
  }

  /**
   * Lo mismo que exigen `DescarteService.deshacer` y `ReabrirService`: un rol
   * con el permiso y, además, ser admin o quien hizo la acción original
   * (descartó o confirmó). El servidor decide; la interfaz solo lo muestra.
   */
  private async puedeActuar(
    companyId: string,
    userId: string,
    autorId: string | null,
    permiso: 'movimientos.deshacer_descarte' | 'conciliaciones.reabrir',
  ): Promise<boolean> {
    const roles = await this.contexto
      .manager()
      .query<{ rol: Rol }[]>(
        `SELECT rol FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
        [userId, companyId],
      );
    const conPermiso = rolesConPermiso(permiso);
    const lista = roles.map((fila) => fila.rol);
    if (!lista.some((rol) => conPermiso.includes(rol))) return false;
    return lista.includes('admin') || autorId === userId;
  }
}

function aPropuesta(f: FilaSql): PropuestaCasoDto {
  const cfdis = f.cfdis ?? [];
  return {
    conciliacionId: f.conciliacion_id as string,
    estado: f.estado_conciliacion as 'propuesta' | 'confirmada',
    origen: f.origen as PropuestaCasoDto['origen'],
    score: f.score,
    regla: f.regla,
    // Solo el motor de reglas tiene nivel; el LLM y lo manual quedan en null.
    confianza: f.origen === 'regla' ? nivelDeConfianza(f.score) : null,
    motivo: f.motivo,
    diferenciaMonto: f.diferencia_monto,
    confirmadaAt: f.confirmada_at ? f.confirmada_at.toISOString() : null,
    confirmadaPor: f.confirmada_por ? { nombre: f.confirmada_por } : null,
    requiereRevision: f.requiere_revision === true,
    // La primera factura (id ascendente) para clientes de una sola factura.
    cfdi: cfdis[0],
    cfdis,
  };
}
