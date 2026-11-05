import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource, type QueryRunner } from 'typeorm';
import { opcionesDataSource } from './data-source';
import { sembrar } from './seeds/seed';
import {
  crearBaseDePruebas,
  una,
  urlDePruebas,
} from './testing/base-de-pruebas';

/**
 * Historia 4.5 (AC2): `CombinacionesMultiples` ensancha el CHECK de
 * `regla_sin_match` con dos razones nuevas. También fija el `down` de
 * `MonedaNoSoportada` (4.4), que nadie había probado directamente. Corre
 * sobre una base propia con las migraciones hasta la de esta historia, para
 * seguir valiendo aunque se agreguen otras después.
 */

const FERRETERIA = 'FDB190215QK4';
const PREFIJO = '1790713000000';
const NUEVAS = ['combinaciones_multiples', 'candidatos_excedidos'] as const;

const url = new URL(urlDePruebas());
url.pathname = `${url.pathname}_combinaciones`;
const URL_PROPIA = url.toString();

async function borrarBase(): Promise<void> {
  const mantenimiento = new URL(URL_PROPIA);
  const nombre = mantenimiento.pathname.replace(/^\//, '');
  mantenimiento.pathname = '/postgres';
  const ds = await new DataSource({
    type: 'postgres',
    url: mantenimiento.toString(),
  }).initialize();
  try {
    await ds.query(
      `DROP DATABASE IF EXISTS "${nombre.replace(/"/g, '""')}" WITH (FORCE)`,
    );
  } finally {
    await ds.destroy();
  }
}

function migracionesHasta(): string[] {
  const dir = join(__dirname, 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => f.slice(0, PREFIJO.length) <= PREFIJO)
    .sort()
    .map((f) => join(dir, f));
}

async function comoEmpresa<T>(
  ds: DataSource,
  empresa: string,
  cuerpo: (qr: QueryRunner) => Promise<T>,
): Promise<T> {
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await qr.query(`SELECT set_config('app.company_id', $1, true)`, [empresa]);
    const resultado = await cuerpo(qr);
    await qr.commitTransaction();
    return resultado;
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}

let ds: DataSource;
let empresa: string;
let linea = 0;

/** Un movimiento con una razón de «sin propuesta» y su motivo (el CHECK de par). */
const insertar = (regla: string) =>
  comoEmpresa(ds, empresa, async (qr) => {
    linea += 1;
    const { id } = await una<{ id: string }>(
      qr,
      `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto,
                               regla_sin_match, motivo_sin_match, evaluado_at)
       VALUES ($1, $2, '2026-09-02', 'SPEI', 300, $3, 'motivo', now()) RETURNING id`,
      [empresa, linea, regla],
    );
    return id;
  });

const leer = (id: string) =>
  comoEmpresa(ds, empresa, (qr) =>
    una<{
      regla_sin_match: string | null;
      motivo_sin_match: string | null;
      evaluado_at: Date | null;
    }>(
      qr,
      `SELECT regla_sin_match, motivo_sin_match, evaluado_at
         FROM movimientos WHERE id = $1 AND company_id = $2`,
      [id, empresa],
    ),
  );

beforeAll(async () => {
  await borrarBase();
  await crearBaseDePruebas(URL_PROPIA);
  ds = await new DataSource({
    ...opcionesDataSource,
    url: URL_PROPIA,
    migrations: migracionesHasta(),
  }).initialize();
  await ds.runMigrations();
  await sembrar(ds);
  ({ id: empresa } = await una<{ id: string }>(
    ds,
    `SELECT id FROM companies WHERE rfc = $1`,
    [FERRETERIA],
  ));
}, 180_000);

afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
  await borrarBase();
}, 60_000);

describe('migraciones de regla_sin_match (4.4 y 4.5)', () => {
  it('up de CombinacionesMultiples: el CHECK acepta las razones nuevas', async () => {
    for (const regla of NUEVAS) {
      const id = await insertar(regla);
      expect((await leer(id)).regla_sin_match).toBe(regla);
    }
    await expect(insertar('razon_inventada')).rejects.toThrow(
      /ck_movimientos_regla_sin_match/,
    );
  });

  it('down de CombinacionesMultiples limpia las filas nuevas y el CHECK las rechaza; up las vuelve a aceptar', async () => {
    const conNueva = await insertar(NUEVAS[0]);
    const conVieja = await insertar('moneda_no_soportada');

    await ds.undoLastMigration();

    expect(await leer(conNueva)).toEqual({
      regla_sin_match: null,
      motivo_sin_match: null,
      evaluado_at: null,
    });
    expect((await leer(conVieja)).regla_sin_match).toBe('moneda_no_soportada');
    for (const regla of NUEVAS) {
      await expect(insertar(regla)).rejects.toThrow(
        /ck_movimientos_regla_sin_match/,
      );
    }

    await ds.runMigrations();
    for (const regla of NUEVAS) {
      const id = await insertar(regla);
      expect((await leer(id)).regla_sin_match).toBe(regla);
    }
  });

  it('down de MonedaNoSoportada limpia las filas con su razón y el CHECK la rechaza; up la vuelve a aceptar', async () => {
    const conMoneda = await insertar('moneda_no_soportada');
    const conReferencia = await insertar('referencia_ambigua');

    // La de esta historia primero, luego la de 4.4.
    await ds.undoLastMigration();
    await ds.undoLastMigration();

    expect(await leer(conMoneda)).toEqual({
      regla_sin_match: null,
      motivo_sin_match: null,
      evaluado_at: null,
    });
    expect((await leer(conReferencia)).regla_sin_match).toBe(
      'referencia_ambigua',
    );
    await expect(insertar('moneda_no_soportada')).rejects.toThrow(
      /ck_movimientos_regla_sin_match/,
    );

    await ds.runMigrations();
    const id = await insertar('moneda_no_soportada');
    expect((await leer(id)).regla_sin_match).toBe('moneda_no_soportada');
  });
});
