import { DataSource } from 'typeorm';
import { opcionesDataSource } from './data-source';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlAppDePruebas,
  urlDePruebas,
} from './testing/base-de-pruebas';

/**
 * Historia 1.1 (AD-2). `sesiones` es una tabla de clase 2: sin RLS, la lee el
 * guard fuera de la transacción de empresa, y es la única que entrega DELETE a
 * `cuadra_app` (cerrar sesión borra la fila). Se prueba con GRANTs conectado
 * como `cuadra_app`; el dueño del esquema solo migra.
 *
 * AD-2 prevé DELETE también en `invitaciones`, `tokens_recuperacion` y
 * `user_company_roles`. `user_company_roles` lo ganó en la historia 2.6
 * (cambiar y quitar roles); `invitaciones` y `tokens_recuperacion` no lo
 * tienen, y esta prueba afirma la verdad actual: solo `sesiones` y
 * `user_company_roles`. Cuando otra tabla lo gane, se actualiza aquí.
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

describe('permisos de cuadra_app sobre sesiones (historia 1.1)', () => {
  it.each(['SELECT', 'INSERT', 'UPDATE', 'DELETE'])(
    'has_table_privilege(%s) = true',
    async (privilegio) => {
      const { permitido } = await una<{ permitido: boolean }>(
        app,
        `SELECT has_table_privilege('cuadra_app', 'sesiones', $1) AS permitido`,
        [privilegio],
      );
      expect(permitido).toBe(true);
    },
  );

  it('no incluye TRUNCATE', async () => {
    const { permitido } = await una<{ permitido: boolean }>(
      app,
      `SELECT has_table_privilege('cuadra_app', 'sesiones', 'TRUNCATE') AS permitido`,
    );
    expect(permitido).toBe(false);
  });

  it('sesiones no tiene RLS: es identidad, no dominio (AD-2)', async () => {
    const { rls } = await una<{ rls: boolean }>(
      app,
      `SELECT relrowsecurity AS rls FROM pg_class
        WHERE oid = 'public.sesiones'::regclass`,
    );
    expect(rls).toBe(false);
  });

  it('solo la lista conocida da DELETE a cuadra_app (sesiones, user_company_roles y la espera de vista previa, 3.4)', async () => {
    const tablas = await filas<{ tabla: string }>(
      app,
      `SELECT c.relname AS tabla
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
          AND has_table_privilege('cuadra_app', c.oid, 'DELETE')
        ORDER BY c.relname`,
    );
    expect(tablas.map((t) => t.tabla)).toEqual([
      'movimientos_pendientes',
      'sesiones',
      'user_company_roles',
    ]);
  });
});

describe('permisos de cuadra_app sobre user_company_roles (historia 2.6)', () => {
  it('puede borrar filas, y nada más que lo ya concedido', async () => {
    const permiso = async (privilegio: string) =>
      (
        await una<{ permitido: boolean }>(
          app,
          `SELECT has_table_privilege('cuadra_app', 'user_company_roles', $1) AS permitido`,
          [privilegio],
        )
      ).permitido;
    expect(await permiso('DELETE')).toBe(true);
    expect(await permiso('SELECT')).toBe(true);
    expect(await permiso('UPDATE')).toBe(false);
    expect(await permiso('TRUNCATE')).toBe(false);
  });
});
