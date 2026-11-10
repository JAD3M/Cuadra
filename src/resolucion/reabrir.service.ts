import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { rolesConPermiso } from '../auth/permisos/matriz';
import { AccesosDenegados } from '../bitacora/accesos-denegados';
import { tomarCandadoDeConciliacion } from '../conciliacion/candado';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { Rol } from '../common/entities/tipos';
import type { ReabrirRespuestaDto } from './dto/reabrir.dto';
import type { ContextoDeConfirmacion } from './resolucion.service';

const UNIQUE_VIOLATION = '23505';

interface DecisionConfirmada {
  id: string;
  estado: string;
  movimientoId: string;
  confirmadaPorId: string | null;
  requiereRevision: boolean;
  cfdiIds: string[];
}

/**
 * Historia 5.7 (AD-4, AD-7, AD-19). confirmada -> reabierta: la decisión, sus
 * facturas, el movimiento y la bitácora cambian en una sola sentencia bajo el
 * candado de empresa y en el orden fijo decisión, CFDI, movimiento. Dos
 * personas a la vez: la segunda espera el candado, ve la decisión ya reabierta
 * y recibe 409. Las propuestas hermanas que la confirmación dejó `obsoleta` no
 * se restauran: el motor regenera lo que corresponda con `conciliar()`.
 */
@Injectable()
export class ReabrirService {
  private readonly logger = new Logger(ReabrirService.name);

  constructor(
    private readonly contexto: ContextoEmpresa,
    private readonly conciliacion: ConciliacionService,
    private readonly accesosDenegados: AccesosDenegados,
  ) {}

  async reabrir(
    companyId: string,
    id: string,
    motivo: string,
    quien: ContextoDeConfirmacion,
  ): Promise<ReabrirRespuestaDto> {
    const manager = this.contexto.manager();
    await tomarCandadoDeConciliacion(manager, companyId);
    const decisiones = await manager.query<DecisionConfirmada[]>(
      `SELECT d.id, d.estado, d.movimiento_id AS "movimientoId",
              d.confirmada_por_id AS "confirmadaPorId",
              d.requiere_revision AS "requiereRevision",
              COALESCE((SELECT array_agg(l.cfdi_id::text ORDER BY l.cfdi_id)
                          FROM decision_lineas l
                         WHERE l.decision_id = d.id AND l.company_id = $1),
                       '{}'::text[]) AS "cfdiIds"
         FROM decisiones d
        WHERE d.id = $2 AND d.company_id = $1 AND d.tipo = 'conciliacion'
          FOR UPDATE OF d`,
      [companyId, id],
    );
    if (decisiones.length === 0) {
      throw new NotFoundException('Conciliación no encontrada');
    }
    const decision = decisiones[0];

    // El 403 va antes del 409: quien no puede reabrir no averigua el estado.
    const roles = await manager.query<{ rol: Rol }[]>(
      `SELECT rol FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
      [quien.userId, companyId],
    );
    const esAdmin = roles.some((fila) => fila.rol === 'admin');
    if (!esAdmin && decision.confirmadaPorId !== quien.userId) {
      await this.accesosDenegados.registrar({
        companyId,
        userId: quien.userId,
        metodo: quien.metodo,
        ruta: quien.ruta,
        rolesRequeridos: [...rolesConPermiso('conciliaciones.reabrir')],
        rolesDelUsuario: roles.map((fila) => fila.rol),
        ip: quien.ip,
        userAgent: quien.userAgent,
      });
      throw new ForbiddenException(
        'Solo quien confirmó la conciliación o un administrador puede reabrirla',
      );
    }
    if (decision.estado !== 'confirmada') {
      throw new ConflictException(
        `La conciliación está '${decision.estado}': solo se reabre una confirmada`,
      );
    }

    // Orden AD-19: decisión (ya bloqueada), CFDI y luego movimiento.
    const cfdis = await manager.query<{ id: string; estado: string }[]>(
      `SELECT id, estado FROM cfdi
        WHERE id = ANY($1::uuid[]) AND company_id = $2
        ORDER BY id FOR UPDATE`,
      [decision.cfdiIds, companyId],
    );
    await manager.query(
      `SELECT 1 FROM movimientos WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [decision.movimientoId, companyId],
    );
    // Un CFDI cancelado (confirmación en «Requiere revisión») se queda
    // cancelado: solo vuelven a abiertas las que estaban conciliadas.
    const porReabrir = cfdis
      .filter((cfdi) => cfdi.estado === 'conciliada')
      .map((cfdi) => cfdi.id);

    let filas: { auditoria: number; cfdis: number; movimientos: number }[];
    try {
      filas = await manager.query(
        `WITH reabierta AS (
           UPDATE decisiones
              SET estado = 'reabierta', requiere_revision = false, updated_at = now()
            WHERE id = $2 AND company_id = $1 AND estado = 'confirmada'
           RETURNING id
         ),
         cfdis AS (
           UPDATE cfdi SET estado = 'abierta', updated_at = now()
            WHERE company_id = $1 AND id = ANY($5::uuid[]) AND estado = 'conciliada'
              AND EXISTS (SELECT 1 FROM reabierta)
           RETURNING id
         ),
         movs AS (
           UPDATE movimientos SET estado = 'abierto', updated_at = now()
            WHERE company_id = $1 AND id = $3 AND estado = 'conciliado'
              AND EXISTS (SELECT 1 FROM reabierta)
           RETURNING id
         ),
         auditoria AS (
           INSERT INTO bitacora
                  (company_id, user_id, entidad, entidad_id, accion, datos, ip, user_agent)
           SELECT $1::uuid, $4::uuid, 'decisiones', r.id, 'reabrir',
                  jsonb_build_object(
                    'antes', jsonb_build_object('estado', 'confirmada',
                                                'requiereRevision', $6::boolean),
                    'despues', jsonb_build_object('estado', 'reabierta'),
                    'motivo', $7::text,
                    'confirmadaPorId', $8::uuid,
                    'cfdiIds', to_jsonb($9::uuid[]),
                    'movimiento', jsonb_build_object('id', $3::uuid,
                                                     'antes', 'conciliado',
                                                     'despues', 'abierto')),
                  $10::inet, $11
             FROM reabierta r
           RETURNING id
         )
         SELECT (SELECT count(*) FROM auditoria)::int AS auditoria,
                (SELECT count(*) FROM cfdis)::int AS cfdis,
                (SELECT count(*) FROM movs)::int AS movimientos
           FROM reabierta`,
        [
          companyId,
          id,
          decision.movimientoId,
          quien.userId,
          porReabrir,
          decision.requiereRevision,
          motivo,
          decision.confirmadaPorId,
          decision.cfdiIds,
          quien.ip ?? null,
          quien.userAgent ?? null,
        ],
      );
    } catch (error) {
      throw this.traducir(error);
    }
    if (
      filas.length !== 1 ||
      filas[0].auditoria !== 1 ||
      filas[0].movimientos !== 1 ||
      filas[0].cfdis !== porReabrir.length
    ) {
      throw new ConflictException(
        'La conciliación cambió mientras se reabría: no se aplicó nada',
      );
    }

    // El movimiento y las facturas vuelven a estar abiertos: el motor puede proponer.
    this.contexto.alConfirmar(async () => {
      try {
        await this.conciliacion.conciliar(companyId);
      } catch (error) {
        this.logger.error(
          `Empresa ${companyId}: conciliar falló tras reabrir ${id}; la reapertura ya quedó confirmada`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    });

    return {
      id,
      estado: 'reabierta',
      movimientoId: decision.movimientoId,
      cfdiIds: decision.cfdiIds,
      motivo,
    };
  }

  private traducir(error: unknown): unknown {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      return new ConflictException('La conciliación choca con otra vigente');
    }
    return error;
  }
}
