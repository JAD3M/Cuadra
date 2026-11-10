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
import { huellaConjunto } from '../conciliacion/huella-conjunto';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { Rol } from '../common/entities/tipos';
import type { DescarteRespuestaDto } from './dto/descarte.dto';
import type { ContextoDeConfirmacion } from './resolucion.service';

const UNIQUE_VIOLATION = '23505';

/**
 * Historia 5.6 (AD-4, AD-7). Descartar un movimiento que no es de ningún
 * cliente y deshacer el descarte. Cada transición es una sola sentencia con
 * la decisión, el movimiento y la bitácora (patrón CTE) bajo el candado de
 * empresa; si alguna pieza no aplica, 409 y no queda nada a medias.
 */
@Injectable()
export class DescarteService {
  private readonly logger = new Logger(DescarteService.name);

  constructor(
    private readonly contexto: ContextoEmpresa,
    private readonly conciliacion: ConciliacionService,
    private readonly accesosDenegados: AccesosDenegados,
  ) {}

  /** (nada) -> descartada. Solo un movimiento 'abierto' sin decisión vigente. */
  async descartar(
    companyId: string,
    movimientoId: string,
    motivo: string,
    quien: ContextoDeConfirmacion,
  ): Promise<DescarteRespuestaDto> {
    const manager = this.contexto.manager();
    await tomarCandadoDeConciliacion(manager, companyId);
    const movimientos = await manager.query<{ estado: string }[]>(
      `SELECT estado FROM movimientos WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [movimientoId, companyId],
    );
    if (movimientos.length === 0) {
      throw new NotFoundException('Movimiento no encontrado');
    }
    if (movimientos[0].estado !== 'abierto') {
      throw new ConflictException(
        `El movimiento está '${movimientos[0].estado}': solo se descarta uno abierto`,
      );
    }

    let filas: { id: string; auditoria: number; movimientos: number }[];
    try {
      filas = await manager.query(
        `WITH nueva AS (
           INSERT INTO decisiones
                  (company_id, movimiento_id, tipo, estado, origen, huella_conjunto,
                   motivo, descartada_por_id, descartada_at)
           VALUES ($1, $2, 'descarte', 'descartada', 'manual', $3, $4, $5, now())
           RETURNING id, motivo
         ),
         movimiento AS (
           UPDATE movimientos SET estado = 'descartado', updated_at = now()
            WHERE id = $2 AND company_id = $1 AND estado = 'abierto'
           RETURNING id
         ),
         auditoria AS (
           INSERT INTO bitacora
                  (company_id, user_id, entidad, entidad_id, accion, datos, ip, user_agent)
           SELECT $1::uuid, $5::uuid, 'decisiones', n.id, 'descartar',
                  jsonb_build_object(
                    'antes', jsonb_build_object('estado', 'abierto'),
                    'despues', jsonb_build_object('estado', 'descartada',
                                                  'motivo', n.motivo),
                    'movimientoId', $2::uuid,
                    'motivo', n.motivo),
                  $6::inet, $7
             FROM nueva n
           RETURNING id
         )
         SELECT n.id,
                (SELECT count(*) FROM auditoria)::int AS auditoria,
                (SELECT count(*) FROM movimiento)::int AS movimientos
           FROM nueva n`,
        [
          companyId,
          movimientoId,
          huellaConjunto([]),
          motivo,
          quien.userId,
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
      filas[0].movimientos !== 1
    ) {
      throw new ConflictException(
        'El movimiento cambió mientras se descartaba: no se aplicó nada',
      );
    }
    return {
      id: filas[0].id,
      movimientoId,
      estado: 'descartada',
      motivo,
    };
  }

  /**
   * descartada -> reabierta. Lo deshace quien descartó o un admin; el guard
   * solo mira el rol (PERMISOS_PROPIOS), la autoría se verifica aquí.
   */
  async deshacer(
    companyId: string,
    movimientoId: string,
    quien: ContextoDeConfirmacion,
  ): Promise<DescarteRespuestaDto> {
    const manager = this.contexto.manager();
    await tomarCandadoDeConciliacion(manager, companyId);
    const movimientos = await manager.query<{ estado: string }[]>(
      `SELECT estado FROM movimientos WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [movimientoId, companyId],
    );
    if (movimientos.length === 0) {
      throw new NotFoundException('Movimiento no encontrado');
    }
    const decisiones = await manager.query<
      { id: string; motivo: string; descartadaPorId: string }[]
    >(
      `SELECT id, motivo, descartada_por_id AS "descartadaPorId"
         FROM decisiones
        WHERE company_id = $1 AND movimiento_id = $2
          AND tipo = 'descarte' AND estado = 'descartada'
        ORDER BY id FOR UPDATE`,
      [companyId, movimientoId],
    );
    if (decisiones.length === 0 || movimientos[0].estado !== 'descartado') {
      throw new ConflictException('El movimiento no está descartado');
    }
    const descarte = decisiones[0];

    const roles = await manager.query<{ rol: Rol }[]>(
      `SELECT rol FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
      [quien.userId, companyId],
    );
    const esAdmin = roles.some((fila) => fila.rol === 'admin');
    if (!esAdmin && descarte.descartadaPorId !== quien.userId) {
      await this.accesosDenegados.registrar({
        companyId,
        userId: quien.userId,
        metodo: quien.metodo,
        ruta: quien.ruta,
        rolesRequeridos: [...rolesConPermiso('movimientos.deshacer_descarte')],
        rolesDelUsuario: roles.map((fila) => fila.rol),
        ip: quien.ip,
        userAgent: quien.userAgent,
      });
      throw new ForbiddenException(
        'Solo quien descartó el movimiento o un administrador puede deshacer el descarte',
      );
    }

    let filas: { auditoria: number; movimientos: number }[];
    try {
      filas = await manager.query(
        `WITH reabierta AS (
           UPDATE decisiones SET estado = 'reabierta', updated_at = now()
            WHERE id = $2 AND company_id = $1 AND estado = 'descartada'
           RETURNING id, motivo
         ),
         movimiento AS (
           UPDATE movimientos SET estado = 'abierto', updated_at = now()
            WHERE id = $3 AND company_id = $1 AND estado = 'descartado'
           RETURNING id
         ),
         auditoria AS (
           INSERT INTO bitacora
                  (company_id, user_id, entidad, entidad_id, accion, datos, ip, user_agent)
           SELECT $1::uuid, $4::uuid, 'decisiones', r.id, 'deshacer_descarte',
                  jsonb_build_object(
                    'antes', jsonb_build_object('estado', 'descartada'),
                    'despues', jsonb_build_object('estado', 'reabierta'),
                    'movimientoId', $3::uuid,
                    'motivo', r.motivo,
                    'descartadaPorId', $5::uuid),
                  $6::inet, $7
             FROM reabierta r
           RETURNING id
         )
         SELECT (SELECT count(*) FROM auditoria)::int AS auditoria,
                (SELECT count(*) FROM movimiento)::int AS movimientos
           FROM reabierta`,
        [
          companyId,
          descarte.id,
          movimientoId,
          quien.userId,
          descarte.descartadaPorId,
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
      filas[0].movimientos !== 1
    ) {
      throw new ConflictException(
        'El descarte cambió mientras se deshacía: no se aplicó nada',
      );
    }

    // El movimiento vuelve a la bandeja: el motor puede proponerle de nuevo.
    this.contexto.alConfirmar(async () => {
      try {
        await this.conciliacion.conciliar(companyId);
      } catch (error) {
        this.logger.error(
          `Empresa ${companyId}: conciliar falló tras deshacer el descarte de ${movimientoId}; el descarte ya quedó deshecho`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    });

    return {
      id: descarte.id,
      movimientoId,
      estado: 'reabierta',
      motivo: descarte.motivo,
    };
  }

  private traducir(error: unknown): unknown {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      return new ConflictException(
        'El movimiento ya tiene una decisión vigente',
      );
    }
    return error;
  }
}
