import { createHash } from 'crypto';
import { DataSource, type QueryRunner } from 'typeorm';
import { opcionesDataSource } from './data-source';
import { sembrar } from './seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlAppDePruebas,
  urlDePruebas,
} from './testing/base-de-pruebas';

/**
 * CU-04b a nivel base, sin la app en medio. El test de CU-04 detecta un RLS
 * demasiado restrictivo (su control positivo), pero no uno que no haga nada:
 * con el handler filtrando por `company_id`, los cinco casos pasan igual con
 * o sin políticas. Estos casos sí se ponen rojos si RLS no aplica.
 */

const FERRETERIA = 'FDB190215QK4';
const TRANSPORTES = 'TCU170830R52';
const TABLAS_CON_RLS = [
  'cargas',
  'cfdi',
  'movimientos',
  'conciliaciones',
  'bitacora',
  'carga_archivos',
] as const;

/** Dueño del esquema: migra, siembra y cuenta sin RLS. */
let duenio: DataSource;
/** `cuadra_app`: lo mismo que usa la app. */
let app: DataSource;
const empresas = new Map<string, string>();

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  duenio = await new DataSource({
    ...opcionesDataSource,
    url,
  }).initialize();
  await duenio.runMigrations();
  await sembrar(duenio);

  for (const rfc of [FERRETERIA, TRANSPORTES]) {
    const { id } = await una<{ id: string }>(
      duenio,
      'SELECT id FROM companies WHERE rfc = $1',
      [rfc],
    );
    empresas.set(rfc, id);
    await duenio.query(
      `INSERT INTO cargas (company_id, tipo, nombre_archivo, hash_archivo)
       VALUES ($1, 'cfdi', $2, $3)
       ON CONFLICT (company_id, hash_archivo) DO NOTHING`,
      [
        id,
        `rls-${rfc}.xml`,
        createHash('sha256').update(`rls-${rfc}`).digest('hex'),
      ],
    );
  }

  app = await new DataSource({
    type: 'postgres',
    url: urlAppDePruebas(),
  }).initialize();
}, 60_000);

afterAll(async () => {
  if (app?.isInitialized) await app.destroy();
  if (duenio?.isInitialized) await duenio.destroy();
});

function de(rfc: string): string {
  const id = empresas.get(rfc);
  if (!id) throw new Error(`Falta "${rfc}" en el beforeAll`);
  return id;
}

/** Transacción como `cuadra_app` con la empresa fijada; siempre se revierte. */
async function comoEmpresa<T>(
  companyId: string,
  cuerpo: (qr: QueryRunner) => Promise<T>,
): Promise<T> {
  const qr = app.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await qr.query(`SELECT set_config('app.company_id', $1, true)`, [
      companyId,
    ]);
    return await cuerpo(qr);
  } finally {
    await qr.rollbackTransaction();
    await qr.release();
  }
}

describe('RLS (CU-04b)', () => {
  it('la app no corre como superusuario ni puede saltarse RLS', async () => {
    const rol = await una<{
      usuario: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>(
      app,
      `SELECT current_user AS usuario, rolsuper, rolbypassrls
         FROM pg_roles WHERE rolname = current_user`,
    );
    expect(rol).toEqual({
      usuario: 'cuadra_app',
      rolsuper: false,
      rolbypassrls: false,
    });
  });

  it('activa y fuerza RLS en todas las tablas de dominio', async () => {
    const tablas = await filas<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      duenio,
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relnamespace = 'public'::regnamespace AND relname = ANY($1)
        ORDER BY relname`,
      [TABLAS_CON_RLS],
    );
    expect(tablas).toEqual(
      [...TABLAS_CON_RLS].sort().map((relname) => ({
        relname,
        relrowsecurity: true,
        relforcerowsecurity: true,
      })),
    );
  });

  // El test que detecta un RLS que no hace nada.
  it('sin empresa fijada, SELECT * FROM cargas sin WHERE da cero filas', async () => {
    // Si la tabla estuviera vacía, el cero no probaría nada.
    const { n } = await una<{ n: number }>(
      duenio,
      'SELECT count(*)::int AS n FROM cargas',
    );
    expect(n).toBeGreaterThanOrEqual(2);

    expect(await filas(app, 'SELECT * FROM cargas')).toEqual([]);
  });

  it('con Ferretería fijada ve solo lo suyo', async () => {
    const companias = await comoEmpresa(de(FERRETERIA), (qr) =>
      filas<{ company_id: string }>(
        qr,
        'SELECT DISTINCT company_id FROM cargas',
      ),
    );
    // Control positivo: no es cero filas, es exactamente su empresa.
    expect(companias).toEqual([{ company_id: de(FERRETERIA) }]);
  });

  it('con Ferretería fijada no puede insertar una fila de Transportes', async () => {
    await expect(
      comoEmpresa(de(FERRETERIA), (qr) =>
        qr.query(
          `INSERT INTO cargas (company_id, tipo, nombre_archivo, hash_archivo)
           VALUES ($1, 'cfdi', 'intruso.xml', $2)`,
          [de(TRANSPORTES), 'f'.repeat(64)],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('la empresa fijada no sobrevive al fin de la transacción', async () => {
    // Una sola conexión: es el caso del pool, que reutiliza la conexión de la
    // petición anterior. Tras el COMMIT el valor queda en '' (no NULL), que
    // es lo que obliga al nullif de la política.
    const qr = app.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();
      await qr.query(`SELECT set_config('app.company_id', $1, true)`, [
        de(FERRETERIA),
      ]);
      expect((await filas(qr, 'SELECT id FROM cargas')).length).toBeGreaterThan(
        0,
      );
      await qr.commitTransaction();

      expect(await filas(qr, 'SELECT id FROM cargas')).toEqual([]);
    } finally {
      await qr.release();
    }
  });
});
