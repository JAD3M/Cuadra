import { DataSource } from 'typeorm';
import { opcionesDataSource } from '../database/data-source';
import {
  crearBaseDePruebas,
  una,
  urlAppDePruebas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';

/**
 * CU-16: la bitácora es de solo lectura para la app. Se prueba con GRANTs
 * (sin trigger, D3) conectado como `cuadra_app`. Los errores de privilegio
 * saltan antes que RLS, así que no hace falta fijar la empresa. Queda fuera
 * el dueño del esquema, que migra y limpia tablas en las pruebas.
 */

let duenio: DataSource;
let app: DataSource;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  duenio = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await duenio.runMigrations();
  app = await new DataSource({
    type: 'postgres',
    url: urlAppDePruebas(),
  }).initialize();
}, 60_000);

afterAll(async () => {
  if (app?.isInitialized) await app.destroy();
  if (duenio?.isInitialized) await duenio.destroy();
});

describe('bitácora de solo lectura para cuadra_app (CU-16)', () => {
  it.each([
    ['UPDATE', `UPDATE bitacora SET accion = 'crear'`],
    ['DELETE', 'DELETE FROM bitacora'],
    ['TRUNCATE', 'TRUNCATE bitacora'],
  ])('%s se rechaza con 42501', async (_operacion, sql) => {
    await expect(app.query(sql)).rejects.toMatchObject({ code: '42501' });
  });

  it.each([
    ['UPDATE', false],
    ['DELETE', false],
    ['TRUNCATE', false],
    ['SELECT', true],
    ['INSERT', true],
  ])('has_table_privilege(%s) = %s', async (privilegio, esperado) => {
    const { permitido } = await una<{ permitido: boolean }>(
      app,
      `SELECT has_table_privilege('cuadra_app', 'bitacora', $1) AS permitido`,
      [privilegio],
    );
    expect(permitido).toBe(esperado);
  });
});
