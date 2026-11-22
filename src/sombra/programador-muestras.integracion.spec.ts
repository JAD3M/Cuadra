import { getQueueToken } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import type { DataSource } from 'typeorm';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import {
  COLA_MUESTRAS,
  ColaMuestras,
  type TrabajoDeMuestra,
} from './cola-muestras';
import { ProcesadorMuestras } from './procesador-muestras';
import {
  mesAnterior,
  NOMBRE_DEL_PROGRAMADOR,
  ProgramadorMuestras,
} from './programador-muestras';

/**
 * Historia 9.3 (A7): quién dispara la generación cada mes. Un programador
 * repetible de BullMQ encola a todas las empresas activas el día 1 para el
 * mes anterior.
 */

describe('mesAnterior', () => {
  it('devuelve el mes calendario anterior en UTC', () => {
    expect(mesAnterior(new Date('2026-11-01T05:00:00Z'))).toBe('2026-10');
    expect(mesAnterior(new Date('2026-11-30T23:59:59Z'))).toBe('2026-10');
  });

  it('cruza el año en enero', () => {
    expect(mesAnterior(new Date('2027-01-01T05:00:00Z'))).toBe('2026-12');
  });

  it('usa UTC aunque la hora local ya sea otro mes', () => {
    expect(mesAnterior(new Date('2026-12-01T00:30:00Z'))).toBe('2026-11');
  });
});

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let programador: ProgramadorMuestras;
let cola: Queue<TrabajoDeMuestra>;
let A: string;
let B: string;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  programador = entorno.app.get(ProgramadorMuestras);
  cola = entorno.app.get<Queue<TrabajoDeMuestra>>(getQueueToken(COLA_MUESTRAS));
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
}, 60_000);

afterAll(async () => {
  await ds?.query(`UPDATE companies SET activa = true`);
  await entorno?.cerrar();
});

describe('ProgramadorMuestras', () => {
  it('registra un solo programador repetible, el día 1 de cada mes en UTC', async () => {
    await programador.registrar();
    await programador.registrar(); // idempotente: no duplica

    const programadores = await cola.getJobSchedulers();
    const suyo = programadores.filter((p) => p.key === NOMBRE_DEL_PROGRAMADOR);
    expect(suyo).toHaveLength(1);
    expect(suyo[0].pattern).toBe('0 5 1 * *');
    expect(suyo[0].tz).toBe('UTC');
  });

  it('encola la muestra del mes anterior de cada empresa activa', async () => {
    const encoladas = await programador.programar(
      new Date('2026-11-01T05:00:00Z'),
    );

    expect(encoladas.sort()).toEqual([A, B].sort());
  });

  it('no encola empresas inactivas', async () => {
    await ds.query(`UPDATE companies SET activa = false WHERE id = $1`, [B]);
    try {
      const encoladas = await programador.programar(
        new Date('2026-11-01T05:00:00Z'),
      );
      expect(encoladas).toContain(A);
      expect(encoladas).not.toContain(B);
    } finally {
      await ds.query(`UPDATE companies SET activa = true WHERE id = $1`, [B]);
    }
  });

  it('el procesador convierte el trabajo repetible en un trabajo por empresa', async () => {
    const procesador = entorno.app.get(ProcesadorMuestras);
    // Mes propio (los ids son por empresa y mes) y cola en pausa: el worker en
    // línea no consume lo encolado antes de leerlo ni choca con pruebas previas.
    await cola.pause();
    try {
      await cola.drain(true);

      await procesador.process({
        name: NOMBRE_DEL_PROGRAMADOR,
        data: {},
        processedOn: new Date('2026-12-01T05:00:00Z').getTime(),
      } as Job<TrabajoDeMuestra>);

      for (const empresa of [A, B]) {
        const trabajo = await cola.getJob(
          ColaMuestras.idDelTrabajo(empresa, '2026-11'),
        );
        expect(trabajo?.data).toEqual({ companyId: empresa, mes: '2026-11' });
      }
    } finally {
      await cola.drain(true);
      await cola.resume();
    }
  });
});
