import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Bitacora } from '../bitacora/bitacora.entity';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { tomarCandadoDeConciliacion } from '../conciliacion/candado';
import { ContextoEmpresa } from '../database/contexto-empresa';
import { ColaSugerencias } from '../sugerencias/cola-sugerencias';
import type {
  AceptacionDto,
  RechazoDto,
  VistaPreviaDto,
} from './dto/vista-previa.dto';

/** Quién y desde dónde, para la bitácora. */
export interface Actor {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

interface FilaCargaEnEspera {
  nombre_archivo: string;
  banco: string | null;
  total_registros: number;
  saldo_inicial: string | null;
  saldo_final: string | null;
}

interface FilaMovimiento {
  fecha: string;
  monto: string;
  referencia: string | null;
}

interface FilaCargaBloqueada {
  estado: string;
  nombre_archivo: string;
  total_registros: number;
}

/**
 * Historia 3.4 (FR-3, parte): la vista previa de un PDF que cuadró y espera
 * en `movimientos_pendientes`. Aquí viven leerla (T2), aceptarla (T3) y
 * rechazarla (T4). Todo corre en la transacción de la petición, con RLS; el
 * filtro por empresa va igual en cada consulta (CLAUDE.md).
 */
@Injectable()
export class VistaPreviaService {
  private readonly logger = new Logger(VistaPreviaService.name);

  constructor(
    private readonly contexto: ContextoEmpresa,
    private readonly conciliacion: ConciliacionService,
    private readonly sugerencias: ColaSugerencias,
  ) {}

  /**
   * Solo lectura. 404 si la carga no existe, es de otra empresa o no está en
   * 'pendiente_vista_previa': para quien pregunta, no hay vista previa. Los
   * montos salen como texto de NUMERIC, nunca por flotante.
   */
  async consultar(companyId: string, cargaId: string): Promise<VistaPreviaDto> {
    const manager = this.contexto.manager();
    const [carga] = await manager.query<FilaCargaEnEspera[]>(
      `SELECT nombre_archivo, banco, total_registros,
              saldo_inicial::text AS saldo_inicial,
              saldo_final::text AS saldo_final
         FROM cargas
        WHERE id = $1 AND company_id = $2
          AND estado = 'pendiente_vista_previa'`,
      [cargaId, companyId],
    );
    if (!carga) throw new NotFoundException();
    const movimientos = await manager.query<FilaMovimiento[]>(
      `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, monto::text AS monto,
              referencia
         FROM movimientos_pendientes
        WHERE carga_id = $1 AND company_id = $2
        ORDER BY linea_numero`,
      [cargaId, companyId],
    );
    return {
      cargaId,
      archivo: carga.nombre_archivo,
      banco: carga.banco,
      total: movimientos.length,
      saldoInicial: carga.saldo_inicial,
      saldoFinal: carga.saldo_final,
      movimientos,
    };
  }

  /**
   * T3. Pasa los movimientos en espera a `movimientos` en una sola
   * transacción (la de la petición): candado de empresa (AD-19), carga
   * bloqueada, INSERT … SELECT, espera vaciada, carga 'procesada' con
   * contadores que cuadran (`ck_cargas_total_cuadra`) y bitácora. Si algo
   * lanza, todo se revierte: nada queda a medias. La conciliación y las
   * sugerencias arrancan después del COMMIT y nunca hacen fallar la respuesta.
   *
   * 404 si la carga no existe o es de otra empresa; 409 si no está en
   * 'pendiente_vista_previa' (también la segunda aceptación: el candado
   * serializa, así que la perdedora ya la ve procesada).
   */
  async aceptar(
    companyId: string,
    cargaId: string,
    actor: Actor,
  ): Promise<AceptacionDto> {
    const manager = this.contexto.manager();
    // Primero el candado, antes de cualquier fila: el mismo orden que usan
    // `conciliar()` y la resolución, para que no haya deadlock.
    await tomarCandadoDeConciliacion(manager, companyId);
    const carga = await this.bloquearEnEspera(manager, companyId, cargaId);

    const [{ n }] = await manager.query<[{ n: number }]>(
      `WITH movidos AS (
         INSERT INTO movimientos
           (company_id, carga_id, linea_numero, fecha, descripcion,
            referencia, monto, moneda, banco, cuenta)
         SELECT company_id, carga_id, linea_numero, fecha, descripcion,
                referencia, monto, moneda, banco, cuenta
           FROM movimientos_pendientes
          WHERE carga_id = $1 AND company_id = $2
          RETURNING 1)
       SELECT count(*)::int AS n FROM movidos`,
      [cargaId, companyId],
    );
    // La espera se fijó con el total al guardar el PDF: si no coincide,
    // algo está mal y es mejor revertir que importar a medias.
    if (n !== carga.total_registros) {
      throw new Error(
        `Carga ${cargaId}: en espera ${n} movimientos y el total es ${carga.total_registros}`,
      );
    }
    await manager.query(
      `DELETE FROM movimientos_pendientes
        WHERE carga_id = $1 AND company_id = $2`,
      [cargaId, companyId],
    );
    await manager.query(
      `UPDATE cargas
          SET estado = 'procesada', registros_ok = $3,
              procesada_at = now(), updated_at = now()
        WHERE id = $1 AND company_id = $2`,
      [cargaId, companyId, n],
    );
    await manager.insert(Bitacora, {
      companyId,
      userId: actor.userId,
      entidad: 'cargas',
      entidadId: cargaId,
      accion: 'confirmar',
      datos: {
        cargaId,
        archivo: carga.nombre_archivo,
        estado: 'procesada',
        movimientos: n,
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    this.contexto.alConfirmar(() => this.arrancarConciliacion(companyId));
    return { cargaId, estado: 'procesada', movimientos: n };
  }

  /**
   * T4. Descarta la vista previa: la espera se borra y la carga queda
   * 'rechazada'. Nada entra a `movimientos` ni a conciliación, así que no
   * toma el candado de empresa; el `FOR UPDATE` de la carga la serializa con
   * una aceptación simultánea (la perdedora ve otro estado y recibe 409).
   * 404 si no existe o es ajena; 409 si no está en espera.
   */
  async rechazar(
    companyId: string,
    cargaId: string,
    actor: Actor,
  ): Promise<RechazoDto> {
    const manager = this.contexto.manager();
    const carga = await this.bloquearEnEspera(manager, companyId, cargaId);
    const [{ n }] = await manager.query<[{ n: number }]>(
      `WITH borradas AS (
         DELETE FROM movimientos_pendientes
          WHERE carga_id = $1 AND company_id = $2
          RETURNING 1)
       SELECT count(*)::int AS n FROM borradas`,
      [cargaId, companyId],
    );
    await manager.query(
      `UPDATE cargas SET estado = 'rechazada', updated_at = now()
        WHERE id = $1 AND company_id = $2`,
      [cargaId, companyId],
    );
    await manager.insert(Bitacora, {
      companyId,
      userId: actor.userId,
      entidad: 'cargas',
      entidadId: cargaId,
      accion: 'rechazar',
      datos: {
        cargaId,
        archivo: carga.nombre_archivo,
        estado: 'rechazada',
        movimientosDescartados: n,
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });
    return { cargaId, estado: 'rechazada' };
  }

  /**
   * La carga con `FOR UPDATE`, que debe estar en espera. Con el candado de
   * empresa ya tomado, dos peticiones sobre la misma carga se turnan.
   */
  private async bloquearEnEspera(
    manager: EntityManager,
    companyId: string,
    cargaId: string,
  ): Promise<FilaCargaBloqueada> {
    const [carga] = await manager.query<FilaCargaBloqueada[]>(
      `SELECT estado, nombre_archivo, total_registros FROM cargas
        WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [cargaId, companyId],
    );
    if (!carga) throw new NotFoundException();
    if (carga.estado !== 'pendiente_vista_previa') {
      throw new ConflictException(
        'La carga ya no está en vista previa: ya se aceptó o se rechazó.',
      );
    }
    return carga;
  }

  /** Igual que el worker de cargas: solo loguea, la carga ya terminó. */
  private async arrancarConciliacion(companyId: string): Promise<void> {
    try {
      await this.conciliacion.conciliar(companyId);
    } catch (error) {
      this.logger.error(
        `Empresa ${companyId}: la conciliación automática falló tras aceptar una vista previa`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    if (!this.sugerencias.activa) return;
    try {
      await this.sugerencias.encolar(companyId);
    } catch (error) {
      this.logger.error(
        `Empresa ${companyId}: no se pudo encolar la sugerencia por IA tras aceptar una vista previa`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
