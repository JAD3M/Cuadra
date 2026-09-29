import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Bitacora } from '../bitacora/bitacora.entity';
import { tomarCandadoDeConciliacion } from '../conciliacion/candado';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import type { ContextoDeCambio } from '../companies/tolerancia.service';
import { ContextoEmpresa } from '../database/contexto-empresa';
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
  ) {}

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
