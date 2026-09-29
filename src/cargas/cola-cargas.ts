import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';

export const COLA_CARGAS = 'cargas-cfdi';

/** Lo único que viaja en Redis: los archivos esperan en `carga_archivos`. */
export interface TrabajoDeCarga {
  cargaId: string;
  companyId: string;
}

@Injectable()
export class ColaCargas {
  constructor(
    @InjectQueue(COLA_CARGAS) private readonly cola: Queue<TrabajoDeCarga>,
  ) {}

  /**
   * `jobId` = cargaId: mientras el job de una carga está en espera, en
   * backoff o corriendo, volver a encolarla no crea otro, así que nunca se
   * procesa dos veces en paralelo.
   *
   * Un job terminado sí bloquearía el jobId: BullMQ ignora el `add` si ya
   * existe uno con ese id, aunque esté en 'failed'. Los completados se
   * borran solos (`removeOnComplete`); los fallidos se guardan para
   * diagnosticar, así que se quitan aquí antes de reencolar.
   */
  async encolar(trabajo: TrabajoDeCarga): Promise<void> {
    const previo = await this.cola.getJob(trabajo.cargaId);
    if (previo) {
      const estado = await previo.getState();
      if (estado === 'failed' || estado === 'completed') await previo.remove();
    }
    await this.cola.add('procesar', trabajo, { jobId: trabajo.cargaId });
  }
}
