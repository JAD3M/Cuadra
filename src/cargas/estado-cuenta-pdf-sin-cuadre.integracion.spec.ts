import { readFileSync } from 'fs';
import { join } from 'path';
import type { DataSource } from 'typeorm';
import * as lectores from '../bancos/pdf/lectores-pdf';
import type { EstadoCuentaLeido } from '../bancos/pdf/lector-comun';
import { filas, una } from '../database/testing/base-de-pruebas';
import { BancosVistaPrevia } from '../plataforma/bancos-vista-previa.service';
import request from '../testing/supertest-con-origen';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  LUIS,
} from './testing/app-de-cargas';

/**
 * Historia 8.3 [SUPUESTO]: un banco cuyo PDF no trae saldo inicial ni final
 * queda «sin cuadre automático» y exige la vista previa de una persona, en vez
 * de saltarse la comprobación. Los lectores reales siguen exigiendo los saldos,
 * así que aquí se usa un lector de prueba en lugar del de BBVA.
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

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  if (ds?.isInitialized) await limpiar();
  await entorno?.cerrar();
});

const PDF = readFileSync(
  join(__dirname, '..', 'bancos', 'fixtures', 'bbva-sintetico.pdf'),
);

const MOVIMIENTOS: EstadoCuentaLeido['movimientos'] = [
  {
    fecha: '2026-09-05',
    descripcion: 'PAGO PROVEEDOR',
    referencia: null,
    monto: '-250.00',
  },
  {
    fecha: '2026-09-12',
    descripcion: 'DEPOSITO CLIENTE',
    referencia: '4471',
    monto: '1500.50',
  },
];

/** El lector de BBVA pasa a devolver estos saldos, sea cual sea el texto. */
function lectorQueDevuelve(
  saldoInicial: string | null,
  saldoFinal: string | null,
) {
  const real = lectores.lectorPdfDe;
  jest.spyOn(lectores, 'lectorPdfDe').mockImplementation((banco: string) =>
    banco === 'bbva'
      ? () => ({
          saldoInicial,
          saldoFinal,
          movimientos: MOVIMIENTOS,
          lineasNoLeidas: [],
        })
      : real(banco),
  );
}

function subir(token: string) {
  return request(entorno.app.getHttpServer())
    .post('/cargas/estado-cuenta/pdf')
    .set('Cookie', token)
    .field('banco', 'bbva')
    .attach('archivo', PDF, 'sin-saldos.pdf');
}

const luis = () => entorno.token(LUIS, FERRETERIA);

const conteos = () =>
  una<{ cargas: number; pendientes: number }>(
    ds,
    `SELECT (SELECT count(*)::int FROM cargas) AS cargas,
            (SELECT count(*)::int FROM movimientos_pendientes) AS pendientes`,
  );

describe('PDF sin saldos: sin cuadre automático (historia 8.3)', () => {
  it('se guarda en espera, avisa que no cuadró solo y deja los saldos en null', async () => {
    lectorQueDevuelve(null, null);
    const res = await subir(await luis()).expect(200);
    expect(res.body).toMatchObject({
      banco: 'bbva',
      saldoInicial: null,
      saldoFinal: null,
      cuadreAutomatico: false,
      movimientosLeidos: 2,
      estado: 'pendiente_vista_previa',
    });
    const { cargaId } = res.body as { cargaId: string };
    const carga = await una<{
      saldo_inicial: string | null;
      saldo_final: string | null;
    }>(ds, `SELECT saldo_inicial, saldo_final FROM cargas WHERE id = $1`, [
      cargaId,
    ]);
    expect(carga).toEqual({ saldo_inicial: null, saldo_final: null });
    expect((await conteos()).pendientes).toBe(2);
  });

  it('aunque la vista previa del banco esté levantada, espera a una persona', async () => {
    lectorQueDevuelve(null, null);
    jest
      .spyOn(entorno.app.get(BancosVistaPrevia), 'estaLevantado')
      .mockResolvedValue(true);
    const res = await subir(await luis()).expect(200);
    expect((res.body as { estado: string }).estado).toBe(
      'pendiente_vista_previa',
    );
    expect((await conteos()).pendientes).toBe(2);
  });

  it('la persona ve la vista previa sin saldos para decidir', async () => {
    lectorQueDevuelve(null, null);
    const { cargaId } = (await subir(await luis()).expect(200)).body as {
      cargaId: string;
    };
    const vista = await request(entorno.app.getHttpServer())
      .get(`/cargas/${cargaId}/vista-previa`)
      .set('Cookie', await entorno.token(LUIS, FERRETERIA))
      .expect(200);
    expect(vista.body).toMatchObject({ saldoInicial: null, saldoFinal: null });
  });

  it('con un solo saldo no hay cuadre posible: se rechaza completo', async () => {
    lectorQueDevuelve('10000.00', null);
    const antes = await conteos();
    const res = await subir(await luis()).expect(400);
    expect((res.body as { message: string }).message).toMatch(
      /periodo o los saldos/,
    );
    expect(await conteos()).toEqual(antes);
    const bitacora = await filas<{ datos: { motivo: string } }>(
      ds,
      `SELECT datos FROM bitacora WHERE entidad = 'cargas' AND accion = 'rechazar'`,
    );
    expect(bitacora.map((b) => b.datos.motivo)).toEqual(['pdf_no_reconocido']);
  });

  it('con saldos que no cuadran sigue rechazando (el cuadre no se salta)', async () => {
    lectorQueDevuelve('10000.00', '99999.00');
    const res = await subir(await luis()).expect(400);
    expect((res.body as { error: string }).error).toBe('saldos_no_cuadran');
  });

  it('con saldos que cuadran sigue siendo cuadre automático', async () => {
    lectorQueDevuelve('10000.00', '11250.50');
    const res = await subir(await luis()).expect(200);
    expect(res.body).toMatchObject({
      saldoInicial: '10000.00',
      saldoFinal: '11250.50',
      cuadreAutomatico: true,
    });
  });
});
