// src/conciliacion/huella-conjunto.paridad.spec.ts
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { opcionesDataSource } from '../database/data-source';
import { sembrar } from '../database/seeds/seed';
import {
  crearBaseDePruebas,
  una,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { huellaConjunto } from './huella-conjunto';

/**
 * Historia 4.1 (AD-4). Guardia de que `huellaConjunto` (TypeScript) y la
 * función SQL `huella_conjunto` dan la misma huella para el mismo conjunto de
 * facturas. Si divergen se corrige la implementación, nunca el caso.
 *
 * Decisiones que fijan estas pruebas:
 * - El orden de entrada no importa: se ordena por el valor del uuid.
 * - El tipo `uuid` de Postgres normaliza a minúsculas, así que el espejo TS
 *   también: mayúsculas y minúsculas dan la misma huella.
 * - Los duplicados se conservan (no se deduplica): la capa que arma la
 *   decisión es la responsable de no repetir facturas.
 * - La lista vacía es válida: es la huella de 'v1|'.
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

const sqlHuella = async (ids: string[]): Promise<string> =>
  (
    await una<{ h: string }>(ds, `SELECT huella_conjunto($1::uuid[]) AS h`, [
      ids,
    ])
  ).h;

const A = '00000000-0000-4000-8000-00000000000a';
const B = '7f3c1e52-9a4d-4b1e-8c33-0123456789ab';
const C = 'ffffffff-ffff-4fff-bfff-ffffffffffff';

interface Caso {
  nombre: string;
  ids: string[];
}

const CASOS: readonly Caso[] = [
  { nombre: 'lista vacía', ids: [] },
  { nombre: 'un solo id', ids: [A] },
  { nombre: 'dos ids ya ordenados', ids: [A, B] },
  { nombre: 'dos ids desordenados', ids: [B, A] },
  { nombre: 'tres ids desordenados', ids: [C, A, B] },
  { nombre: 'duplicados', ids: [B, B, A] },
  { nombre: 'mayúsculas', ids: [B.toUpperCase(), A.toUpperCase()] },
  { nombre: 'mayúsculas y minúsculas mezcladas', ids: [A, B.toUpperCase(), C] },
];

/** Generador congruencial lineal: mismos uuid en cada corrida. */
function generarListas(cantidad: number): string[][] {
  let semilla = 20261104;
  const siguiente = (tope: number): number => {
    semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0;
    return semilla % tope;
  };
  const hex = (n: number): string =>
    Array.from({ length: n }, () => siguiente(16).toString(16)).join('');
  const uuid = (): string =>
    `${hex(8)}-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(12)}`;
  return Array.from({ length: cantidad }, () => {
    const largo = siguiente(6);
    const ids = Array.from({ length: largo }, uuid);
    if (largo > 1 && siguiente(5) === 0) ids.push(ids[0]);
    return siguiente(3) === 0 ? ids.map((i) => i.toUpperCase()) : ids;
  });
}

describe('paridad TS/SQL de la huella del conjunto', () => {
  it.each(CASOS)('función SQL = TS: $nombre', async ({ ids }) => {
    expect(await sqlHuella(ids)).toBe(huellaConjunto(ids));
  });

  it('coincide en 200 listas pseudoaleatorias de uuid', async () => {
    const divergencias: unknown[] = [];
    for (const ids of generarListas(200)) {
      const enSql = await sqlHuella(ids);
      const enTs = huellaConjunto(ids);
      if (enSql !== enTs) divergencias.push({ ids, enSql, enTs });
    }
    expect(divergencias).toEqual([]);
  });

  it('la lista vacía tiene huella v1 y es la misma en SQL y TS', async () => {
    const h = await sqlHuella([]);
    expect(h).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(huellaConjunto([])).toBe(h);
  });

  it('mayúsculas y minúsculas dan la misma huella', async () => {
    expect(huellaConjunto([B.toUpperCase(), A])).toBe(huellaConjunto([B, A]));
    expect(await sqlHuella([B.toUpperCase(), A])).toBe(await sqlHuella([B, A]));
  });

  it('las permutaciones de un mismo conjunto dan la misma huella', async () => {
    const permutaciones = [
      [A, B, C],
      [A, C, B],
      [B, A, C],
      [B, C, A],
      [C, A, B],
      [C, B, A],
    ];
    const ts = new Set(permutaciones.map((p) => huellaConjunto(p)));
    expect(ts.size).toBe(1);
    const sql = new Set<string>();
    for (const p of permutaciones) sql.add(await sqlHuella(p));
    expect(sql.size).toBe(1);
  });

  it('conjuntos distintos dan huellas distintas', () => {
    const conjuntos = [[], [A], [B], [A, B], [A, C], [A, B, C], [A, A]];
    const huellas = new Set(conjuntos.map((c) => huellaConjunto(c)));
    expect(huellas.size).toBe(conjuntos.length);
    const aleatorios = Array.from({ length: 50 }, () => [randomUUID()]);
    const unicas = new Set(aleatorios.map((c) => huellaConjunto(c)));
    expect(unicas.size).toBe(aleatorios.length);
  });

  it('no muta la lista de entrada', () => {
    const ids = [C, A, B];
    huellaConjunto(ids);
    expect(ids).toEqual([C, A, B]);
  });
});
