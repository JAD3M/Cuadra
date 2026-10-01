import { DataSource } from 'typeorm';
import { opcionesDataSource } from './data-source';
import { sembrar } from './seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlDePruebas,
} from './testing/base-de-pruebas';

/**
 * Migración EmailSinMayusculas. Los usuarios del seed ya están en minúsculas
 * y no prueban nada: cada caso revierte la migración, mete a mano un email
 * con mayúsculas y la vuelve a correr.
 */

let ds: DataSource;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({
    ...opcionesDataSource,
    url,
  }).initialize();
  await ds.runMigrations();
  await sembrar(ds);
}, 60_000);

afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
});

async function indicesDeUsers(): Promise<string[]> {
  const indices = await filas<{ indexname: string }>(
    ds,
    `SELECT indexname FROM pg_indexes WHERE tablename = 'users' ORDER BY 1`,
  );
  return indices.map((i) => i.indexname);
}

async function insertarUsuario(email: string): Promise<void> {
  await ds.query(
    `INSERT INTO users (email, nombre, password_hash) VALUES ($1, 'Prueba', 'x')`,
    [email],
  );
}

/**
 * Ya no es la última migración: se revierten las posteriores y luego ella.
 * El `runMigrations()` de cada `finally` las vuelve a aplicar todas.
 */
async function revertirEmailSinMayusculas(): Promise<void> {
  // cuadra_test sobrevive entre suites: una fila 'acceso_denegado' que dejó
  // otra impide revertir AccesoDenegadoEnBitacora.
  await ds.query('TRUNCATE bitacora');
  for (;;) {
    const ultima = await una<{ name: string } | undefined>(
      ds,
      'SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1',
    );
    if (!ultima) throw new Error('EmailSinMayusculas no estaba aplicada');
    await ds.undoLastMigration();
    if (ultima.name === 'EmailSinMayusculas1790205607191') return;
  }
}

async function borrarUsuariosDePrueba(): Promise<void> {
  await ds.query(`DELETE FROM users WHERE nombre = 'Prueba'`);
}

it('normaliza los emails existentes y cambia el UNIQUE plano por lower(email)', async () => {
  await revertirEmailSinMayusculas();
  expect(await indicesDeUsers()).toContain('ux_users_email');
  try {
    await insertarUsuario('  Mixto@Ejemplo.MX ');
    await ds.runMigrations();

    const { email } = await una<{ email: string }>(
      ds,
      `SELECT email FROM users WHERE nombre = 'Prueba'`,
    );
    expect(email).toBe('mixto@ejemplo.mx');
    expect(await indicesDeUsers()).toContain('ux_users_email_lower');
    expect(await indicesDeUsers()).not.toContain('ux_users_email');

    await expect(insertarUsuario('MIXTO@ejemplo.mx')).rejects.toThrow(
      /ux_users_email_lower/,
    );
  } finally {
    await borrarUsuariosDePrueba();
    await ds.runMigrations();
  }
});

it('aborta sin tocar nada si dos emails chocan al normalizar', async () => {
  await revertirEmailSinMayusculas();
  try {
    await insertarUsuario('choque@ejemplo.mx');
    await insertarUsuario('CHOQUE@ejemplo.mx');

    await expect(ds.runMigrations()).rejects.toThrow(/chocan/);
    expect(await indicesDeUsers()).toContain('ux_users_email');
    const emails = await filas<{ email: string }>(
      ds,
      `SELECT email FROM users WHERE nombre = 'Prueba' ORDER BY email`,
    );
    expect(emails.map((e) => e.email)).toEqual([
      'CHOQUE@ejemplo.mx',
      'choque@ejemplo.mx',
    ]);
  } finally {
    await borrarUsuariosDePrueba();
    await ds.runMigrations();
  }
});

it('el seed sigue siendo idempotente con ON CONFLICT (lower(email))', async () => {
  const antes = await una<{ n: number }>(
    ds,
    `SELECT count(*)::int AS n FROM users`,
  );
  await sembrar(ds);
  await sembrar(ds);
  const despues = await una<{ n: number }>(
    ds,
    `SELECT count(*)::int AS n FROM users`,
  );
  expect(despues.n).toBe(antes.n);
});
