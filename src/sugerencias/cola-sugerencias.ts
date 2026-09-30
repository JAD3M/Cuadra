import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { ProveedorSugerencia } from './proveedor-sugerencia';

export const COLA_SUGERENCIAS = 'sugerencias';

/** Lo único que viaja en Redis: el worker lee todo lo demás de la base. */
export interface TrabajoDeSugerencia {
  companyId: string;
}

/**
 * CU-17. Cola aparte de la de cargas: una llamada lenta al modelo no debe
 * retener una carga ni su conciliación.
 */
@Injectable()
export class ColaSugerencias {
  constructor(
    @InjectQueue(COLA_SUGERENCIAS)
    private readonly cola: Queue<TrabajoDeSugerencia>,
    private readonly proveedor: ProveedorSugerencia,
  ) {}

  /** Apagada por configuración: no hay nada que encolar ni Redis que tocar. */
  get activa(): boolean {
    return this.proveedor.activo;
  }

  /**
   * `jobId` por empresa: mientras haya un job esperando o corriendo, otro
   * `add` se ignora (una carga que termina a media corrida espera al
   * siguiente disparo: latencia, no pérdida). El separador es '-' porque
   * BullMQ no admite ':' en el id. Como en ColaCargas, un job terminado
   * bloquearía el id, así que se quita antes de reencolar.
   */
  async encolar(companyId: string): Promise<void> {
    if (!this.activa) return;
    const jobId = `sugerencias-${companyId}`;
    const previo = await this.cola.getJob(jobId);
    if (previo) {
      const estado = await previo.getState();
      if (estado === 'failed' || estado === 'completed') await previo.remove();
    }
    await this.cola.add('sugerir', { companyId }, { jobId });
  }
}
