import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from '../testing/supertest-con-origen';
import type { Queue } from 'bullmq';
import type { DataSource } from 'typeorm';
import type { RespuestaDeCarga } from '../cargas/cargas.service';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  LUIS,
} from '../cargas/testing/app-de-cargas';
import { filas, una } from '../database/testing/base-de-pruebas';
import { COLA_SUGERENCIAS, ColaSugerencias } from './cola-sugerencias';
import { ProveedorFalso } from './proveedor-falso';
import { ErrorProveedorSugerencia } from './proveedor-sugerencia';

/**
 * CU-17 por la cola real (Redis del compose, worker en el mismo proceso) y
 * con un proveedor falso: nunca hay una llamada a la API. Una carga termina,
 * el motor deja lo ambiguo en revisión y el worker de sugerencias propone.
 */

jest.setTimeout(40_000);

const ESTADO_CUENTA = join(
  __dirname,
  '..',
  'bancos',
  'fixtures',
  'valido-5.csv',
);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let linea = 0;

async function ambiguo(): Promise<string> {
  const monto = '777.00';
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto)
     VALUES ($1,$2,'2026-09-10','SPEI RECIBIDO CLIENTE',$3) RETURNING id`,
    [A, 9000 + linea++, monto],
  );
  for (const folio of ['1001', '1002']) {
    await ds.query(
      `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, nombre_receptor, serie,
                         folio, fecha_emision, tipo_comprobante, moneda, subtotal, total, estado, xml_raw)
       VALUES ($1,$2,$3,'XAXX010101000','CLIENTE SA DE CV','A',$4,'2026-09-01T10:00:00','I','MXN',$5,$5,'abierta','{"_xml":"<x/>"}'::jsonb)`,
      [A, randomUUID(), FERRETERIA, folio, monto],
    );
  }
  return id;
}

async function subirEstadoDeCuenta(): Promise<RespuestaDeCarga> {
  const token = await entorno.token(LUIS, FERRETERIA);
  const res = await request(entorno.app.getHttpServer())
    .post('/cargas/estado-cuenta')
    .set('Cookie', token)
    .field('banco', 'BANCO SINTETICO')
    .field('cuenta', '****1234')
    .attach('archivo', readFileSync(ESTADO_CUENTA), 'valido-5.csv')
    .expect(202);
  const id = (res.body as RespuestaDeCarga).id;
  return entorno.esperarFin(token, id) as unknown as RespuestaDeCarga;
}

async function esperarHasta(condicion: () => Promise<boolean> | boolean) {
  const limite = Date.now() + 20_000;
  while (!(await condicion())) {
    if (Date.now() > limite) throw new Error('Condición no cumplida a tiempo');
    await new Promise((r) => setTimeout(r, 50));
  }
}

const llm = () =>
  filas<{
    estado: string;
    origen: string;
    regla: string;
    score: string | null;
  }>(
    ds,
    `SELECT estado, origen, regla, score::text AS score
       FROM conciliaciones WHERE origen = 'llm'`,
  );
const ledger = () =>
  filas<{ resultado: string }>(ds, 'SELECT resultado FROM sugerencias_ia');

const limpiar = () =>
  ds.query(
    'TRUNCATE cfdi, cargas, movimientos, conciliaciones, bitacora, sugerencias_ia CASCADE',
  );

describe('cola de sugerencias con proveedor activo', () => {
  const proveedor = new ProveedorFalso({
    decision: 'sugerir',
    candidato: 'C1',
    confianza: 'alta',
    explicacion: 'Mismo monto',
  });
  let cola: Queue;

  beforeAll(async () => {
    entorno = await levantarAppDeCargas({ proveedorSugerencia: proveedor });
    ({ ds } = entorno);
    A = entorno.empresa(FERRETERIA);
    cola = entorno.app.get<Queue>(getQueueToken(COLA_SUGERENCIAS));
  }, 60_000);
  afterAll(async () => {
    await entorno?.cerrar();
  });
  beforeEach(async () => {
    await limpiar();
    proveedor.recibidas.length = 0;
  });
  afterEach(() => jest.restoreAllMocks());

  it('una carga procesada encola la empresa y el worker crea la propuesta llm', async () => {
    const m = await ambiguo();
    const encolar = jest.spyOn(entorno.app.get(ColaSugerencias), 'encolar');

    expect((await subirEstadoDeCuenta()).estado).toBe('procesada');
    await esperarHasta(async () => (await llm()).length === 1);

    expect(encolar).toHaveBeenCalledTimes(1);
    expect(encolar).toHaveBeenCalledWith(A);
    expect(await llm()).toEqual([
      {
        estado: 'propuesta',
        origen: 'llm',
        regla: 'llm_sugerencia',
        score: null,
      },
    ]);
    expect(await ledger()).toEqual([{ resultado: 'propuesta' }]);
    const mov = await una<{ regla: string | null }>(
      ds,
      'SELECT regla_sin_match AS regla FROM movimientos WHERE id = $1',
      [m],
    );
    expect(mov.regla).toBeNull();
    expect(proveedor.llamadas).toBe(1);
  });

  it('nunca confirma: la propuesta queda sin persona', async () => {
    await ambiguo();
    await subirEstadoDeCuenta();
    await esperarHasta(async () => (await llm()).length === 1);
    const { n } = await una<{ n: string }>(
      ds,
      `SELECT count(*)::text AS n FROM conciliaciones WHERE estado = 'confirmada'`,
    );
    expect(n).toBe('0');
  });

  it('el jobId por empresa deduplica: dos encolados seguidos dejan un job', async () => {
    const colaSug = entorno.app.get(ColaSugerencias);
    await cola.pause();
    try {
      await colaSug.encolar(A);
      await colaSug.encolar(A);
      const jobs = await cola.getJobs(['waiting']);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe(`sugerencias-${A}`);
      expect(jobs[0].data).toEqual({ companyId: A });
      expect(jobs[0].opts.attempts).toBe(1);
    } finally {
      await cola.resume();
    }
    await esperarHasta(
      async () => (await cola.getJobs(['active'])).length === 0,
    );
  });

  it('si el proveedor falla, la carga y la conciliación quedan intactas', async () => {
    const espia = jest
      .spyOn(proveedor, 'sugerir')
      .mockRejectedValue(new ErrorProveedorSugerencia('API caída'));
    await ambiguo();

    const carga = await subirEstadoDeCuenta();
    await esperarHasta(() => espia.mock.calls.length === 1);
    await esperarHasta(
      async () =>
        (await cola.getJobs(['active', 'waiting', 'failed'])).length === 0,
    );

    expect(carga.estado).toBe('procesada');
    expect(await llm()).toEqual([]);
    expect(await ledger()).toEqual([]);
    const mov = await una<{ regla: string }>(
      ds,
      `SELECT regla_sin_match AS regla FROM movimientos WHERE descripcion = 'SPEI RECIBIDO CLIENTE'`,
    );
    expect(mov.regla).toBe('monto_multiples_candidatos');
  });

  it('si encolar falla, la carga sigue procesada y el error se loguea', async () => {
    jest
      .spyOn(entorno.app.get(ColaSugerencias), 'encolar')
      .mockRejectedValue(new Error('redis caído'));
    const logs = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    await ambiguo();

    const carga = await subirEstadoDeCuenta();

    expect(carga.estado).toBe('procesada');
    await esperarHasta(() =>
      logs.mock.calls.some(([m]) => String(m).includes('sugerencia por IA')),
    );
    expect(await llm()).toEqual([]);
    const { estado } = await una<{ estado: string }>(
      ds,
      'SELECT estado FROM cargas WHERE id = $1',
      [carga.id],
    );
    expect(estado).toBe('procesada');
  });
});

describe('cola de sugerencias con el proveedor desactivado (CI sin secretos)', () => {
  beforeAll(async () => {
    entorno = await levantarAppDeCargas();
    ({ ds } = entorno);
    A = entorno.empresa(FERRETERIA);
  }, 60_000);
  afterAll(async () => {
    await entorno?.cerrar();
  });
  beforeEach(limpiar);
  afterEach(() => jest.restoreAllMocks());

  it('no encola, no toca Redis y no escribe filas; lo demás funciona igual', async () => {
    const cola = entorno.app.get<Queue>(getQueueToken(COLA_SUGERENCIAS));
    const colaSug = entorno.app.get(ColaSugerencias);
    const encolar = jest.spyOn(colaSug, 'encolar');
    const add = jest.spyOn(cola, 'add');
    await ambiguo();

    const carga = await subirEstadoDeCuenta();
    await new Promise((r) => setTimeout(r, 500));

    expect(colaSug.activa).toBe(false);
    expect(carga.estado).toBe('procesada');
    expect(encolar).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(
      await cola.getJobCounts('waiting', 'active', 'completed', 'failed'),
    ).toEqual({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    });
    expect(await llm()).toEqual([]);
    expect(await ledger()).toEqual([]);
    // La conciliación del motor sí corrió: el caso ambiguo quedó en revisión.
    const mov = await una<{ regla: string }>(
      ds,
      `SELECT regla_sin_match AS regla FROM movimientos WHERE descripcion = 'SPEI RECIBIDO CLIENTE'`,
    );
    expect(mov.regla).toBe('monto_multiples_candidatos');
  });
});
