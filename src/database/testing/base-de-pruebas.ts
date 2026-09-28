// src/database/testing/base-de-pruebas.ts
import { DataSource } from 'typeorm';

/** `query()` devuelve `any`; estos ayudantes le ponen tipo en un solo lugar. */
export interface Consultable {
  query(sql: string, parametros?: unknown[]): Promise<unknown>;
}

export async function filas<T>(
  origen: Consultable,
  sql: string,
  parametros?: unknown[],
): Promise<T[]> {
  return (await origen.query(sql, parametros)) as T[];
}

export async function una<T>(
  origen: Consultable,
  sql: string,
  parametros?: unknown[],
): Promise<T> {
  const [fila] = await filas<T>(origen, sql, parametros);
  return fila;
}

/**
 * Las pruebas de esquema borran y recrean todas las tablas, así que nunca
 * deben apuntar a la base de desarrollo. Corren contra `<base>_test`, que se
 * crea sola la primera vez.
 */
export function urlDePruebas(): string {
  return aBaseDePruebas('DATABASE_URL');
}

/**
 * Misma base de pruebas, pero como `cuadra_app` (CU-04b): la conexión con la
 * que corre la app, sujeta a RLS. La de `urlDePruebas()` es la del dueño y
 * solo sirve para migrar y sembrar.
 */
export function urlAppDePruebas(): string {
  return aBaseDePruebas('DATABASE_APP_URL');
}

function aBaseDePruebas(variable: 'DATABASE_URL' | 'DATABASE_APP_URL'): string {
  const explicita = process.env[`${variable}_TEST`];
  if (explicita) return explicita;

  const base = process.env[variable];
  if (!base) {
    throw new Error(
      `Falta ${variable} (o ${variable}_TEST) para las pruebas de base.`,
    );
  }
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/^\//, '')}_test`;
  return url.toString();
}

/** `CREATE DATABASE` no admite IF NOT EXISTS, así que se consulta antes. */
export async function crearBaseDePruebas(url: string): Promise<void> {
  const destino = new URL(url);
  const nombre = destino.pathname.replace(/^\//, '');

  const mantenimiento = new URL(url);
  mantenimiento.pathname = '/postgres';

  const ds = new DataSource({
    type: 'postgres',
    url: mantenimiento.toString(),
  });
  await ds.initialize();
  try {
    const existe = await filas<{ ok: number }>(
      ds,
      'SELECT 1 AS ok FROM pg_database WHERE datname = $1',
      [nombre],
    );
    if (existe.length === 0) {
      // El nombre sale de DATABASE_URL, no de entrada de usuario, y un
      // identificador no se puede parametrizar: se escapan las comillas.
      await ds.query(`CREATE DATABASE "${nombre.replace(/"/g, '""')}"`);
    }
  } finally {
    await ds.destroy();
  }
}
