import { readFileSync } from 'fs';
import { join } from 'path';
import type { DataSource } from 'typeorm';
import { construirPdfSintetico } from '../bancos/pdf/pdf-sintetico';
import { una } from '../database/testing/base-de-pruebas';
import request from '../testing/supertest-con-origen';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  LUIS,
} from './testing/app-de-cargas';

/**
 * Historia 8.1: POST /cargas/estado-cuenta/pdf con banco Banorte pasa por el
 * mismo flujo que BBVA (cuadre, zona de espera, rechazos). SINTÉTICO
 * [SUPUESTO]: el PDF es el fixture de la historia, no un estado de cuenta real.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
}, 60_000);

async function limpiar(): Promise<void> {
  await ds.query(`DELETE FROM movimientos_pendientes`);
  await ds.query(
    `DELETE FROM bitacora WHERE entidad = 'cargas'
        AND accion IN ('cargar', 'rechazar')`,
  );
  await ds.query(
    `DELETE FROM cargas WHERE estado IN ('pendiente_vista_previa', 'rechazada')`,
  );
}

beforeEach(async () => {
  await limpiar();
});

afterAll(async () => {
  if (ds?.isInitialized) await limpiar();
  await entorno?.cerrar();
});

const fixture = (nombre: string) =>
  readFileSync(join(__dirname, '..', 'bancos', 'fixtures', nombre));
const BANORTE = fixture('banorte-sintetico.pdf');
const BBVA = fixture('bbva-sintetico.pdf');

const ENCABEZADO = (moneda: string) => [
  'BANORTE',
  'ESTADO DE CUENTA EMPRESARIAL',
  'Periodo: 01/09/2026 al 30/09/2026',
  `Moneda: ${moneda}`,
  'Saldo inicial: 10,000.00',
  'Saldo final: 11,250.50',
];

function subir(
  token: string,
  nombre: string,
  contenido: Buffer,
  banco = 'banorte',
) {
  return request(entorno.app.getHttpServer())
    .post('/cargas/estado-cuenta/pdf')
    .set('Cookie', token)
    .field('banco', banco)
    .attach('archivo', contenido, nombre);
}

const luis = () => entorno.token(LUIS, FERRETERIA);

const cuerpo = (res: { body: unknown }) =>
  res.body as { message: string; error?: string };

const totalCargas = () =>
  una<{ n: number }>(ds, `SELECT count(*)::int AS n FROM cargas`);

describe('POST /cargas/estado-cuenta/pdf con Banorte (historia 8.1)', () => {
  it('el PDF sintético cuadra: queda en la zona de espera como banorte', async () => {
    const res = await subir(await luis(), 'banorte.pdf', BANORTE).expect(200);
    expect(res.body).toEqual({
      banco: 'banorte',
      saldoInicial: '10000.00',
      saldoFinal: '11250.50',
      cuadreAutomatico: true,
      movimientosLeidos: 2,
      lineasNoLeidas: 0,
      cargaId: expect.any(String) as unknown,
      estado: 'pendiente_vista_previa',
      yaExistia: false,
    });
    const { cargaId } = res.body as { cargaId: string };
    const carga = await una<Record<string, unknown>>(
      ds,
      `SELECT banco, estado, saldo_inicial, saldo_final FROM cargas WHERE id = $1`,
      [cargaId],
    );
    expect(carga).toMatchObject({
      banco: 'banorte',
      estado: 'pendiente_vista_previa',
      saldo_inicial: '10000.0000',
      saldo_final: '11250.5000',
    });
  });

  it('el banco se reconoce sin importar mayúsculas', async () => {
    const res = await subir(
      await luis(),
      'banorte.pdf',
      BANORTE,
      ' Banorte ',
    ).expect(200);
    expect((res.body as { banco: string }).banco).toBe('banorte');
  });

  it('saldos que no cuadran: 400 y no crea nada', async () => {
    const res = await subir(
      await luis(),
      'no-cuadra.pdf',
      construirPdfSintetico([
        ...ENCABEZADO('MXN'),
        '05-SEP-2026 PAGO PROVEEDOR -2,000.00 8,000.00',
      ]),
    ).expect(400);
    expect(cuerpo(res).error).toBe('saldos_no_cuadran');
    expect((await totalCargas()).n).toBe(0);
  });

  it('moneda distinta de MXN: el mismo código que con BBVA', async () => {
    const res = await subir(
      await luis(),
      'usd.pdf',
      construirPdfSintetico(ENCABEZADO('USD')),
    ).expect(400);
    expect(cuerpo(res).error).toBe('moneda_no_mxn');
  });

  it('PDF sin texto (escaneado): el mismo código que con BBVA', async () => {
    const res = await subir(
      await luis(),
      'escaneado.pdf',
      construirPdfSintetico([]),
    ).expect(400);
    expect(cuerpo(res).error).toBe('pdf_sin_texto');
  });

  it('un PDF de BBVA subido como Banorte: diseño no reconocido, sin cargas', async () => {
    const res = await subir(await luis(), 'bbva.pdf', BBVA).expect(400);
    expect(cuerpo(res).message).toMatch(/empresarial de Banorte/);
    expect((await totalCargas()).n).toBe(0);
  });

  it('un PDF de Banorte subido como BBVA: no se lee con el lector equivocado', async () => {
    const res = await subir(
      await luis(),
      'banorte.pdf',
      BANORTE,
      'bbva',
    ).expect(400);
    expect(cuerpo(res).message).not.toMatch(/Banco no soportado/);
    expect((await totalCargas()).n).toBe(0);
  });
});
