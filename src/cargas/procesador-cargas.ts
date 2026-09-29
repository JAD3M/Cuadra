import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { EstadoCarga } from '../common/entities/tipos';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import type { ResultadoDeArchivo } from './carga.entity';
import { COLA_CARGAS, type TrabajoDeCarga } from './cola-cargas';
import { type ArchivoEnEspera, guardarCfdi } from './guardar-cfdi';

/** Lo que ve la persona. El error real va al log, no a la base ni al cliente. */
export const MENSAJE_FALLIDA =
  'No se pudo procesar la carga por un problema del sistema. Vuelve a intentarlo más tarde.';

/**
 * Worker de CU-08. No pasa por el interceptor de CU-04b: abre sus propias
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

  constructor(private readonly transaccion: TransaccionEmpresa) {
    super();
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
  }

  async procesar({ cargaId, companyId }: TrabajoDeCarga): Promise<void> {
    // (a) Transacción corta para que el GET vea 'procesando' mientras dura
    // (b). En un reintento ya está en 'procesando', y sigue.
    const tomada = await this.transaccion.ejecutar(companyId, (manager) =>
      manager.query<[unknown[], number]>(
        `UPDATE cargas SET estado = 'procesando', updated_at = now()
          WHERE id = $1 AND company_id = $2
            AND estado IN ('pendiente', 'procesando')
          RETURNING id`,
        [cargaId, companyId],
      ),
    );
    if (tomada[0].length === 0) {
      // Ya terminó (job duplicado) o no es de esta empresa: RLS no la deja
      // ver. En ambos casos no hay nada que hacer.
      this.logger.warn(`Carga ${cargaId}: nada que procesar`);
      return;
    }

    // (b) Todo o nada. Si algo lanza, rollback completo: ni CFDI ni
    // contadores quedan a medias, y el reintento empieza limpio.
    await this.transaccion.ejecutar(companyId, async (manager) => {
      const archivos = await manager.query<ArchivoEnEspera[]>(
        `SELECT nombre, contenido FROM carga_archivos
          WHERE carga_id = $1 AND company_id = $2
          ORDER BY orden`,
        [cargaId, companyId],
      );
      const resultados: ResultadoDeArchivo[] = [];
      for (const archivo of archivos) {
        resultados.push(
          await guardarCfdi(manager, companyId, cargaId, archivo),
        );
      }

      const cuenta = (r: ResultadoDeArchivo['resultado']) =>
        resultados.filter((x) => x.resultado === r).length;
      const errores = cuenta('error');
      // 'fallida' es solo de infraestructura: aunque todos los XML sean
      // inválidos, la carga terminó.
      const estado: EstadoCarga = errores > 0 ? 'con_errores' : 'procesada';

      await manager.query(
        `UPDATE cargas
            SET estado = $1, registros_ok = $2, registros_existentes = $3,
                registros_error = $4, resultados = $5::jsonb,
                procesada_at = now(), updated_at = now()
          WHERE id = $6 AND company_id = $7 AND estado = 'procesando'`,
        [
          estado,
          cuenta('nuevo'),
          cuenta('ya_existia'),
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
