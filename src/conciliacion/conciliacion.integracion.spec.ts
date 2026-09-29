import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import type { Job } from 'bullmq';
import type { RespuestaDeCarga } from '../cargas/cargas.service';
import type { TrabajoDeCarga } from '../cargas/cola-cargas';
import { ProcesadorCargas } from '../cargas/procesador-cargas';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  LUIS,
  ANA,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { dinero } from '../common/dinero';
import { filas, una } from '../database/testing/base-de-pruebas';
import { ConciliacionService } from './conciliacion.service';
import { ProveedorTolerancia, ToleranciaPorEmpresa } from './tolerancia';

/**
 * CU-11 de punta a punta contra Postgres real con RLS. Casi todo llama a
 * `conciliar` directo para ser determinista; los tests del gancho pasan por
 * el worker real y sondean, porque `conciliar` corre después del commit.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let servicio: ConciliacionService;
let A: string;
let B: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  servicio = entorno.app.get(ConciliacionService);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
}, 60_000);

afterAll(async () => {
  await entorno?.cerrar();
});

beforeEach(async () => {
  await ds.query('TRUNCATE cfdi, cargas, movimientos, conciliaciones CASCADE');
});

afterEach(() => jest.restoreAllMocks());

async function movimiento(
  empresa: string,
  o: {
    referencia?: string | null;
    monto?: string;
    fecha?: string;
    moneda?: string;
  } = {},
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto, moneda)
     VALUES ($1,$2,$3,'SPEI RECIBIDO',$4,$5,$6) RETURNING id`,
    [
      empresa,
      linea++,
      o.fecha ?? '2026-09-02',
      o.referencia ?? null,
      o.monto ?? '1160.00',
      o.moneda ?? 'MXN',
    ],
  );
  return id;
}

async function factura(
  empresa: string,
  o: {
    serie?: string | null;
    folio?: string | null;
    total?: string;
    fecha?: string;
    tipo?: string;
    estado?: string;
    moneda?: string;
    emisor?: string;
  } = {},
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado, xml_raw)
     VALUES ($1,$2,$3,'XAXX010101000',$4,$5,$6,$7,$8,$9,$9,$10,'{"_xml":"<x/>"}'::jsonb)
     RETURNING id`,
    [
      empresa,
      randomUUID(),
      o.emisor ?? (empresa === B ? TRANSPORTES : FERRETERIA),
      o.serie === undefined ? 'A' : o.serie,
      o.folio === undefined ? '1001' : o.folio,
      o.fecha ?? '2026-09-01T10:00:00',
      o.tipo ?? 'I',
      o.moneda ?? 'MXN',
      o.total ?? '1160.00',
      o.estado ?? 'abierta',
    ],
  );
  return id;
}

async function conciliacionPrevia(
  empresa: string,
  cfdiId: string,
  movimientoId: string,
  estado: 'propuesta' | 'rechazada' | 'confirmada',
) {
  const persona = estado === 'confirmada' ? entorno.persona(ANA) : null;
  await ds.query(
    `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen, motivo,
                                 confirmada_por_id, confirmada_at)
     VALUES ($1,$2,$3,$4,'manual','previa',$5, CASE WHEN $5::uuid IS NULL THEN NULL ELSE now() END)`,
    [empresa, cfdiId, movimientoId, estado, persona],
  );
}

interface FilaConciliacion {
  company_id: string;
  cfdi_id: string;
  movimiento_id: string;
  estado: string;
  origen: string;
  regla: string;
  score: string;
  diferencia_monto: string;
  motivo: string;
}

const conciliaciones = (empresa?: string) =>
  filas<FilaConciliacion>(
    ds,
    `SELECT company_id, cfdi_id, movimiento_id, estado, origen, regla,
            score::text AS score, diferencia_monto::text AS diferencia_monto, motivo
       FROM conciliaciones
      WHERE $1::uuid IS NULL OR company_id = $1 ORDER BY created_at, id`,
    [empresa ?? null],
  );

const propuestasNuevas = async (empresa: string) =>
  (await conciliaciones(empresa)).filter((f) => f.origen === 'regla');

describe('conciliar (CU-11): elegibilidad y reglas', () => {
  it('referencia y monto exactos: una propuesta, nunca confirmada', async () => {
    const m = await movimiento(A, { referencia: 'A-0001001' });
    const c = await factura(A);

    expect(await servicio.conciliar(A)).toEqual({ propuestas: 1 });

    expect(await conciliaciones()).toEqual([
      expect.objectContaining({
        company_id: A,
        cfdi_id: c,
        movimiento_id: m,
        estado: 'propuesta',
        origen: 'regla',
        regla: 'referencia_monto_exacto',
        score: '1.0000',
        diferencia_monto: '0.0000',
      }),
    ]);
    // RM-3: el motor no cambia los estados de movimiento ni de CFDI.
    const estados = await una<{ m: string; c: string }>(
      ds,
      `SELECT (SELECT estado FROM movimientos WHERE id = $1) AS m,
              (SELECT estado FROM cfdi WHERE id = $2) AS c`,
      [m, c],
    );
    expect(estados).toEqual({ m: 'abierto', c: 'abierta' });
  });

  it('el mismo día de la emisión sí; el día anterior no', async () => {
    await movimiento(A, { referencia: 'A1001', fecha: '2026-09-01' });
    await factura(A, { fecha: '2026-09-01T23:30:00' });
    expect(await servicio.conciliar(A)).toEqual({ propuestas: 1 });

    await ds.query('TRUNCATE cfdi, movimientos, conciliaciones CASCADE');
    await movimiento(A, { referencia: 'A1001', fecha: '2026-03-09' });
    await factura(A, { fecha: '2026-03-10T08:00:00' });
    expect(await servicio.conciliar(A)).toEqual({ propuestas: 0 });
  });

  it.each([
    ['cargo', { monto: '-1160.00' }, {}],
    ['otra moneda', { moneda: 'USD' }, {}],
    ['PPD (parcialidades)', {}, { estado: 'parcialidades' }],
    ['CFDI cancelada', {}, { estado: 'cancelada' }],
    ['CFDI de egreso', {}, { tipo: 'E' }],
    ['CFDI de pago', {}, { tipo: 'P' }],
    ['CFDI recibida (otro emisor)', {}, { emisor: 'AAA010101AAA' }],
  ])('excluye: %s', async (_caso, mov, cfdi) => {
    await movimiento(A, { referencia: 'A-0001001', ...mov });
    await factura(A, cfdi);
    expect(await servicio.conciliar(A)).toEqual({ propuestas: 0 });
    expect(await conciliaciones()).toEqual([]);
  });

  it('referencia ambigua (serie A y B, folio 1001): ni fila ni respaldo por monto', async () => {
    await movimiento(A, { referencia: '1001' });
    await factura(A, { serie: 'A' });
    await factura(A, { serie: 'B' });
    expect(await servicio.conciliar(A)).toEqual({ propuestas: 0 });
  });

  it('referencia corta cae a monto único', async () => {
    await movimiento(A, { referencia: '12' });
    await factura(A, { folio: '12' });
    await servicio.conciliar(A);
    expect(await conciliaciones()).toEqual([
      expect.objectContaining({ regla: 'monto_unico', score: '0.4000' }),
    ]);
  });

  it('monto único: una fila; dos CFDI iguales o dos movimientos iguales, ninguna', async () => {
    await movimiento(A, { monto: '500.00' });
    await factura(A, { folio: '7001', total: '500.00' });
    await servicio.conciliar(A);
    expect(await conciliaciones()).toEqual([
      expect.objectContaining({ regla: 'monto_unico', score: '0.4000' }),
    ]);

    await ds.query('TRUNCATE cfdi, movimientos, conciliaciones CASCADE');
    await movimiento(A, { monto: '500.00' });
    await factura(A, { folio: '7001', total: '500.00' });
    await factura(A, { folio: '7002', total: '500.00' });
    expect((await servicio.conciliar(A)).propuestas).toBe(0);

    await ds.query('TRUNCATE cfdi, movimientos, conciliaciones CASCADE');
    await movimiento(A, { monto: '500.00' });
    await movimiento(A, { monto: '500.00' });
    await factura(A, { folio: '7001', total: '500.00' });
    expect((await servicio.conciliar(A)).propuestas).toBe(0);
  });

  it('un CFDI ya propuesto sigue contando como candidato de otro movimiento', async () => {
    const m1 = await movimiento(A, { monto: '500.00' });
    await movimiento(A, { monto: '500.00' });
    const x = await factura(A, { folio: '7001', total: '500.00' });
    await factura(A, { folio: '7002', total: '500.00' });
    await conciliacionPrevia(A, x, m1, 'propuesta');

    expect((await servicio.conciliar(A)).propuestas).toBe(0);
    expect(await conciliaciones()).toHaveLength(1);
  });

  it('fuera de tolerancia: 0.5 con diferencia -160.00; con tolerancia 200 inyectada, 1.0', async () => {
    await movimiento(A, { referencia: 'A1001', monto: '1000.00' });
    await factura(A);
    await servicio.conciliar(A);
    expect(await conciliaciones()).toEqual([
      expect.objectContaining({
        regla: 'referencia_monto_diferente',
        score: '0.5000',
        diferencia_monto: '-160.0000',
      }),
    ]);

    await ds.query('TRUNCATE conciliaciones');
    jest
      .spyOn(entorno.app.get(ProveedorTolerancia), 'obtener')
      .mockResolvedValue(dinero('200'));
    await servicio.conciliar(A);
    expect(await conciliaciones()).toEqual([
      expect.objectContaining({
        regla: 'referencia_monto_exacto',
        score: '1.0000',
        diferencia_monto: '-160.0000',
      }),
    ]);
  });

  it('el motivo explica la regla en español y nunca menciona al LLM', async () => {
    await movimiento(A, { referencia: 'A-0001001' });
    await factura(A);
    await servicio.conciliar(A);
    const [fila] = await conciliaciones();
    expect(fila.motivo).toContain('A-0001001');
    expect(fila.motivo).toContain('A-1001');
    expect(fila.motivo).toContain('1160.0000');
    expect(fila.motivo.toLowerCase()).not.toContain('llm');
  });
});

describe('conciliar (CU-11): existentes, rechazo e idempotencia', () => {
  it('no propone sobre movimiento o CFDI con conciliación confirmada o propuesta', async () => {
    const m = await movimiento(A, { referencia: 'A1001' });
    const x = await factura(A, { folio: '9001', total: '99.00' });
    await conciliacionPrevia(A, x, m, 'propuesta');
    await factura(A); // Y: coincide con la referencia de M, pero M ya está ocupado
    expect((await servicio.conciliar(A)).propuestas).toBe(0);

    await ds.query('TRUNCATE cfdi, movimientos, conciliaciones CASCADE');
    const m2 = await movimiento(A, { referencia: 'Z9999' });
    const x2 = await factura(A, { folio: '9001', total: '99.00' });
    await conciliacionPrevia(A, x2, m2, 'confirmada');
    await movimiento(A, { referencia: '9001', monto: '99.00' });
    expect((await servicio.conciliar(A)).propuestas).toBe(0);
  });

  it('un par rechazado no se vuelve a proponer y su fila queda igual', async () => {
    const m = await movimiento(A, { referencia: 'A1001' });
    const x = await factura(A);
    await conciliacionPrevia(A, x, m, 'rechazada');
    const antes = await conciliaciones();

    expect((await servicio.conciliar(A)).propuestas).toBe(0);
    expect(await conciliaciones()).toEqual(antes);
  });

  it('el rechazo libera al otro candidato', async () => {
    const m = await movimiento(A, { monto: '500.00' });
    const x = await factura(A, { folio: '7001', total: '500.00' });
    const y = await factura(A, { folio: '7002', total: '500.00' });
    await conciliacionPrevia(A, x, m, 'rechazada');

    expect((await servicio.conciliar(A)).propuestas).toBe(1);
    const nuevas = await propuestasNuevas(A);
    expect(nuevas).toEqual([
      expect.objectContaining({ cfdi_id: y, movimiento_id: m }),
    ]);
  });

  it('es idempotente: la segunda corrida no crea nada', async () => {
    await movimiento(A, { referencia: 'A1001' });
    await factura(A);
    expect(await servicio.conciliar(A)).toEqual({ propuestas: 1 });
    expect(await servicio.conciliar(A)).toEqual({ propuestas: 0 });
    expect(await conciliaciones()).toHaveLength(1);
  });

  it('dos corridas en paralelo: una sola fila por par y ambas terminan', async () => {
    for (let i = 0; i < 5; i++) {
      await movimiento(A, { referencia: `F${i}0001`, monto: `${100 + i}.00` });
      await factura(A, {
        serie: 'F',
        folio: `${i}0001`,
        total: `${100 + i}.00`,
      });
    }
    const [r1, r2] = await Promise.all([
      servicio.conciliar(A),
      servicio.conciliar(A),
    ]);
    expect(r1.propuestas + r2.propuestas).toBe(5);
    expect(await conciliaciones()).toHaveLength(5);
  });
});

describe('conciliar (CU-11): aislamiento entre empresas', () => {
  it('datos idénticos en otra empresa no cruzan', async () => {
    await movimiento(A, { referencia: 'A-0001001' });
    await factura(B); // CFDI de B con el mismo folio y monto
    expect(await servicio.conciliar(A)).toEqual({ propuestas: 0 });
    expect(await servicio.conciliar(B)).toEqual({ propuestas: 0 });
    expect(await conciliaciones()).toEqual([]);
  });

  it('el mismo folio en B no vuelve ambigua a A y la fila lleva el company_id de A', async () => {
    await movimiento(A, { referencia: '1001' });
    const propio = await factura(A);
    await factura(B);
    await servicio.conciliar(A);
    expect(await conciliaciones()).toEqual([
      expect.objectContaining({ company_id: A, cfdi_id: propio }),
    ]);
  });
});

describe('tolerancia por empresa (CU-12)', () => {
  const fijar = (empresa: string, valor: string) =>
    ds.query('UPDATE companies SET tolerancia_monto = $2 WHERE id = $1', [
      empresa,
      valor,
    ]);

  afterEach(async () => {
    await ds.query(`UPDATE companies SET tolerancia_monto = 0`);
  });

  it('el proveedor enlazado lee companies.tolerancia_monto', () => {
    expect(entorno.app.get(ProveedorTolerancia)).toBeInstanceOf(
      ToleranciaPorEmpresa,
    );
  });

  it('estricta por omisión y con decimales exactos, sin pasar por number', async () => {
    const proveedor = entorno.app.get(ProveedorTolerancia);
    expect((await proveedor.obtener(A)).toFixed()).toBe('0');
    await fijar(A, '0.1234');
    expect((await proveedor.obtener(A)).toFixed()).toBe('0.1234');
  });

  it('cada empresa lee la suya: el valor de A nunca se usa para B', async () => {
    const proveedor = entorno.app.get(ProveedorTolerancia);
    await fijar(A, '50');
    expect((await proveedor.obtener(A)).toFixed()).toBe('50');
    expect((await proveedor.obtener(B)).toFixed()).toBe('0');

    // Y en el motor: la misma diferencia de 40.00 entra en A y no en B.
    for (const empresa of [A, B]) {
      await movimiento(empresa, { referencia: 'A1001', monto: '1120.00' });
      await factura(empresa);
    }
    await servicio.conciliar(A);
    await servicio.conciliar(B);
    expect(await propuestasNuevas(A)).toEqual([
      expect.objectContaining({
        regla: 'referencia_monto_exacto',
        diferencia_monto: '-40.0000',
      }),
    ]);
    expect(await propuestasNuevas(B)).toEqual([
      expect.objectContaining({
        regla: 'referencia_monto_diferente',
        diferencia_monto: '-40.0000',
      }),
    ]);
  });

  it('una empresa inexistente cae a la más estricta: 0', async () => {
    const proveedor = entorno.app.get(ProveedorTolerancia);
    expect(
      (
        await proveedor.obtener('00000000-0000-7000-8000-000000000000')
      ).toFixed(),
    ).toBe('0');
  });

  it('en USD la tolerancia de la empresa no aplica', async () => {
    await fijar(A, '50');
    await movimiento(A, {
      referencia: 'A1001',
      monto: '1120.00',
      moneda: 'USD',
    });
    await factura(A, { moneda: 'USD' });
    await servicio.conciliar(A);
    expect(await propuestasNuevas(A)).toEqual([
      expect.objectContaining({ regla: 'referencia_monto_diferente' }),
    ]);
  });
});

describe('conciliar (CU-11): gancho del worker', () => {
  const CFDI_FIXTURE = join(
    __dirname,
    '..',
    'cfdi',
    'fixtures',
    'pue-valido.xml',
  );

  /** pue-valido (serie A, folio 1001, 4466.58) emitido antes de valido-5.csv. */
  function xmlCfdi(): string {
    return readFileSync(CFDI_FIXTURE, 'utf8')
      .replace(/UUID="[^"]+"/, `UUID="${randomUUID().toUpperCase()}"`)
      .replace('Fecha="2026-09-15T10:30:00"', 'Fecha="2026-08-30T10:30:00"');
  }

  async function subirCfdi(token: string) {
    const res = await request(entorno.app.getHttpServer())
      .post('/cargas/cfdi')
      .auth(token, { type: 'bearer' })
      .attach('archivos', Buffer.from(xmlCfdi()), 'pue.xml')
      .expect(202);
    return entorno.esperarFin(token, (res.body as RespuestaDeCarga).id);
  }

  async function subirEstado(token: string) {
    const res = await request(entorno.app.getHttpServer())
      .post('/cargas/estado-cuenta')
      .auth(token, { type: 'bearer' })
      .field('banco', 'BANCO SINTETICO')
      .field('cuenta', '****1234')
      .attach(
        'archivo',
        readFileSync(
          join(__dirname, '..', 'bancos', 'fixtures', 'valido-5.csv'),
        ),
        'valido-5.csv',
      )
      .expect(202);
    return entorno.esperarFin(token, (res.body as RespuestaDeCarga).id);
  }

  async function esperarHasta(condicion: () => Promise<boolean> | boolean) {
    const limite = Date.now() + 15_000;
    while (!(await condicion())) {
      if (Date.now() > limite)
        throw new Error('Condición no cumplida a tiempo');
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  it('estado de cuenta y luego CFDI: cada carga dispara conciliar y queda una fila', async () => {
    const espia = jest.spyOn(servicio, 'conciliar');
    const token = await entorno.token(LUIS, FERRETERIA);

    expect((await subirEstado(token)).estado).toBe('procesada');
    await esperarHasta(() => espia.mock.calls.length === 1);
    expect(await conciliaciones()).toEqual([]);

    expect((await subirCfdi(token)).estado).toBe('procesada');
    await esperarHasta(async () => (await conciliaciones()).length === 1);

    expect(espia.mock.calls).toEqual([[A], [A]]);
    // La fila cruza el abono A1001 de valido-5.csv con el CFDI serie A/1001.
    expect(await conciliaciones()).toEqual([
      expect.objectContaining({
        company_id: A,
        estado: 'propuesta',
        origen: 'regla',
        regla: 'referencia_monto_exacto',
        score: '1.0000',
        diferencia_monto: '0.0000',
      }),
    ]);
  });

  it('CFDI y luego estado de cuenta: el mismo resultado', async () => {
    const token = await entorno.token(LUIS, FERRETERIA);
    await subirCfdi(token);
    await subirEstado(token);
    await esperarHasta(async () => (await conciliaciones()).length === 1);
    expect(await conciliaciones()).toEqual([
      expect.objectContaining({ regla: 'referencia_monto_exacto' }),
    ]);
  });

  it('si conciliar lanza, la carga sigue procesada y el error se loguea', async () => {
    const espia = jest
      .spyOn(servicio, 'conciliar')
      .mockRejectedValue(new Error('motor caído'));
    const logs = jest.spyOn(Logger.prototype, 'error');
    const token = await entorno.token(LUIS, FERRETERIA);

    const carga = await subirEstado(token);
    await esperarHasta(() => espia.mock.calls.length === 1);
    await esperarHasta(() =>
      logs.mock.calls.some(([m]) => String(m).includes('conciliación')),
    );

    expect(carga.estado).toBe('procesada');
    const { estado } = await una<{ estado: string }>(
      ds,
      'SELECT estado FROM cargas WHERE id = $1',
      [carga.id],
    );
    expect(estado).toBe('procesada');
  });

  it('un job repetido sobre una carga ya procesada vuelve a conciliar', async () => {
    const token = await entorno.token(LUIS, FERRETERIA);
    const carga = await subirEstado(token);
    const espia = jest.spyOn(servicio, 'conciliar');
    const job = {
      data: { cargaId: carga.id, companyId: A },
      attemptsMade: 0,
      opts: { attempts: 5 },
    } as unknown as Job<TrabajoDeCarga>;

    await entorno.app.get(ProcesadorCargas).process(job);
    expect(espia).toHaveBeenCalledWith(A);
  });

  it('una carga que falla no dispara la conciliación', async () => {
    const procesador = entorno.app.get(ProcesadorCargas);
    jest.spyOn(procesador, 'procesar').mockRejectedValue(new Error('boom'));
    const espia = jest.spyOn(servicio, 'conciliar');
    const job = {
      data: { cargaId: randomUUID(), companyId: A },
      attemptsMade: 0,
      opts: { attempts: 5 },
    } as unknown as Job<TrabajoDeCarga>;

    await expect(procesador.process(job)).rejects.toThrow('boom');
    expect(espia).not.toHaveBeenCalled();
  });
});
