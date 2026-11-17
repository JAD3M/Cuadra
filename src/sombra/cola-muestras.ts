import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';

export const COLA_MUESTRAS = 'muestras';

/** Lo único que viaja en Redis: el worker lee todo lo demás de la base (AD-16). */
export interface TrabajoDeMuestra {
  companyId: string;
  /** `AAAA-MM`. */
  mes: string;
}

/**
 * Historia 9.3. Cola de la generación mensual de la muestra de verificación.
 * Idempotente por empresa y mes: el `jobId` lo lleva, así que encolar dos veces
 * lo mismo no duplica el trabajo. El separador es '-' porque BullMQ no admite
 * ':' en el id. Como en ColaCargas, un job terminado bloquearía el id, así que
 * se quita antes de reencolar; reencolarlo es seguro porque el servicio
 * devuelve la muestra guardada y no vuelve a sortear.
 */
@Injectable()
export class ColaMuestras {
  constructor(
    @InjectQueue(COLA_MUESTRAS) private readonly cola: Queue<TrabajoDeMuestra>,
  ) {}

  static idDelTrabajo(companyId: string, mes: string): string {
    return `muestra-${companyId}-${mes}`;
  }

  async encolar(companyId: string, mes: string): Promise<void> {
    const jobId = ColaMuestras.idDelTrabajo(companyId, mes);
    const previo = await this.cola.getJob(jobId);
    if (previo) {
      const estado = await previo.getState();
      if (estado === 'failed' || estado === 'completed') await previo.remove();
    }
    await this.cola.add('generar-muestra', { companyId, mes }, { jobId });
  }
}
