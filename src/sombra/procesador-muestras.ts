import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { COLA_MUESTRAS, type TrabajoDeMuestra } from './cola-muestras';
import { MuestrasService } from './muestras.service';

/**
 * Historia 9.3. Worker de la cola `muestras`. Un error de base hace fallar el
 * job; al reencolarlo, el servicio devuelve la muestra ya guardada o sortea
 * una sola vez bajo el candado de empresa.
 */
@Processor(COLA_MUESTRAS)
export class ProcesadorMuestras extends WorkerHost {
  constructor(private readonly muestras: MuestrasService) {
    super();
  }

  async process(job: Job<TrabajoDeMuestra>): Promise<void> {
    await this.muestras.generar(job.data.companyId, job.data.mes);
  }
}
