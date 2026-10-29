import { createHash } from 'crypto';
import { DataSource, type QueryRunner } from 'typeorm';
import { opcionesDataSource } from '../database/data-source';
import { sembrar } from '../database/seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlAppDePruebas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';

/**
 * Historia 3.3, T2: estado `pendiente_vista_previa`, zona de espera de
 * movimientos y `bitacora.entidad_id` nulo solo en rechazos. Contra Postgres
 * real: todo vive en CHECK y RLS, no en el ORM.
 */

const FERRETERIA = 'FDB190215QK4';
const TRANSPORTES = 'TCU170830R52';

let duenio: DataSource;
let app: DataSource;

/**
 * La base de pruebas se comparte entre suites y la prueba de reversibilidad
 * deshace migraciones: lo que esta suite deja (una carga en el estado nuevo,
 * una bitácora sin entidad) haría fallar el `down`. El dueño borra todo.
 */
async function limpiar(): Promise<void> {
  await duenio.query(`DELETE FROM movimientos_pendientes`);
  await duenio.query(`DELETE FROM bitacora WHERE entidad_id IS NULL`);
  await duenio.query(
    `DELETE FROM cargas WHERE estado = 'pendiente_vista_previa'
        OR nombre_archivo LIKE 'pend-%' OR nombre_archivo = 'x.pdf'`,
  );
}
const empresas = new Map<string, string>();
const cargas = new Map<string, string>();

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  duenio = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await duenio.runMigrations();
  await sembrar(duenio);
  await limpiar();

  for (const rfc of [FERRETERIA, TRANSPORTES]) {
    const { id } = await una<{ id: string }>(
      duenio,
      'SELECT id FROM companies WHERE rfc = $1',
      [rfc],
    );
    empresas.set(rfc, id);
    const carga = await una<{ id: string }>(
      duenio,
      `INSERT INTO cargas (company_id, tipo, nombre_archivo, hash_archivo)
       VALUES ($1, 'estado_cuenta', $2, $3) RETURNING id`,
      [
        id,
        `pend-${rfc}.pdf`,
        createHash('sha256').update(`pend-${rfc}`).digest('hex'),
      ],
    );
    cargas.set(rfc, carga.id);
  }

  app = await new DataSource({
    type: 'postgres',
    url: urlAppDePruebas(),
  }).initialize();
}, 60_000);

afterAll(async () => {
  if (duenio?.isInitialized) await limpiar();
  if (app?.isInitialized) await app.destroy();
  if (duenio?.isInitialized) await duenio.destroy();
});

const de = (rfc: string): string => empresas.get(rfc) as string;
const cargaDe = (rfc: string): string => cargas.get(rfc) as string;

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

const INSERTAR_PENDIENTE = `
  INSERT INTO movimientos_pendientes
    (company_id, carga_id, linea_numero, fecha, descripcion, monto)
  VALUES ($1, $2, $3, '2026-10-01', 'DEPOSITO', 1234567890123.4567)`;

describe('estado pendiente_vista_previa', () => {
  it('una carga con ese estado cumple los CHECK, con total fijo y contadores en cero', async () => {
    await duenio.query(
      `INSERT INTO cargas (company_id, tipo, nombre_archivo, hash_archivo,
                           estado, total_registros)
       VALUES ($1, 'estado_cuenta', 'espera.pdf', $2, 'pendiente_vista_previa', 12)`,
      [de(FERRETERIA), 'a'.repeat(64)],
    );
    const { estado } = await una<{ estado: string }>(
      duenio,
      `SELECT estado FROM cargas WHERE hash_archivo = $1`,
      ['a'.repeat(64)],
    );
    expect(estado).toBe('pendiente_vista_previa');
  });

  it('un estado fuera del catálogo sigue rechazado', async () => {
    await expect(
      duenio.query(
        `INSERT INTO cargas (company_id, tipo, nombre_archivo, hash_archivo, estado)
         VALUES ($1, 'estado_cuenta', 'x.pdf', $2, 'inventado')`,
        [de(FERRETERIA), 'b'.repeat(64)],
      ),
    ).rejects.toThrow(/ck_cargas_estado/);
  });
});

describe('movimientos_pendientes', () => {
  it('tiene RLS activa y forzada', async () => {
    const t = await una<{ rls: boolean; forzada: boolean }>(
      duenio,
      `SELECT relrowsecurity AS rls, relforcerowsecurity AS forzada
         FROM pg_class WHERE relname = 'movimientos_pendientes'`,
    );
    expect(t).toEqual({ rls: true, forzada: true });
  });

  it('guarda el monto exacto, sin flotantes', async () => {
    const monto = await comoEmpresa(de(FERRETERIA), async (qr) => {
      await qr.query(INSERTAR_PENDIENTE, [
        de(FERRETERIA),
        cargaDe(FERRETERIA),
        2,
      ]);
      return una<{ monto: string }>(
        qr,
        'SELECT monto::text AS monto FROM movimientos_pendientes',
      );
    });
    expect(monto.monto).toBe('1234567890123.4567');
  });

  it('otra empresa no ve filas ajenas ni sin empresa fijada', async () => {
    await duenio.query(INSERTAR_PENDIENTE, [
      de(TRANSPORTES),
      cargaDe(TRANSPORTES),
      2,
    ]);
    expect(await filas(app, 'SELECT * FROM movimientos_pendientes')).toEqual(
      [],
    );
    const vistas = await comoEmpresa(de(FERRETERIA), (qr) =>
      filas<{ company_id: string }>(
        qr,
        'SELECT company_id FROM movimientos_pendientes',
      ),
    );
    expect(vistas).toEqual([]);
    const propias = await comoEmpresa(de(TRANSPORTES), (qr) =>
      filas<{ company_id: string }>(
        qr,
        'SELECT company_id FROM movimientos_pendientes',
      ),
    );
    expect(propias).toEqual([{ company_id: de(TRANSPORTES) }]);
  });

  it('no deja insertar una fila de otra empresa', async () => {
    await expect(
      comoEmpresa(de(FERRETERIA), (qr) =>
        qr.query(INSERTAR_PENDIENTE, [
          de(TRANSPORTES),
          cargaDe(TRANSPORTES),
          3,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('la línea no se repite dentro de una carga', async () => {
    await duenio.query(INSERTAR_PENDIENTE, [
      de(FERRETERIA),
      cargaDe(FERRETERIA),
      7,
    ]);
    await expect(
      duenio.query(INSERTAR_PENDIENTE, [
        de(FERRETERIA),
        cargaDe(FERRETERIA),
        7,
      ]),
    ).rejects.toThrow(/ux_movimientos_pendientes_company_carga_linea/);
  });
});

describe('bitacora.entidad_id nulo solo en rechazos', () => {
  const INSERTAR = `
    INSERT INTO bitacora (company_id, entidad, entidad_id, accion, datos)
    VALUES ($1, 'cargas', NULL, $2, '{"archivo":"x.pdf"}')`;

  it("acepta NULL con accion 'rechazar'", async () => {
    await duenio.query(INSERTAR, [de(FERRETERIA), 'rechazar']);
    const { n } = await una<{ n: number }>(
      duenio,
      `SELECT count(*)::int AS n FROM bitacora
        WHERE entidad_id IS NULL AND accion = 'rechazar'`,
    );
    expect(n).toBe(1);
  });

  it.each(['crear', 'cargar', 'confirmar', 'actualizar', 'eliminar'])(
    "rechaza NULL con accion '%s'",
    async (accion) => {
      await expect(
        duenio.query(INSERTAR, [de(FERRETERIA), accion]),
      ).rejects.toThrow(/ck_bitacora_entidad_id_solo_rechazo/);
    },
  );
});
