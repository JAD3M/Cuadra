// src/bancos/huella-movimiento.paridad.spec.ts
import { DataSource } from 'typeorm';
import { opcionesDataSource } from '../database/data-source';
import { SQL_BACKFILL_HUELLA } from '../database/migrations/1790710400000-HuellaMovimientos';
import { sembrar } from '../database/seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';
import { huellaMovimiento } from './huella-movimiento';

/**
 * FR-65. Guardia de que `huellaMovimiento` (TypeScript) y la función SQL
 * `huella_movimiento` (backfill de `movimientos.huella`) producen la misma
 * huella. Si divergen se corrige la implementación, nunca el caso.
 */

let ds: DataSource;
let empresa: string;

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
}, 60_000);

afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
});

interface Caso {
  nombre: string;
  cuenta: string | null;
  fecha: string;
  monto: string;
  referencia: string | null;
}

const CASOS: readonly Caso[] = [
  {
    nombre: 'caso típico',
    cuenta: '0123456789',
    fecha: '2026-09-02',
    monto: '250.0000',
    referencia: 'FAC-0012',
  },
  {
    nombre: 'cuenta nula y referencia nula',
    cuenta: null,
    fecha: '2026-09-02',
    monto: '10.5000',
    referencia: null,
  },
  {
    nombre: 'cuenta vacía y referencia vacía',
    cuenta: '',
    fecha: '2026-01-31',
    monto: '1.0000',
    referencia: '',
  },
  {
    nombre: 'cuenta con espacios y símbolos',
    cuenta: ' 01-23 4/5.6*7 ',
    fecha: '2026-09-02',
    monto: '-99.9900',
    referencia: 'SPEI 12345',
  },
  {
    nombre: 'cuenta con minúsculas y letras',
    cuenta: 'mx-ab12 cd',
    fecha: '2026-12-31',
    monto: '1000000.0000',
    referencia: 'x',
  },
  {
    nombre: 'cuenta solo símbolos',
    cuenta: '--// ',
    fecha: '2026-02-28',
    monto: '0.0001',
    referencia: 'A',
  },
  {
    nombre: 'cuenta con acentos y no ASCII',
    cuenta: 'ñ12á3€',
    fecha: '2026-09-02',
    monto: '5.0000',
    referencia: 'Straße 007',
  },
  {
    nombre: 'referencia con ceros a la izquierda',
    cuenta: '123',
    fecha: '2026-09-02',
    monto: '300.0000',
    referencia: '0001001',
  },
  {
    nombre: 'referencia con letras y ceros',
    cuenta: '123',
    fecha: '2026-09-02',
    monto: '300.0000',
    referencia: 'a-0001001',
  },
  {
    nombre: 'referencia solo ceros',
    cuenta: '123',
    fecha: '2026-09-02',
    monto: '300.0000',
    referencia: '000',
  },
  {
    nombre: 'referencia solo símbolos',
    cuenta: '123',
    fecha: '2026-09-02',
    monto: '300.0000',
    referencia: '-/.,;',
  },
  {
    nombre: 'referencia con emoji y espacios',
    cuenta: '123',
    fecha: '2026-09-02',
    monto: '300.0000',
    referencia: '🎉 0123 🎉',
  },
  {
    nombre: 'monto entero escrito sin decimales',
    cuenta: '123',
    fecha: '2026-09-02',
    monto: '250',
    referencia: 'R1',
  },
  {
    nombre: 'monto con un decimal',
    cuenta: '123',
    fecha: '2026-09-02',
    monto: '250.5',
    referencia: 'R1',
  },
  {
    nombre: 'monto negativo grande',
    cuenta: '123',
    fecha: '2026-09-02',
    monto: '-99999999999999.9999',
    referencia: 'R1',
  },
];

const sqlHuella = async (c: Caso): Promise<string> =>
  (
    await una<{ h: string }>(
      ds,
      `SELECT huella_movimiento($1::text, $2::date, $3::numeric, $4::text) AS h`,
      [c.cuenta, c.fecha, c.monto, c.referencia],
    )
  ).h;

describe('paridad TS/SQL de la huella', () => {
  it.each(CASOS)('función SQL = TS: $nombre', async (c) => {
    expect(await sqlHuella(c)).toBe(huellaMovimiento(c));
  });

  it('el backfill de la migración escribe lo mismo que la función TS', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      let linea = 0;
      for (const c of CASOS) {
        await qr.query(
          `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto, cuenta)
           VALUES ($1, $2, $3, 'SPEI', $4, $5, $6)`,
          [empresa, linea++, c.fecha, c.referencia, c.monto, c.cuenta],
        );
      }
      const sinHuella = await filas<{ huella: string | null }>(
        qr,
        `SELECT huella FROM movimientos WHERE company_id = $1`,
        [empresa],
      );
      expect(sinHuella.every((f) => f.huella === null)).toBe(true);

      await qr.query(SQL_BACKFILL_HUELLA);

      const leidas = await filas<{ huella: string }>(
        qr,
        `SELECT huella FROM movimientos WHERE company_id = $1 ORDER BY linea_numero`,
        [empresa],
      );
      expect(leidas.map((f) => f.huella)).toEqual(
        CASOS.map((c) => huellaMovimiento(c)),
      );
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });

  it('el backfill no pisa una huella ya calculada', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(
        `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto, huella)
         VALUES ($1, 0, '2026-09-02', 'SPEI', 10, 'v9:manual')`,
        [empresa],
      );
      await qr.query(SQL_BACKFILL_HUELLA);
      const { huella } = await una<{ huella: string }>(
        qr,
        `SELECT huella FROM movimientos WHERE company_id = $1`,
        [empresa],
      );
      expect(huella).toBe('v9:manual');
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });
});

describe('esquema de la huella y del estado pendiente_revision', () => {
  it('huella es nullable y su índice es compuesto y no único', async () => {
    const col = await una<{ is_nullable: string; len: number }>(
      ds,
      `SELECT is_nullable, character_maximum_length AS len
         FROM information_schema.columns
        WHERE table_name = 'movimientos' AND column_name = 'huella'`,
    );
    expect(col).toEqual({ is_nullable: 'YES', len: 70 });
    const { def } = await una<{ def: string }>(
      ds,
      `SELECT indexdef AS def FROM pg_indexes
        WHERE indexname = 'ix_movimientos_company_id_huella'`,
    );
    expect(def).toContain('(company_id, huella)');
    expect(def).not.toContain('UNIQUE');
  });

  it('el CHECK acepta pendiente_revision y rechaza un estado desconocido', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    try {
      const insertar = (estado: string, linea: number) =>
        qr.query(
          `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto, estado)
           VALUES ($1, $2, '2026-09-02', 'SPEI', 10, $3)`,
          [empresa, linea, estado],
        );
      await qr.startTransaction();
      await insertar('pendiente_revision', 0);
      await qr.rollbackTransaction();
      await qr.startTransaction();
      await expect(insertar('inventado', 1)).rejects.toThrow(
        /ck_movimientos_estado/,
      );
      await qr.rollbackTransaction();
    } finally {
      await qr.release();
    }
  });
});
