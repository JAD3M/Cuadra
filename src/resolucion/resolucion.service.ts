import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AccesosDenegados } from '../bitacora/accesos-denegados';
import { Bitacora } from '../bitacora/bitacora.entity';
import { tomarCandadoDeConciliacion } from '../conciliacion/candado';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import type { ContextoDeCambio } from '../companies/tolerancia.service';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { Rol } from '../common/entities/tipos';
import type { ResolucionRespuestaDto } from './dto/resolucion.dto';

interface ConciliacionBloqueada {
  id: string;
  estado: string;
  cfdiId: string;
  movimientoId: string;
  diferenciaMonto: string;
  regla: string | null;
  score: string | null;
  motivo: string | null;
}

const UNIQUE_VIOLATION = '23505';

/** Motivo de las hermanas que se cierran solas al confirmar otra. */
export const MOTIVO_HERMANA = 'cerrada al confirmar otra conciliación';

/** Quién y desde dónde; `metodo` y `ruta` alimentan el rastro del 403. */
export interface ContextoDeConfirmacion extends ContextoDeCambio {
  metodo: string;
  ruta: string;
}

interface LadoBloqueado {
  estado: string;
  cargaId: string | null;
}

const ROLES_DE_RESOLUCION: Rol[] = ['admin', 'contador', 'revisor'];

/**
 * CU-15. Resuelve una propuesta de conciliación. Todo corre en la
 * transacción de la petición (RLS como cuadra_app) y cada consulta filtra
 * `company_id` además. Orden de candados, igual que `conciliar()`: consultivo
 * de la empresa -> conciliación -> CFDI -> movimiento.
 *
 * El motor propone; aquí solo una persona cierra o descarta.
 */
@Injectable()
export class ResolucionService {
  private readonly logger = new Logger(ResolucionService.name);

  constructor(
    private readonly contexto: ContextoEmpresa,
    private readonly conciliacion: ConciliacionService,
    private readonly accesosDenegados: AccesosDenegados,
  ) {}

  /**
   * Confirma una propuesta: cierra el CFDI ('conciliada') y el movimiento
   * ('conciliado') y rechaza las hermanas que quedan sin sentido. Orden de
   * comprobaciones: 404 -> 409 -> 403 (D-08: quien subió cualquiera de las
   * dos cargas no puede confirmar). Nada aquí llama a `conciliar`: no se
   * libera nada.
   */
  async confirmar(
    companyId: string,
    id: string,
    quien: ContextoDeConfirmacion,
  ): Promise<ResolucionRespuestaDto> {
    const manager = this.contexto.manager();
    const propuesta = await this.cargarPropuesta(companyId, id);

    const [cfdi] = await manager.query<LadoBloqueado[]>(
      `SELECT estado, carga_id AS "cargaId" FROM cfdi
        WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [propuesta.cfdiId, companyId],
    );
    if (cfdi.estado !== 'abierta') {
      throw new ConflictException(
        `El CFDI está '${cfdi.estado}': solo se confirma contra uno abierto`,
      );
    }
    const [movimiento] = await manager.query<LadoBloqueado[]>(
      `SELECT estado, carga_id AS "cargaId" FROM movimientos
        WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [propuesta.movimientoId, companyId],
    );
    if (movimiento.estado !== 'abierto') {
      throw new ConflictException(
        `El movimiento está '${movimiento.estado}': solo se confirma contra uno abierto`,
      );
    }

    await this.exigirSegregacion(companyId, quien, cfdi, movimiento);

    let confirmadaAt: string;
    try {
      const [filas] = await manager.query<[{ confirmadaAt: string }[], number]>(
        `UPDATE conciliaciones
            SET estado = 'confirmada', confirmada_por_id = $3, confirmada_at = now(),
                updated_at = now()
          WHERE id = $1 AND company_id = $2 AND estado = 'propuesta'
          RETURNING confirmada_at AS "confirmadaAt"`,
        [id, companyId, quien.userId],
      );
      confirmadaAt = new Date(filas[0].confirmadaAt).toISOString();
      await manager.query(
        `UPDATE cfdi SET estado = 'conciliada', updated_at = now()
          WHERE id = $1 AND company_id = $2 AND estado = 'abierta'`,
        [propuesta.cfdiId, companyId],
      );
      // El motivo de "sin match" ya no aplica; los tres van juntos (CHECK).
      await manager.query(
        `UPDATE movimientos
            SET estado = 'conciliado', motivo_sin_match = NULL, regla_sin_match = NULL,
                evaluado_at = NULL, updated_at = now()
          WHERE id = $1 AND company_id = $2 AND estado = 'abierto'`,
        [propuesta.movimientoId, companyId],
      );
    } catch (error) {
      throw this.traducir(error);
    }

    const [hermanas] = await manager.query<
      [{ id: string; cfdiId: string; movimientoId: string }[], number]
    >(
      `UPDATE conciliaciones
          SET estado = 'rechazada', motivo = $5, updated_at = now()
        WHERE company_id = $1 AND id <> $2 AND estado = 'propuesta'
          AND (cfdi_id = $3 OR movimiento_id = $4)
        RETURNING id, cfdi_id AS "cfdiId", movimiento_id AS "movimientoId"`,
      [companyId, id, propuesta.cfdiId, propuesta.movimientoId, MOTIVO_HERMANA],
    );

    await manager.insert(Bitacora, {
      companyId,
      userId: quien.userId,
      entidad: 'conciliaciones',
      entidadId: id,
      accion: 'confirmar',
      datos: {
        antes: { estado: 'propuesta' },
        despues: {
          estado: 'confirmada',
          confirmadaPorId: quien.userId,
          confirmadaAt,
        },
        cfdi: {
          id: propuesta.cfdiId,
          antes: 'abierta',
          despues: 'conciliada',
        },
        movimiento: {
          id: propuesta.movimientoId,
          antes: 'abierto',
          despues: 'conciliado',
        },
        diferenciaMonto: propuesta.diferenciaMonto,
        regla: propuesta.regla ?? undefined,
        score: propuesta.score ?? undefined,
      },
      ip: quien.ip ?? null,
      userAgent: quien.userAgent ?? null,
    });
    if (hermanas.length > 0) {
      await manager.insert(
        Bitacora,
        hermanas.map((hermana) => ({
          companyId,
          userId: quien.userId,
          entidad: 'conciliaciones',
          entidadId: hermana.id,
          accion: 'rechazar' as const,
          datos: {
            antes: { estado: 'propuesta' },
            despues: { estado: 'rechazada', motivo: MOTIVO_HERMANA },
            cfdiId: hermana.cfdiId,
            movimientoId: hermana.movimientoId,
            causa: { conciliacionId: id },
          },
          ip: quien.ip ?? null,
          userAgent: quien.userAgent ?? null,
        })),
      );
    }

    return {
      id,
      estado: 'confirmada',
      cfdiId: propuesta.cfdiId,
      movimientoId: propuesta.movimientoId,
      motivo: propuesta.motivo,
      confirmadaAt,
      rechazadasAutomaticamente: hermanas.map((hermana) => hermana.id),
    };
  }

  /**
   * D-08: quien subió la carga del CFDI o la del movimiento no confirma su
   * propio trabajo. Sin carga (null) ese lado no restringe. El 403 revierte
   * la transacción de la petición, así que el rastro se escribe aparte.
   */
  private async exigirSegregacion(
    companyId: string,
    quien: ContextoDeConfirmacion,
    cfdi: LadoBloqueado,
    movimiento: LadoBloqueado,
  ): Promise<void> {
    const cargas = [cfdi.cargaId, movimiento.cargaId].filter(
      (carga): carga is string => carga !== null,
    );
    if (cargas.length === 0) return;
    const subio = await this.contexto.manager().query<unknown[]>(
      `SELECT 1 FROM cargas
        WHERE company_id = $1 AND id = ANY($2::uuid[]) AND subido_por_id = $3
        LIMIT 1`,
      [companyId, cargas, quien.userId],
    );
    if (subio.length === 0) return;

    const roles = await this.contexto
      .manager()
      .query<{ rol: Rol }[]>(
        `SELECT rol FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
        [quien.userId, companyId],
      );
    await this.accesosDenegados.registrar({
      companyId,
      userId: quien.userId,
      metodo: quien.metodo,
      ruta: quien.ruta,
      rolesRequeridos: ROLES_DE_RESOLUCION,
      rolesDelUsuario: roles.map((fila) => fila.rol),
      ip: quien.ip,
      userAgent: quien.userAgent,
    });
    throw new ForbiddenException(
      'Quien subió el CFDI o el estado de cuenta no puede confirmar esta conciliación',
    );
  }

  /**
   * Rechaza una propuesta. El movimiento sigue 'abierto' y el CFDI 'abierta'.
   * Un motivo omitido conserva el de la propuesta. Después del COMMIT, si el
   * rechazo liberó algún lado, corre `conciliar` una vez; si truena, se
   * registra y el rechazo sigue en pie.
   */
  async rechazar(
    companyId: string,
    id: string,
    motivo: string | undefined,
    quien: ContextoDeCambio,
  ): Promise<ResolucionRespuestaDto> {
    const manager = this.contexto.manager();
    const propuesta = await this.cargarPropuesta(companyId, id);

    // Mismo orden que confirmar (PR2): CFDI y luego movimiento.
    await manager.query(
      `SELECT 1 FROM cfdi WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [propuesta.cfdiId, companyId],
    );
    await manager.query(
      `SELECT 1 FROM movimientos WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [propuesta.movimientoId, companyId],
    );

    let motivoFinal: string | null;
    try {
      const [filas] = await manager.query<
        [{ motivo: string | null }[], number]
      >(
        `UPDATE conciliaciones
            SET estado = 'rechazada', motivo = COALESCE($3, motivo), updated_at = now()
          WHERE id = $1 AND company_id = $2 AND estado = 'propuesta'
          RETURNING motivo`,
        [id, companyId, motivo ?? null],
      );
      motivoFinal = filas[0].motivo;
    } catch (error) {
      throw this.traducir(error);
    }

    await manager.insert(Bitacora, {
      companyId,
      userId: quien.userId,
      entidad: 'conciliaciones',
      entidadId: id,
      accion: 'rechazar',
      datos: {
        antes: { estado: 'propuesta', motivo: propuesta.motivo },
        despues: { estado: 'rechazada', motivo: motivoFinal },
        cfdiId: propuesta.cfdiId,
        movimientoId: propuesta.movimientoId,
        diferenciaMonto: propuesta.diferenciaMonto,
      },
      ip: quien.ip ?? null,
      userAgent: quien.userAgent ?? null,
    });

    if (await this.liberoAlgunLado(companyId, id, propuesta)) {
      this.contexto.alConfirmar(async () => {
        try {
          await this.conciliacion.conciliar(companyId);
        } catch (error) {
          this.logger.error(
            `Empresa ${companyId}: conciliar falló tras rechazar ${id}; el rechazo ya quedó confirmado`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      });
    }

    return {
      id,
      estado: 'rechazada',
      cfdiId: propuesta.cfdiId,
      movimientoId: propuesta.movimientoId,
      motivo: motivoFinal,
      confirmadaAt: null,
      rechazadasAutomaticamente: [],
    };
  }

  /**
   * Candado de empresa, luego la conciliación FOR UPDATE. Inexistente y ajena
   * dan el mismo 404 (RLS y `company_id` la esconden igual). Solo una
   * 'propuesta' puede transicionar.
   */
  private async cargarPropuesta(
    companyId: string,
    id: string,
  ): Promise<ConciliacionBloqueada> {
    const manager = this.contexto.manager();
    await tomarCandadoDeConciliacion(manager, companyId);
    const filas = await manager.query<ConciliacionBloqueada[]>(
      `SELECT id, estado, cfdi_id AS "cfdiId", movimiento_id AS "movimientoId",
              diferencia_monto::text AS "diferenciaMonto", regla,
              score::text AS score, motivo
         FROM conciliaciones
        WHERE id = $1 AND company_id = $2
          FOR UPDATE`,
      [id, companyId],
    );
    if (filas.length === 0) {
      throw new NotFoundException('Conciliación no encontrada');
    }
    if (filas[0].estado !== 'propuesta') {
      throw new ConflictException(
        `La conciliación ya está '${filas[0].estado}': solo una propuesta se puede resolver`,
      );
    }
    return filas[0];
  }

  /** Libre = el movimiento o el CFDI quedaron sin otra propuesta viva. */
  private async liberoAlgunLado(
    companyId: string,
    id: string,
    par: ConciliacionBloqueada,
  ): Promise<boolean> {
    const [{ libre }] = await this.contexto
      .manager()
      .query<{ libre: boolean }[]>(
        `SELECT (
         NOT EXISTS (SELECT 1 FROM conciliaciones
                      WHERE company_id = $1 AND id <> $2 AND movimiento_id = $3
                        AND estado IN ('propuesta', 'confirmada'))
         OR NOT EXISTS (SELECT 1 FROM conciliaciones
                         WHERE company_id = $1 AND id <> $2 AND cfdi_id = $4
                           AND estado = 'propuesta')
       ) AS libre`,
        [companyId, id, par.movimientoId, par.cfdiId],
      );
    return libre;
  }

  /** Defensa en profundidad: bajo el candado no debería ocurrir. */
  private traducir(error: unknown): unknown {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      return new ConflictException(
        'La conciliación choca con otra ya confirmada',
      );
    }
    return error;
  }
}
