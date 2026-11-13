import type { DataSource } from 'typeorm';
import { construirPdfSintetico } from '../bancos/pdf/pdf-sintetico';
import { filas, una } from '../database/testing/base-de-pruebas';
import {
  BANCOS_DE_PRUEBA,
  lineasDeEstadoCuenta,
  MES_DE_PRUEBA,
  type BancoDePrueba,
} from '../testing/estados-de-cuenta-de-prueba';
import request from '../testing/supertest-con-origen';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  LUIS,
} from './testing/app-de-cargas';

/**
 * Historia 8.3: los tres bancos con PDF pasan por el mismo cuadre y el mismo
 * rechazo completo. SINTÉTICO [SUPUESTO]: los PDF los arma
 * `estados-de-cuenta-de-prueba.ts`, no son estados de cuenta reales.
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

function subir(token: string, banco: BancoDePrueba, saldoFinal?: string) {
  const pdf = construirPdfSintetico(
    lineasDeEstadoCuenta(banco, { ...MES_DE_PRUEBA, saldoFinal }),
  );
  return request(entorno.app.getHttpServer())
    .post('/cargas/estado-cuenta/pdf')
    .set('Cookie', token)
    .field('banco', banco)
    .attach('archivo', pdf, `${banco}.pdf`);
}

const luis = () => entorno.token(LUIS, FERRETERIA);

const conteos = () =>
  una<{ cargas: number; pendientes: number; movimientos: number }>(
    ds,
    `SELECT (SELECT count(*)::int FROM cargas) AS cargas,
            (SELECT count(*)::int FROM movimientos_pendientes) AS pendientes,
            (SELECT count(*)::int FROM movimientos) AS movimientos`,
  );

describe.each(BANCOS_DE_PRUEBA)('PDF de %s (historia 8.3)', (banco) => {
  it('cuadra: queda en la zona de espera con sus saldos', async () => {
    const res = await subir(await luis(), banco).expect(200);
    expect(res.body).toMatchObject({
      banco,
      saldoInicial: '10000.00',
      saldoFinal: '11000.50',
      movimientosLeidos: 3,
      lineasNoLeidas: 0,
      estado: 'pendiente_vista_previa',
    });
  });

  it('con saldos que no cuadran: rechazo completo, sin dejar nada a medias', async () => {
    const antes = await conteos();
    const res = await subir(await luis(), banco, '11100.50').expect(400);
    expect(res.body).toMatchObject({
      error: 'saldos_no_cuadran',
      saldoFinal: '11100.50',
      saldoEsperado: '11000.5',
      diferencia: '100',
    });
    expect(await conteos()).toEqual(antes);
    const bitacora = await filas<{ datos: { banco: string; motivo: string } }>(
      ds,
      `SELECT datos FROM bitacora
        WHERE entidad = 'cargas' AND accion = 'rechazar'`,
    );
    expect(bitacora.map((b) => b.datos)).toEqual([
      expect.objectContaining({ banco, motivo: 'saldos_no_cuadran' }),
    ]);
  });
});

describe('el rechazo por saldos que no cuadran es el mismo en los tres bancos', () => {
  it('mismo código, mismo mensaje y misma forma de cuerpo', async () => {
    const cuerpos: object[] = [];
    for (const banco of BANCOS_DE_PRUEBA) {
      cuerpos.push(
        (await subir(await luis(), banco, '11100.50').expect(400))
          .body as object,
      );
    }
    expect(cuerpos).toHaveLength(3);
    expect(cuerpos[1]).toEqual(cuerpos[0]);
    expect(cuerpos[2]).toEqual(cuerpos[0]);
  });
});
