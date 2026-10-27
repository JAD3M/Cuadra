import { DataSource } from 'typeorm';
import { opcionesDataSource } from '../database/data-source';
import {
  crearBaseDePruebas,
  filas,
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

  // Historia 2.7: un GRANT por columna no aparece en has_table_privilege.
  it('ninguna columna de bitacora admite UPDATE para cuadra_app', async () => {
    const columnas = await filas<{ column_name: string }>(
      app,
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bitacora'`,
    );
    expect(columnas.length).toBeGreaterThan(0);
    for (const { column_name } of columnas) {
      const { permitido } = await una<{ permitido: boolean }>(
        app,
        `SELECT has_column_privilege('cuadra_app', 'bitacora', $1, 'UPDATE') AS permitido`,
        [column_name],
      );
      expect({ column_name, permitido }).toEqual({
        column_name,
        permitido: false,
      });
    }
  });

  // Dueño y superusuario saltan los GRANTs: cuadra_app no debe serlo.
  it('cuadra_app no es dueño de bitacora ni superusuario', async () => {
    const { dueno, superusuario } = await una<{
      dueno: string;
      superusuario: boolean;
    }>(
      app,
      `SELECT (SELECT tableowner FROM pg_tables
                WHERE schemaname = 'public' AND tablename = 'bitacora') AS dueno,
              (SELECT rolsuper FROM pg_roles WHERE rolname = 'cuadra_app') AS superusuario`,
    );
    expect(dueno).not.toBe('cuadra_app');
    expect(superusuario).toBe(false);
  });
});
