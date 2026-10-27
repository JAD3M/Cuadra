import { readFileSync } from 'fs';
import { join } from 'path';
import type { DataSource } from 'typeorm';
import { construirPdfSintetico } from '../bancos/pdf/pdf-sintetico';
import { filas, una } from '../database/testing/base-de-pruebas';
import request from '../testing/supertest-con-origen';
import {
  ANA,
  type AppDeCargas,
  CARMEN,
  FERRETERIA,
  JORGE,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from './testing/app-de-cargas';

/**
 * Historia 3.2 (T3): POST /cargas/estado-cuenta/pdf lee el PDF y responde el
 * conteo, sin importar nada. SINTÉTICO: el PDF de BBVA es el fixture de la
 * historia, no un estado de cuenta real.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
}, 60_000);

afterAll(async () => {
  await entorno?.cerrar();
});

const BBVA = readFileSync(
  join(__dirname, '..', 'bancos', 'fixtures', 'bbva-sintetico.pdf'),
);

const ENCABEZADO = (moneda: string) => [
  'Periodo DEL 01/10/2026 AL 31/10/2026',
  `Moneda ${moneda}`,
  'Saldo Anterior 10,000.00',
  'Saldo Final 11,250.50',
];

function subir(
  token: string | null,
  nombre: string,
  contenido: Buffer,
  banco: string | null = 'bbva',
) {
  let req = request(entorno.app.getHttpServer()).post(
    '/cargas/estado-cuenta/pdf',
  );
  if (token) req = req.set('Cookie', token);
  if (banco !== null) req = req.field('banco', banco);
  return req.attach('archivo', contenido, nombre);
}

async function conteos() {
  return una<{ cargas: number; movimientos: number; bitacora: number }>(
    ds,
    `SELECT (SELECT count(*)::int FROM cargas) AS cargas,
            (SELECT count(*)::int FROM movimientos) AS movimientos,
            (SELECT count(*)::int FROM bitacora
               WHERE accion NOT IN ('acceso_denegado')) AS bitacora`,
  );
}

const cuerpo = (res: { body: unknown }) =>
  res.body as { message: string; error?: string };

describe('POST /cargas/estado-cuenta/pdf (historia 3.2)', () => {
  it('lee el PDF sintético: saldos y conteos, y no guarda nada', async () => {
    const antes = await conteos();
    const res = await subir(
      await entorno.token(LUIS, FERRETERIA),
      'bbva.pdf',
      BBVA,
    ).expect(200);

    expect(res.body).toEqual({
      banco: 'bbva',
      saldoInicial: '10000.00',
      saldoFinal: '11250.50',
      movimientosLeidos: 2,
      lineasNoLeidas: 0,
    });
    expect(await conteos()).toEqual(antes);
  });

  it('un admin también lee', async () => {
    await subir(await entorno.token(ANA, FERRETERIA), 'bbva.pdf', BBVA).expect(
      200,
    );
  });

  it('sin sesión: 401', async () => {
    await subir(null, 'bbva.pdf', BBVA).expect(401);
  });

  it('un revisor no sube: 403', async () => {
    await subir(
      await entorno.token(JORGE, TRANSPORTES),
      'bbva.pdf',
      BBVA,
    ).expect(403);
  });

  it('un auditor no sube: 403', async () => {
    const empresa = entorno.empresa(FERRETERIA);
    const cambiar = (rol: string) =>
      ds.query(
        `UPDATE user_company_roles SET rol = $3
          WHERE user_id = $1 AND company_id = $2`,
        [entorno.persona(LUIS), empresa, rol],
      );
    const token = await entorno.token(LUIS, FERRETERIA);
    await cambiar('auditor');
    try {
      await subir(token, 'bbva.pdf', BBVA).expect(403);
    } finally {
      await cambiar('contador');
    }
  });

  describe('rechazos con código estable → 400', () => {
    it('PDF sin texto (escaneado): pdf_sin_texto', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'escaneado.pdf',
        construirPdfSintetico([]),
      ).expect(400);
      expect(cuerpo(res).error).toBe('pdf_sin_texto');
      expect(cuerpo(res).message).toMatch(/portal del banco/);
    });

    it('bytes que no son PDF con nombre .pdf: pdf_ilegible', async () => {
      const antes = await conteos();
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'falso.pdf',
        Buffer.from('fecha,descripcion,referencia,monto\n'),
      ).expect(400);
      expect(cuerpo(res).error).toBe('pdf_ilegible');
      expect(await conteos()).toEqual(antes);
    });

    it('PDF truncado con la firma correcta: pdf_ilegible', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'truncado.pdf',
        BBVA.subarray(0, 120),
      ).expect(400);
      expect(cuerpo(res).error).toBe('pdf_ilegible');
    });

    it('moneda distinta de MXN: moneda_no_mxn', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'usd.pdf',
        construirPdfSintetico(ENCABEZADO('USD')),
      ).expect(400);
      expect(cuerpo(res).error).toBe('moneda_no_mxn');
    });

    it('sin periodo ni saldos: 400 con su mensaje, sin código', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'vacio.pdf',
        construirPdfSintetico(['Moneda MXN', 'Hola']),
      ).expect(400);
      expect(cuerpo(res).message).toMatch(/periodo o los saldos/);
    });
  });

  describe('límites → 400', () => {
    it('extensión .csv', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'estado.csv',
        BBVA,
      ).expect(400);
      expect(cuerpo(res).message).toMatch(/\.pdf/);
    });

    it('más de un archivo', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'a.pdf',
        BBVA,
      )
        .attach('archivo', BBVA, 'b.pdf')
        .expect(400);
      expect(cuerpo(res).message).toMatch(/Máximo 1 archivo/);
    });

    it('sin archivo', async () => {
      await request(entorno.app.getHttpServer())
        .post('/cargas/estado-cuenta/pdf')
        .set('Cookie', await entorno.token(LUIS, FERRETERIA))
        .field('banco', 'bbva')
        .expect(400);
    });

    it('más de 10 MB', async () => {
      const grande = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.alloc(10 * 1024 * 1024 + 1, 0x20),
      ]);
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'grande.pdf',
        grande,
      ).expect(400);
      expect(cuerpo(res).message).toMatch(/10 MB/);
    });

    it('banco desconocido', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'bbva.pdf',
        BBVA,
        'banamex',
      ).expect(400);
      expect(cuerpo(res).message).toMatch(/Banco no soportado.*bbva/);
    });

    it('sin banco', async () => {
      await subir(
        await entorno.token(LUIS, FERRETERIA),
        'bbva.pdf',
        BBVA,
        null,
      ).expect(400);
    });
  });

  it('aislamiento: otra empresa no ve ni escribe nada de la primera', async () => {
    const antes = await conteos();
    const res = await subir(
      await entorno.token(CARMEN, TRANSPORTES),
      'bbva.pdf',
      BBVA,
    ).expect(200);
    // Solo el conteo del archivo que ella misma subió; nada de A.
    expect(res.body).toMatchObject({ movimientosLeidos: 2 });
    expect(JSON.stringify(res.body)).not.toMatch(/company|empresa/i);
    expect(await conteos()).toEqual(antes);
    const huella = await filas<{ company_id: string }>(
      ds,
      `SELECT company_id FROM cargas WHERE tipo = 'estado_cuenta'
        AND nombre_archivo = 'bbva.pdf'`,
    );
    expect(huella).toEqual([]);
  });
});
