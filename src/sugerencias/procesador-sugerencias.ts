import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { COLA_SUGERENCIAS, type TrabajoDeSugerencia } from './cola-sugerencias';
import { SugerenciasService } from './sugerencias.service';

/**
 * CU-17. Worker de la cola `sugerencias`. Un fallo del proveedor no llega
 * aquí (el servicio corta la corrida y termina bien); solo un error de base
 * hace fallar el job, y con un solo intento queda registrado en la cola.
 */
@Processor(COLA_SUGERENCIAS)
export class ProcesadorSugerencias extends WorkerHost {
  constructor(private readonly sugerencias: SugerenciasService) {
    super();
  }

  async process(job: Job<TrabajoDeSugerencia>): Promise<void> {
    await this.sugerencias.sugerirParaEmpresa(job.data.companyId);
  }
}
