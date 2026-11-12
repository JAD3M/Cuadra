import { DataSource } from 'typeorm';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlDePruebas,
} from './testing/base-de-pruebas';
import { opcionesDataSource } from './data-source';

/**
 * `down()` con datos (pendiente de 6.2 y 6.3). Base propia: se migra todo, se
 * siembran filas y se deshacen, de una en una, las migraciones de la clase de
 * movimiento (6.3) y de los eventos de la persona en sombra (6.2).
 *  - 6.3: quitar la columna y la función no pierde ni un movimiento ni una
 *    factura; al volver a subir, la clase queda en nulo.
 *  - 6.2: con eventos nuevos el `down` falla a propósito (no borra evidencia) y
 *    no deja nada a medias; sin ellos, deshace y vuelve a subir.
 */

jest.setTimeout(120_000);

const MIGRACION_CLASE = 'ClaseDeMovimiento1790721000000';
const MIGRACION_EVENTOS = 'EventosDeLaPersonaEnSombra1790720000000';

const url = (() => {
  const u = new URL(urlDePruebas());
  u.pathname = `${u.pathname}_down_datos`;
  return u.toString();
})();

let ds: DataSource;
let empresa: string;
let movimientoId: string;
let decisionId: string;

async function borrarBase(): Promise<void> {
  const mantenimiento = new URL(url);
  const nombre = mantenimiento.pathname.replace(/^\//, '');
  mantenimiento.pathname = '/postgres';
  const admin = await new DataSource({
    type: 'postgres',
    url: mantenimiento.toString(),
  }).initialize();
  try {
    await admin.query(
      `DROP DATABASE IF EXISTS "${nombre.replace(/"/g, '""')}" WITH (FORCE)`,
    );
  } finally {
    await admin.destroy();
  }
}

/** La última migración ejecutada, para saber en qué punto está la base. */
const ultima = async () =>
  (
    await una<{ name: string }>(
      ds,
      `SELECT name FROM migrations ORDER BY id DESC LIMIT 1`,
    )
  ).name;

const existeColumnaClase = async () =>
  (
    await filas(
      ds,
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'movimientos' AND column_name = 'clase'`,
    )
  ).length === 1;

const existeFuncion = async () =>
  (
    await filas(
      ds,
      `SELECT 1 FROM pg_proc WHERE proname = 'fracciones_por_empresa'`,
    )
  ).length === 1;

const conteo = async (tabla: string) =>
  Number(
    (await una<{ n: string }>(ds, `SELECT count(*) AS n FROM ${tabla}`)).n,
  );

beforeAll(async () => {
  await borrarBase();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();

  empresa = (
    await una<{ id: string }>(
      ds,
      `INSERT INTO companies (rfc, razon_social) VALUES ('DWN010101AAA', 'Empresa down') RETURNING id`,
    )
  ).id;
  // El dueño de la base también está sujeto a RLS FORCE: se fija la empresa.
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await qr.query(`SELECT set_config('app.company_id', $1, true)`, [empresa]);
    movimientoId = (
      await una<{ id: string }>(
        qr,
        `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto, clase)
         VALUES ($1, 1, '2026-09-02', 'COMISION', '-10.00', 'comision') RETURNING id`,
        [empresa],
      )
    ).id;
    await qr.query(
      `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto)
       VALUES ($1, 2, '2026-09-02', 'OTRO', '10.00')`,
      [empresa],
    );
    await qr.query(
      `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, fecha_emision,
                         tipo_comprobante, subtotal, total, metodo_pago, xml_raw)
       VALUES ($1, '88888888-8888-8888-8888-888888888888', 'AAA010101AAA', 'DWN010101AAA',
               '2026-09-01T10:00:00', 'I', 100, 116, 'PPD', '{"_xml":"<x/>"}'::jsonb)`,
      [empresa],
    );
    decisionId = (
      await una<{ id: string }>(
        qr,
        `INSERT INTO decisiones (company_id, movimiento_id, tipo, estado, origen, huella_conjunto)
         VALUES ($1, $2, 'conciliacion', 'propuesta', 'regla', 'v1:down-datos') RETURNING id`,
        [empresa, movimientoId],
      )
    ).id;
    await qr.query(
      `INSERT INTO evidencia_sombra (company_id, decision_id, evento) VALUES ($1,$2,'habria_cerrado')`,
      [empresa, decisionId],
    );
    await qr.query(
      `INSERT INTO evidencia_sombra (company_id, decision_id, evento) VALUES ($1,$2,'desmarco')`,
      [empresa, decisionId],
    );
    await qr.commitTransaction();
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}, 180_000);

afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
  await borrarBase();
}, 60_000);

/** Cuenta con la empresa fijada: RLS FORCE también alcanza al dueño. */
async function contar(tabla: string): Promise<number> {
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await qr.query(`SELECT set_config('app.company_id', $1, true)`, [empresa]);
    const { n } = await una<{ n: string }>(
      qr,
      `SELECT count(*) AS n FROM ${tabla} WHERE company_id = $1`,
      [empresa],
    );
    return Number(n);
  } finally {
    await qr.rollbackTransaction();
    await qr.release();
  }
}

describe('down() con datos', () => {
  it('antes de deshacer, la base está al día con los datos sembrados', async () => {
    expect(await ultima()).toBe(MIGRACION_CLASE);
    expect(await existeColumnaClase()).toBe(true);
    expect(await existeFuncion()).toBe(true);
    expect(await contar('movimientos')).toBe(2);
    expect(await contar('cfdi')).toBe(1);
    expect(await contar('evidencia_sombra')).toBe(2);
  });

  it('6.3: deshacer quita la columna y la función sin perder movimientos ni facturas, y subir de nuevo deja la clase en nulo', async () => {
    await ds.undoLastMigration();

    expect(await ultima()).toBe(MIGRACION_EVENTOS);
    expect(await existeColumnaClase()).toBe(false);
    expect(await existeFuncion()).toBe(false);
    expect(await contar('movimientos')).toBe(2);
    expect(await contar('cfdi')).toBe(1);

    await ds.runMigrations();

    expect(await ultima()).toBe(MIGRACION_CLASE);
    expect(await existeColumnaClase()).toBe(true);
    expect(await existeFuncion()).toBe(true);
    expect(await contar('movimientos')).toBe(2);
    // La clase no es recuperable al bajar y subir: vuelve a nulo.
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    await qr.query(`SELECT set_config('app.company_id', $1, true)`, [empresa]);
    const { n } = await una<{ n: string }>(
      qr,
      `SELECT count(*) AS n FROM movimientos WHERE clase IS NOT NULL`,
    );
    await qr.rollbackTransaction();
    await qr.release();
    expect(Number(n)).toBe(0);
  });

  it('6.2: con eventos de la persona el down falla y no deja nada a medias', async () => {
    await ds.undoLastMigration(); // 6.3, otra vez
    expect(await ultima()).toBe(MIGRACION_EVENTOS);

    await expect(ds.undoLastMigration()).rejects.toMatchObject({
      code: '23514',
    });

    // Sigue en 6.2, con la evidencia intacta y el CHECK ancho.
    expect(await ultima()).toBe(MIGRACION_EVENTOS);
    expect(await contar('evidencia_sombra')).toBe(2);
    expect(
      (
        await una<{ def: string }>(
          ds,
          `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
            WHERE conname = 'ck_evidencia_sombra_evento'`,
        )
      ).def,
    ).toContain('desmarco');
  });

  it('6.2: sin eventos nuevos el down deshace, y subir de nuevo restaura el CHECK ancho', async () => {
    // Quitar la evidencia es una decisión manual (docs/despliegue.md): aquí la
    // hace el dueño de la base, que es quien migra.
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    await qr.query(`SELECT set_config('app.company_id', $1, true)`, [empresa]);
    await qr.query(
      `DELETE FROM evidencia_sombra WHERE evento <> 'habria_cerrado'`,
    );
    await qr.commitTransaction();
    await qr.release();

    await ds.undoLastMigration();
    const estrecho = (
      await una<{ def: string }>(
        ds,
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE conname = 'ck_evidencia_sombra_evento'`,
      )
    ).def;
    expect(estrecho).not.toContain('desmarco');
    expect(await contar('evidencia_sombra')).toBe(1);

    await ds.runMigrations();
    expect(await ultima()).toBe(MIGRACION_CLASE);
    expect(
      (
        await una<{ def: string }>(
          ds,
          `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
            WHERE conname = 'ck_evidencia_sombra_evento'`,
        )
      ).def,
    ).toContain('desmarco');
    expect(await conteo('companies')).toBeGreaterThan(0);
  });
});
