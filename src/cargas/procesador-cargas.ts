import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { EstadoCarga } from '../common/entities/tipos';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import { procesarEstadoDeCuenta } from '../bancos/guardar-movimientos';
import type { PerfilBancario } from '../bancos/perfil';
import {
  PERFIL_POR_DEFECTO,
  PerfilesBancarios,
} from '../bancos/perfiles-bancarios';
import type { TipoCarga } from '../common/entities/tipos';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { ColaSugerencias } from '../sugerencias/cola-sugerencias';
import { COLA_CARGAS, type TrabajoDeCarga } from './cola-cargas';
import { procesarLoteCfdi } from './guardar-cfdi';

interface CargaTomada {
  tipo: TipoCarga;
  banco: string | null;
  cuenta: string | null;
  perfil: string | null;
}

/** Lo que ve la persona. El error real va al log, no a la base ni al cliente. */
export const MENSAJE_FALLIDA =
  'No se pudo procesar la carga por un problema del sistema. Vuelve a intentarlo más tarde.';

/**
 * Worker de CU-08; despacha por `cargas.tipo` (CFDI o estado de cuenta,
 * CU-09). No pasa por el interceptor de CU-04b: abre sus propias
 * transacciones como `cuadra_app` con la empresa del job fijada, así que RLS
 * aplica igual que en una petición.
 *
 * Errores por archivo (XML inválido, UUID ya existente) no son fallos del
 * job. Cualquier otra excepción sí: la transacción de proceso se revierte
 * completa y BullMQ reintenta con backoff exponencial desde cero. Al agotar
 * los intentos, la carga queda 'fallida'.
 */
@Processor(COLA_CARGAS)
export class ProcesadorCargas extends WorkerHost {
  private readonly logger = new Logger(ProcesadorCargas.name);

  constructor(
    private readonly transaccion: TransaccionEmpresa,
    private readonly perfiles: PerfilesBancarios,
    private readonly conciliacion: ConciliacionService,
    private readonly sugerencias: ColaSugerencias,
  ) {
    super();
  }

  /**
   * Si alguien borró el JSON del perfil después de la carga, lanza: es
   * configuración, no culpa del archivo. Tras los reintentos, 'fallida', y
   * resubir la reanuda cuando el perfil vuelva.
   */
  private perfilDe({ perfil }: CargaTomada): PerfilBancario {
    const id = perfil ?? PERFIL_POR_DEFECTO;
    const encontrado = this.perfiles.obtener(id);
    if (!encontrado) throw new Error(`No existe el perfil de banco "${id}"`);
    return encontrado;
  }

  async process(job: Job<TrabajoDeCarga>): Promise<void> {
    try {
      await this.procesar(job.data);
    } catch (error) {
      // attemptsMade cuenta los intentos que ya fallaron, sin este.
      const ultimo = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      this.logger.error(
        `Carga ${job.data.cargaId}: intento ${job.attemptsMade + 1} de ${job.opts.attempts ?? 1} falló`,
        error instanceof Error ? error.stack : String(error),
      );
      if (ultimo) await this.marcarFallida(job.data);
      throw error;
    }
    // Fuera del try: un fallo del motor nunca llega a marcarFallida ni hace
    // que BullMQ reintente una carga que ya terminó. También corre cuando el
    // job encuentra la carga ya procesada (recuperación tras un crash entre
    // el commit y la conciliación).
    await this.conciliarSinFallar(job.data.companyId);
    await this.encolarSugerenciasSinFallar(job.data.companyId);
  }

  /** CU-11. Solo loguea: la carga conserva el estado con que terminó. */
  private async conciliarSinFallar(companyId: string): Promise<void> {
    try {
      await this.conciliacion.conciliar(companyId);
    } catch (error) {
      this.logger.error(
        `Empresa ${companyId}: la conciliación automática falló`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * CU-17. Después de que el motor decidió, lo ambiguo que quedó en revisión
   * va a la cola de sugerencias. Su propio try/catch: Redis caído o la cola
   * rota nunca fallan ni alteran una carga ya conciliada. Apagada, ni se toca.
   */
  private async encolarSugerenciasSinFallar(companyId: string): Promise<void> {
    if (!this.sugerencias.activa) return;
    try {
      await this.sugerencias.encolar(companyId);
    } catch (error) {
      this.logger.error(
        `Empresa ${companyId}: no se pudo encolar la sugerencia por IA`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async procesar({ cargaId, companyId }: TrabajoDeCarga): Promise<void> {
    // (a) Transacción corta para que el GET vea 'procesando' mientras dura
    // (b). En un reintento ya está en 'procesando', y sigue.
    const [tomadas] = await this.transaccion.ejecutar(companyId, (manager) =>
      manager.query<[CargaTomada[], number]>(
        `UPDATE cargas SET estado = 'procesando', updated_at = now()
          WHERE id = $1 AND company_id = $2
            AND estado IN ('pendiente', 'procesando')
          RETURNING tipo, banco, cuenta, perfil`,
        [cargaId, companyId],
      ),
    );
    const carga = tomadas[0];
    if (!carga) {
      // Ya terminó (job duplicado) o no es de esta empresa: RLS no la deja
      // ver. En ambos casos no hay nada que hacer.
      this.logger.warn(`Carga ${cargaId}: nada que procesar`);
      return;
    }

    // (b) Todo o nada. Si algo lanza, rollback completo: ni registros ni
    // contadores quedan a medias, y el reintento empieza limpio.
    await this.transaccion.ejecutar(companyId, async (manager) => {
      const { resultados, nuevos, existentes, errores } =
        carga.tipo === 'cfdi'
          ? await procesarLoteCfdi(manager, companyId, cargaId)
          : await procesarEstadoDeCuenta(manager, companyId, cargaId, {
              ...carga,
              perfil: this.perfilDe(carga),
            });
      // 'fallida' es solo de infraestructura: aunque todo lo que venía sea
      // inválido, la carga terminó.
      const estado: EstadoCarga = errores > 0 ? 'con_errores' : 'procesada';

      await manager.query(
        `UPDATE cargas
            SET estado = $1, registros_ok = $2, registros_existentes = $3,
                registros_error = $4, resultados = $5::jsonb,
                procesada_at = now(), updated_at = now()
          WHERE id = $6 AND company_id = $7 AND estado = 'procesando'`,
        [
          estado,
          nuevos,
          existentes,
          errores,
          JSON.stringify(resultados),
          cargaId,
          companyId,
        ],
      );
    });
  }

  private async marcarFallida({
    cargaId,
    companyId,
  }: TrabajoDeCarga): Promise<void> {
    try {
      await this.transaccion.ejecutar(companyId, (manager) =>
        manager.query(
          `UPDATE cargas
              SET estado = 'fallida', error_mensaje = $1,
                  procesada_at = now(), updated_at = now()
            WHERE id = $2 AND company_id = $3
              AND estado IN ('pendiente', 'procesando')`,
          [MENSAJE_FALLIDA, cargaId, companyId],
        ),
      );
    } catch (error) {
      // Si la base sigue caída, la carga se queda en 'procesando'. Ver el
      // pendiente de CU-08 en la bitácora.
      this.logger.error(
        `Carga ${cargaId}: no se pudo marcar como fallida`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
