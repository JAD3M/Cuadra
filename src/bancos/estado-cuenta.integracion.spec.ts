import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import type { ResultadoDeFila } from '../cargas/carga.entity';
import type { RespuestaDeCarga } from '../cargas/cargas.service';
import {
  ANA,
  type AppDeCargas,
  CARMEN,
  FERRETERIA,
  JORGE,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { filas, una } from '../database/testing/base-de-pruebas';

/**
 * CU-09 de punta a punta: POST /cargas/estado-cuenta, la cola y el worker
 * con Postgres real y RLS. Estados de cuenta sintéticos en
 * src/bancos/fixtures; nunca datos reales.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
/** Dueño: verifica sin RLS. */
let ds: DataSource;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
}, 60_000);

afterAll(async () => {
  await entorno?.cerrar();
});

function fixture(nombre: string): Buffer {
  return readFileSync(join(__dirname, 'fixtures', nombre));
}

function subir(
  token: string,
  nombre: string,
  contenido: Buffer,
  campos: { banco?: string; cuenta?: string } = {},
) {
  let req = request(entorno.app.getHttpServer())
    .post('/cargas/estado-cuenta')
    .auth(token, { type: 'bearer' });
  for (const [campo, valor] of Object.entries(campos)) {
    req = req.field(campo, valor);
  }
  return req.attach('archivo', contenido, nombre);
}

async function cargarYEsperar(
  token: string,
  nombre: string,
  campos: { banco?: string; cuenta?: string } = {},
) {
  const res = await subir(token, nombre, fixture(nombre), campos).expect(202);
  const recibida = res.body as RespuestaDeCarga;
  expect(recibida).toMatchObject({ estado: 'pendiente', yaExistia: false });
  return entorno.esperarFin(token, recibida.id);
}

interface FilaMovimiento {
  linea_numero: number;
  fecha: string;
  descripcion: string;
  referencia: string | null;
  monto: string;
  banco: string | null;
  cuenta: string | null;
}

function movimientosDe(cargaId: string) {
  // ::text para ver el valor exacto guardado, sin pasar por number.
  return filas<FilaMovimiento>(
    ds,
    `SELECT linea_numero, fecha::text AS fecha, descripcion, referencia,
            monto::text AS monto, banco, cuenta
       FROM movimientos WHERE carga_id = $1 ORDER BY linea_numero`,
    [cargaId],
  );
}

async function conteos() {
  return una<{ cargas: number; movimientos: number }>(
    ds,
    `SELECT (SELECT count(*)::int FROM cargas) AS cargas,
            (SELECT count(*)::int FROM movimientos) AS movimientos`,
  );
}

function mensaje(res: { body: unknown }): string {
  return (res.body as { message: string }).message;
}

describe('POST /cargas/estado-cuenta (CU-09)', () => {
  it('CSV válido de 5 filas: procesada, 5 movimientos con sus montos exactos', async () => {
    const carga = await cargarYEsperar(
      await entorno.token(LUIS, FERRETERIA),
      'valido-5.csv',
      { banco: 'BANCO SINTETICO', cuenta: '****1234' },
    );

    expect(carga).toMatchObject({
      estado: 'procesada',
      totalRegistros: 5,
      registrosOk: 5,
      registrosError: 0,
      resultados: [],
    });
    expect(await movimientosDe(carga.id)).toEqual([
      {
        linea_numero: 2,
        fecha: '2026-09-01',
        descripcion: 'DEPOSITO SPEI FERRETERIA DEL BAJIO',
        referencia: 'A1001',
        monto: '4466.5800',
        banco: 'BANCO SINTETICO',
        cuenta: '****1234',
      },
      expect.objectContaining({
        linea_numero: 3,
        referencia: null,
        monto: '-12.5000',
      }),
      expect.objectContaining({ linea_numero: 4, monto: '-1500.0000' }),
      expect.objectContaining({ linea_numero: 5, monto: '0.0001' }),
      expect.objectContaining({ linea_numero: 6, monto: '123456789.1234' }),
    ]);
  });

  it('1 fila malformada de 5: con_errores, 4 movimientos y la fila reportada con su línea', async () => {
    const carga = await cargarYEsperar(
      await entorno.token(ANA, FERRETERIA),
      'una-malformada.csv',
    );

    expect(carga).toMatchObject({
      estado: 'con_errores',
      totalRegistros: 5,
      registrosOk: 4,
      registrosError: 1,
    });
    const [error] = carga.resultados as ResultadoDeFila[];
    expect(carga.resultados).toHaveLength(1);
    // Línea 4 del archivo: encabezado en la 1, tercera fila de datos.
    expect(error).toMatchObject({ fila: 4, resultado: 'error' });
    expect(error.motivo).toMatch(/Fecha inválida: "2026-02-30"/);
    expect((await movimientosDe(carga.id)).map((m) => m.linea_numero)).toEqual([
      2, 3, 5, 6,
    ]);
  });

  it('encabezados incorrectos: 400 y cero cargas', async () => {
    const antes = await conteos();
    const res = await subir(
      await entorno.token(ANA, FERRETERIA),
      'encabezados-incorrectos.csv',
      fixture('encabezados-incorrectos.csv'),
    ).expect(400);

    expect(mensaje(res)).toMatch(
      /se esperan exactamente "fecha,descripcion,referencia,monto"/,
    );
    expect(await conteos()).toEqual(antes);
  });

  it('archivo en Latin-1: 400 con motivo de codificación y cero cargas', async () => {
    const antes = await conteos();
    const res = await subir(
      await entorno.token(ANA, FERRETERIA),
      'latin1.csv',
      fixture('latin1.csv'),
    ).expect(400);

    expect(mensaje(res)).toMatch(/UTF-8/);
    expect(await conteos()).toEqual(antes);
  });

  it('el mismo archivo dos veces: 200 yaExistia, sin movimientos duplicados', async () => {
    // Otra empresa que el primer test: el hash es por empresa.
    const token = await entorno.token(CARMEN, TRANSPORTES);
    const original = await cargarYEsperar(token, 'valido-5.csv');
    const antes = await conteos();

    const segunda = (
      await subir(token, 'valido-5.csv', fixture('valido-5.csv')).expect(200)
    ).body as RespuestaDeCarga;

    expect(segunda).toEqual({ ...original, yaExistia: true });
    expect(await conteos()).toEqual(antes);
  });

  it('dos filas idénticas son dos movimientos', async () => {
    const carga = await cargarYEsperar(
      await entorno.token(ANA, FERRETERIA),
      'filas-identicas.csv',
    );

    expect(carga).toMatchObject({ estado: 'procesada', registrosOk: 2 });
    const movimientos = await movimientosDe(carga.id);
    expect(movimientos.map((m) => m.linea_numero)).toEqual([2, 3]);
    const [a, b] = movimientos;
    expect({ ...a, linea_numero: 0 }).toEqual({ ...b, linea_numero: 0 });
  });

  it('una descripción con comas entre comillas se carga entera', async () => {
    const carga = await cargarYEsperar(
      await entorno.token(ANA, FERRETERIA),
      'descripcion-con-comas.csv',
    );

    expect(carga.estado).toBe('procesada');
    expect(await movimientosDe(carga.id)).toEqual([
      expect.objectContaining({
        descripcion: 'PAGO FACTURA A-1001, A-1002 Y A-1003, CLIENTE "EL NORTE"',
        referencia: 'F-1001',
        monto: '3000.0000',
      }),
    ]);
  });

  it('un revisor no sube: 403', async () => {
    await subir(
      await entorno.token(JORGE, TRANSPORTES),
      'valido-5.csv',
      fixture('valido-5.csv'),
    ).expect(403);
  });

  describe('límites → 400', () => {
    it('un archivo que no es .csv', async () => {
      const res = await subir(
        await entorno.token(ANA, FERRETERIA),
        'estado.txt',
        fixture('valido-5.csv'),
      ).expect(400);
      expect(mensaje(res)).toMatch(/\.csv/);
    });

    it('más de un archivo', async () => {
      const res = await subir(
        await entorno.token(ANA, FERRETERIA),
        'a.csv',
        fixture('valido-5.csv'),
      )
        .attach('archivo', fixture('filas-identicas.csv'), 'b.csv')
        .expect(400);
      expect(mensaje(res)).toMatch(/Máximo 1 archivo/);
    });

    it('un banco de más de 128 caracteres', async () => {
      await subir(
        await entorno.token(ANA, FERRETERIA),
        'valido-5.csv',
        fixture('valido-5.csv'),
        { banco: 'B'.repeat(129) },
      ).expect(400);
    });
  });
});
