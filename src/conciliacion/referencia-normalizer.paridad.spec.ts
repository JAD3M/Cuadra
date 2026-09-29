// src/conciliacion/referencia-normalizer.paridad.spec.ts
import { DataSource } from 'typeorm';
import { opcionesDataSource } from '../database/data-source';
import { sembrar } from '../database/seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { FIXTURES_REFERENCIA } from './referencia-fixtures';
import { normalizarReferencia } from './referencia-normalizer';

/**
 * RN-4. Guardia de que el normalizador de TypeScript y la función SQL
 * `normalizar_referencia` (que genera `movimientos.referencia_norm`)
 * implementan la misma especificación. Si divergen se corrige la
 * implementación, nunca el caso.
 */

let ds: DataSource;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  await sembrar(ds);
}, 60_000);

afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
});

async function sql(texto: string | null): Promise<string | null> {
  const { r } = await una<{ r: string | null }>(
    ds,
    `SELECT normalizar_referencia($1) AS r`,
    [texto],
  );
  return r;
}

/** Generador congruencial lineal: mismas cadenas en cada corrida. */
function generarCadenas(cantidad: number): string[] {
  const alfabeto = [
    ...'0000123456789',
    ...'abcXYZfF',
    ...' -_/.,#',
    ...'ñáÜß€１٣',
    '🎉',
    '\t',
  ];
  let semilla = 20260929;
  const siguiente = (tope: number): number => {
    semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0;
    return semilla % tope;
  };
  return Array.from({ length: cantidad }, () => {
    const largo = 1 + siguiente(14);
    let s = '';
    for (let i = 0; i < largo; i++) s += alfabeto[siguiente(alfabeto.length)];
    return s;
  });
}

describe('paridad TS/SQL de la normalización', () => {
  it.each(FIXTURES_REFERENCIA)('fixture %j', async (entrada, esperado) => {
    expect(await sql(entrada)).toBe(esperado);
    expect(normalizarReferencia(entrada)).toBe(esperado);
  });

  it('coincide en 200 cadenas pseudoaleatorias', async () => {
    const divergencias: unknown[] = [];
    for (const cadena of generarCadenas(200)) {
      const enSql = await sql(cadena);
      const enTs = normalizarReferencia(cadena);
      if (enSql !== enTs) divergencias.push({ cadena, enSql, enTs });
    }
    expect(divergencias).toEqual([]);
  });

  it('llena referencia_norm sin que el insert la mencione', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const { id: empresa } = await una<{ id: string }>(
        qr,
        `SELECT id FROM companies WHERE rfc = 'FDB190215QK4'`,
      );
      let linea = 0;
      for (const [entrada, esperado] of FIXTURES_REFERENCIA) {
        await qr.query(
          `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto)
           VALUES ($1, $2, '2026-09-02', 'SPEI', $3, 10)`,
          [empresa, linea++, entrada],
        );
        expect(esperado).toBe(normalizarReferencia(entrada));
      }
      const leidas = await filas<{ referencia: string | null; norm: string }>(
        qr,
        `SELECT referencia, referencia_norm AS norm FROM movimientos
          WHERE company_id = $1 ORDER BY linea_numero`,
        [empresa],
      );
      expect(leidas.map((f) => f.norm)).toEqual(
        FIXTURES_REFERENCIA.map(([, esperado]) => esperado),
      );
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });
});
