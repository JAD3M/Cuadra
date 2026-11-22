import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { COLA_MUESTRAS, type TrabajoDeMuestra } from './cola-muestras';
import { MuestrasService } from './muestras.service';
import {
  NOMBRE_DEL_PROGRAMADOR,
  ProgramadorMuestras,
} from './programador-muestras';

/**
 * Historia 9.3. Worker de la cola `muestras`. Un error de base hace fallar el
 * job; al reencolarlo, el servicio devuelve la muestra ya guardada o sortea
 * una sola vez bajo el candado de empresa. El trabajo repetible del día 1
 * (`programar-muestras`) solo encola a las empresas; no sortea.
 */
@Processor(COLA_MUESTRAS)
export class ProcesadorMuestras extends WorkerHost {
  constructor(
    private readonly muestras: MuestrasService,
    private readonly programador: ProgramadorMuestras,
  ) {
    super();
  }

  async process(job: Job<TrabajoDeMuestra>): Promise<void> {
    if (job.name === NOMBRE_DEL_PROGRAMADOR) {
      await this.programador.programar(new Date(job.processedOn ?? Date.now()));
      return;
    }
    await this.muestras.generar(job.data.companyId, job.data.mes);
  }
}
