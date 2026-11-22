import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import {
  COLA_MUESTRAS,
  ColaMuestras,
  type TrabajoDeMuestra,
} from './cola-muestras';

/** Nombre del trabajo y del programador repetible dentro de la cola. */
export const NOMBRE_DEL_PROGRAMADOR = 'programar-muestras';

/** Día 1 de cada mes, 05:00 UTC. */
const PATRON = '0 5 1 * *';

/** `AAAA-MM` del mes calendario anterior a `ahora`, en UTC. */
export function mesAnterior(ahora: Date): string {
  const anio = ahora.getUTCFullYear();
  const mes = ahora.getUTCMonth(); // 0 = enero
  const [a, m] = mes === 0 ? [anio - 1, 12] : [anio, mes];
  return `${a}-${String(m).padStart(2, '0')}`;
}

/**
 * Historia 9.3 (A7). Quién dispara la generación mensual: un programador
 * repetible de BullMQ que el día 1 encola, para el mes anterior, a cada
 * empresa activa. Cada encolado es idempotente por empresa y mes, así que
 * repetir la corrida no duplica ni re-sortea nada.
 */
@Injectable()
export class ProgramadorMuestras implements OnApplicationBootstrap {
  private readonly log = new Logger(ProgramadorMuestras.name);

  constructor(
    @InjectQueue(COLA_MUESTRAS) private readonly cola: Queue<TrabajoDeMuestra>,
    private readonly colaMuestras: ColaMuestras,
    private readonly ds: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.registrar();
    } catch (error) {
      // Sin Redis la app no debe caer al arrancar; el siguiente arranque lo reintenta.
      this.log.error(
        `No se pudo registrar el programador mensual de muestras: ${(error as Error).message}`,
      );
    }
  }

  /** Crea o actualiza el programador repetible; llamarlo dos veces deja uno solo. */
  async registrar(): Promise<void> {
    await this.cola.upsertJobScheduler(
      NOMBRE_DEL_PROGRAMADOR,
      { pattern: PATRON, tz: 'UTC' },
      { name: NOMBRE_DEL_PROGRAMADOR, data: {} as TrabajoDeMuestra },
    );
  }

  /**
   * Encola la muestra del mes anterior de cada empresa activa. Un fallo con
   * una empresa no frena a las demás; al final falla el trabajo si hubo alguno.
   * `companies` es la raíz del aislamiento (clase 2): no lleva `company_id`.
   */
  async programar(ahora: Date = new Date()): Promise<string[]> {
    const mes = mesAnterior(ahora);
    const empresas = await this.ds.query<{ id: string }[]>(
      `SELECT id FROM companies WHERE activa = true ORDER BY id`,
    );
    const encoladas: string[] = [];
    const fallidas: string[] = [];
    for (const { id } of empresas) {
      try {
        await this.colaMuestras.encolar(id, mes);
        encoladas.push(id);
      } catch (error) {
        fallidas.push(id);
        this.log.error(
          `No se pudo encolar la muestra ${mes} de la empresa ${id}: ${(error as Error).message}`,
        );
      }
    }
    if (fallidas.length > 0) {
      throw new Error(
        `Muestra ${mes}: no se encoló a ${fallidas.length} de ${empresas.length} empresas.`,
      );
    }
    return encoladas;
  }
}
