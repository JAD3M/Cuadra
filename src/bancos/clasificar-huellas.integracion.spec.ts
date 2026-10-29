import { DataSource, type QueryRunner } from 'typeorm';
import { opcionesDataSource } from '../database/data-source';
import { sembrar } from '../database/seeds/seed';
import {
  crearBaseDePruebas,
  una,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { clasificarPorHuella } from './clasificar-huellas';
import { huellaMovimiento } from './huella-movimiento';

/**
 * Historia 3.5 (T3): el clasificador contra `movimientos` reales, en todos
 * los estados y sin cruzar empresas.
 */

let ds: DataSource;
let empresa: string;
let otra: string;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  await sembrar(ds);
  ({ id: empresa } = await una<{ id: string }>(
    ds,
    `SELECT id FROM companies WHERE rfc = 'FDB190215QK4'`,
  ));
  ({ id: otra } = await una<{ id: string }>(
    ds,
    `SELECT id FROM companies WHERE rfc = 'TCU170830R52'`,
  ));
}, 60_000);

afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
});

const CUENTA = '0123456789';
const mov = (fecha: string, monto: string, referencia: string | null) => ({
  cuenta: CUENTA,
  fecha,
  monto,
  referencia,
});

async function conTransaccion(
  cuerpo: (qr: QueryRunner) => Promise<void>,
): Promise<void> {
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await cuerpo(qr);
  } finally {
    await qr.rollbackTransaction();
    await qr.release();
  }
}

let linea = 0;
async function insertar(
  qr: QueryRunner,
  company: string,
  m: ReturnType<typeof mov>,
  estado: string,
) {
  await qr.query(
    `INSERT INTO movimientos
       (company_id, linea_numero, fecha, descripcion, referencia, monto, cuenta, estado, huella)
     VALUES ($1, $2, $3, 'SPEI', $4, $5, $6, $7, $8)`,
    [
      company,
      linea++,
      m.fecha,
      m.referencia,
      m.monto,
      m.cuenta,
      estado,
      huellaMovimiento(m),
    ],
  );
}

describe('clasificarPorHuella', () => {
  it('cuenta como existente un movimiento en cualquier estado', async () => {
    await conTransaccion(async (qr) => {
      const estados = [
        'abierto',
        'conciliado',
        'descartado',
        'pendiente_revision',
      ];
      const lote = estados.map((_, i) => mov('2026-09-02', `${100 + i}`, 'R1'));
      for (const [i, estado] of estados.entries()) {
        await insertar(qr, empresa, lote[i], estado);
      }
      const clases = await clasificarPorHuella(qr.manager, empresa, lote);
      expect(clases).toEqual(['exacto', 'exacto', 'exacto', 'exacto']);
    });
  });

  it('exacto, dudoso y nuevo en un mismo lote', async () => {
    await conTransaccion(async (qr) => {
      await insertar(
        qr,
        empresa,
        mov('2026-09-02', '250', 'FAC-001'),
        'abierto',
      );
      await insertar(
        qr,
        empresa,
        mov('2026-09-03', '80', 'FAC-002'),
        'abierto',
      );
      const clases = await clasificarPorHuella(qr.manager, empresa, [
        mov('2026-09-02', '250.0000', 'FAC-001'),
        mov('2026-09-03', '80', 'fac 002'),
        mov('2026-09-04', '10', 'FAC-003'),
      ]);
      expect(clases).toEqual(['exacto', 'dudoso', 'nuevo']);
    });
  });

  it('multiplicidad: 1 en la base y 2 en el archivo', async () => {
    await conTransaccion(async (qr) => {
      await insertar(qr, empresa, mov('2026-09-02', '50', null), 'conciliado');
      const clases = await clasificarPorHuella(qr.manager, empresa, [
        mov('2026-09-02', '50', null),
        mov('2026-09-02', '50', null),
      ]);
      expect(clases).toEqual(['exacto', 'nuevo']);
    });
  });

  it('no mira movimientos de otra empresa', async () => {
    await conTransaccion(async (qr) => {
      await insertar(qr, otra, mov('2026-09-02', '77', 'R9'), 'abierto');
      const clases = await clasificarPorHuella(qr.manager, empresa, [
        mov('2026-09-02', '77', 'R9'),
      ]);
      expect(clases).toEqual(['nuevo']);
    });
  });

  it('lote vacío: no consulta y devuelve vacío', async () => {
    await conTransaccion(async (qr) => {
      expect(await clasificarPorHuella(qr.manager, empresa, [])).toEqual([]);
    });
  });
});
