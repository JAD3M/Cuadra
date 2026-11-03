import { createHash } from 'node:crypto';
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
 * Historia 3.6: `bancos_vista_previa` (global, sin RLS), la acción
 * `levantar_vista_previa` de la bitácora de plataforma y la función
 * `cargas_aceptadas_por_banco()`. Corre contra Postgres real: los GRANT, el
 * CHECK y el SECURITY DEFINER viven en el motor.
 */

let duenio: DataSource;
let app: DataSource;
const empresas: string[] = [];

const BANCO_A = 'banco_prueba_36_a';
const BANCO_B = 'banco_prueba_36_b';

function hash(texto: string): string {
  return createHash('sha256').update(texto).digest('hex');
}

async function sembrarCarga(
  companyId: string,
  banco: string,
  estado: string,
  clave: string,
  conSaldos = true,
): Promise<void> {
  await duenio.query(
    `INSERT INTO cargas (company_id, tipo, estado, nombre_archivo, hash_archivo,
                         banco, saldo_inicial, saldo_final)
     VALUES ($1, 'estado_cuenta', $2, $3, $4, $5, $6, $6)`,
    [
      companyId,
      estado,
      `${clave}.pdf`,
      hash(clave),
      banco,
      conSaldos ? '0.0000' : null,
    ],
  );
}

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  duenio = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await duenio.runMigrations();
  app = await new DataSource({
    type: 'postgres',
    url: urlAppDePruebas(),
  }).initialize();

  for (const rfc of ['BVP010101AAA', 'BVP020202BBB']) {
    const { id } = await una<{ id: string }>(
      duenio,
      `INSERT INTO companies (rfc, razon_social) VALUES ($1, 'Empresa 3.6')
       RETURNING id`,
      [rfc],
    );
    empresas.push(id);
  }
}, 60_000);

afterAll(async () => {
  if (duenio?.isInitialized) {
    await duenio.query(
      `DELETE FROM cargas WHERE banco LIKE 'banco_prueba_36_%'`,
    );
    await duenio.query(`DELETE FROM companies WHERE rfc LIKE 'BVP0%'`);
    // Una fila 'levantar_vista_previa' impediría revertir la migración.
    await duenio.query(`DELETE FROM bitacora_plataforma`);
  }
  if (app?.isInitialized) await app.destroy();
  if (duenio?.isInitialized) await duenio.destroy();
});

describe('bancos_vista_previa', () => {
  it('existe, es global (sin company_id ni RLS) y tiene banco como llave', async () => {
    const columnas = await filas<{ column_name: string }>(
      app,
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'bancos_vista_previa' ORDER BY column_name`,
    );
    expect(columnas.map((c) => c.column_name)).toEqual([
      'banco',
      'levantada_en',
      'levantada_por',
    ]);
    const { relrowsecurity } = await una<{ relrowsecurity: boolean }>(
      app,
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'bancos_vista_previa'`,
    );
    expect(relrowsecurity).toBe(false);
  });

  it.each([
    ['SELECT', true],
    ['INSERT', true],
    ['UPDATE', false],
    ['DELETE', false],
    ['TRUNCATE', false],
  ])('cuadra_app %s = %s', async (privilegio, esperado) => {
    const { ok } = await una<{ ok: boolean }>(
      app,
      `SELECT has_table_privilege('cuadra_app', 'bancos_vista_previa', $1) AS ok`,
      [privilegio],
    );
    expect(ok).toBe(esperado);
  });

  it('rechaza un banco sin normalizar y levantar dos veces el mismo', async () => {
    const { id } = await una<{ id: string }>(
      duenio,
      `INSERT INTO plataforma_usuarios (correo, password_hash)
       VALUES ('bvp36@cuadra.test', 'x') RETURNING id`,
    );
    try {
      await expect(
        app.query(
          `INSERT INTO bancos_vista_previa (banco, levantada_por) VALUES ('BBVA', $1)`,
          [id],
        ),
      ).rejects.toThrow(/ck_bancos_vista_previa_banco_normalizado/);
      await app.query(
        `INSERT INTO bancos_vista_previa (banco, levantada_por) VALUES ($1, $2)`,
        [BANCO_A, id],
      );
      await expect(
        app.query(
          `INSERT INTO bancos_vista_previa (banco, levantada_por) VALUES ($1, $2)`,
          [BANCO_A, id],
        ),
      ).rejects.toThrow(/duplicate key/);
    } finally {
      await duenio.query(`DELETE FROM bancos_vista_previa WHERE banco = $1`, [
        BANCO_A,
      ]);
      await duenio.query(`DELETE FROM plataforma_usuarios WHERE id = $1`, [id]);
    }
  });
});

describe('bitacora_plataforma: acción levantar_vista_previa', () => {
  it('el CHECK la acepta', async () => {
    await app.query(
      `INSERT INTO bitacora_plataforma (accion) VALUES ('levantar_vista_previa')`,
    );
  });
});

describe('cargas_aceptadas_por_banco()', () => {
  it('es SECURITY DEFINER con search_path fijo y sin EXECUTE para PUBLIC', async () => {
    const f = await una<{
      secdef: boolean;
      config: string[] | null;
      publico: boolean;
      app: boolean;
    }>(
      duenio,
      `SELECT prosecdef AS secdef, proconfig AS config,
              has_function_privilege('public', oid, 'EXECUTE') AS publico,
              has_function_privilege('cuadra_app', oid, 'EXECUTE') AS app
         FROM pg_proc WHERE proname = 'cargas_aceptadas_por_banco'`,
    );
    expect(f.secdef).toBe(true);
    expect(f.config).toEqual(['search_path=pg_catalog, public']);
    expect(f.publico).toBe(false);
    expect(f.app).toBe(true);
  });

  it('como cuadra_app, sin empresa fijada, cuenta solo aceptadas de todas las empresas', async () => {
    const [e1, e2] = empresas;
    await sembrarCarga(e1, BANCO_A, 'procesada', 'a-1');
    await sembrarCarga(e1, BANCO_A, 'procesada', 'a-2');
    await sembrarCarga(e2, BANCO_A, 'procesada', 'a-3');
    await sembrarCarga(e2, BANCO_A, 'rechazada', 'a-4');
    await sembrarCarga(e1, BANCO_A, 'pendiente_vista_previa', 'a-5');
    await sembrarCarga(e1, BANCO_A, 'fallida', 'a-6');
    // Una carga procesada que no es de PDF (sin saldos) no cuenta.
    await sembrarCarga(e2, BANCO_A, 'procesada', 'a-7', false);
    await sembrarCarga(e2, BANCO_B, 'procesada', 'b-1');
    await sembrarCarga(e1, BANCO_B, 'rechazada', 'b-2');

    // Sin empresa fijada, RLS deja a cuadra_app sin ver ninguna carga.
    const { n } = await una<{ n: number }>(
      app,
      `SELECT count(*)::int AS n FROM cargas WHERE banco LIKE 'banco_prueba_36_%'`,
    );
    expect(n).toBe(0);

    const cuentas = await filas<{ banco: string; aceptadas: string }>(
      app,
      `SELECT banco, aceptadas FROM cargas_aceptadas_por_banco()
        WHERE banco LIKE 'banco_prueba_36_%' ORDER BY banco`,
    );
    expect(cuentas.map((c) => [c.banco, Number(c.aceptadas)])).toEqual([
      [BANCO_A, 3],
      [BANCO_B, 1],
    ]);
  });
});
