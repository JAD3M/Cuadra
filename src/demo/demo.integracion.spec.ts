import type { DataSource } from 'typeorm';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { filas, una } from '../database/testing/base-de-pruebas';
import { ProveedorSimulado } from '../sugerencias/proveedor-simulado';
import { esperado } from '../../scripts/demo/escenarios';
import { ejecutarDemo } from '../../scripts/demo/runner';

/**
 * CU-18 de punta a punta: el runner de la demo (el mismo de `npm run demo`)
 * contra la app real por HTTP, con Postgres y RLS, Redis y el worker en el
 * mismo proceso. La IA es el proveedor simulado: nunca hay una llamada real.
 * Además de lo que el runner ya se verifica por HTTP, aquí se mira la base.
 */

interface AddressInfoServer {
  address(): unknown;
}

jest.setTimeout(90_000);

let entorno: AppDeCargas;
let ds: DataSource;
let baseUrl: string;
let A: string;
let B: string;
const lineas: string[] = [];

const opciones = () => ({
  baseUrl,
  log: (l: string) => lineas.push(l),
  pollMs: 100,
  timeoutMs: 60_000,
  quietMs: 300,
});

beforeAll(async () => {
  entorno = await levantarAppDeCargas({
    proveedorSugerencia: new ProveedorSimulado(),
  });
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, conciliaciones, bitacora, sugerencias_ia CASCADE',
  );
  await ds.query('UPDATE companies SET tolerancia_monto = 0');
  const direccion = (
    entorno.app.getHttpServer() as unknown as AddressInfoServer
  ).address() as {
    port: number;
  };
  baseUrl = `http://127.0.0.1:${direccion.port}`;
}, 60_000);

afterAll(async () => {
  // La demo deja tolerancia 5.00 en Ferretería: los otros specs esperan 0.
  await ds?.query('UPDATE companies SET tolerancia_monto = 0');
  await entorno?.cerrar();
});

const contar = async (sql: string, parametros: unknown[] = []) =>
  Number((await una<{ n: string }>(ds, sql, parametros)).n);

describe('demo de punta a punta (CU-18)', () => {
  it('el runner termina y se autoverifica', async () => {
    await expect(ejecutarDemo(opciones())).resolves.toBe('ok');
    expect(lineas.join('\n')).toContain('SIMULADAS');
    expect(lineas.join('\n')).toContain('Demo completa');
  });

  it('Ferretería: 40 CFDI, 50 movimientos y las conciliaciones del diseño', async () => {
    expect(
      await contar('SELECT count(*) n FROM cfdi WHERE company_id = $1', [A]),
    ).toBe(40);
    expect(
      await contar('SELECT count(*) n FROM movimientos WHERE company_id = $1', [
        A,
      ]),
    ).toBe(50);

    const porEstado = await filas<{ estado: string; n: string }>(
      ds,
      `SELECT estado, count(*) n FROM conciliaciones WHERE company_id = $1 GROUP BY estado`,
      [A],
    );
    const mapa = Object.fromEntries(porEstado.map((f) => [f.estado, +f.n]));
    const final = esperado('final', 'fdb');
    expect(mapa.confirmada).toBe(final.conciliado); // 1
    expect(mapa.rechazada).toBe(1);
    expect(mapa.propuesta).toBe(final.sugerencia); // 25

    // Nadie confirmó nada que viniera del modelo: el LLM solo propone.
    expect(
      await contar(
        `SELECT count(*) n FROM conciliaciones WHERE company_id = $1 AND origen = 'llm' AND estado = 'confirmada'`,
        [A],
      ),
    ).toBe(0);
    expect(
      await contar(
        `SELECT count(*) n FROM conciliaciones WHERE company_id = $1 AND origen = 'llm' AND estado = 'propuesta'`,
        [A],
      ),
    ).toBe(final.ia);
  });

  it('los CFDI: 39 abiertas o conciliada, 1 parcialidades', async () => {
    const porEstado = await filas<{ estado: string; n: string }>(
      ds,
      `SELECT estado, count(*) n FROM cfdi WHERE company_id = $1 GROUP BY estado`,
      [A],
    );
    const mapa = Object.fromEntries(porEstado.map((f) => [f.estado, +f.n]));
    expect(mapa.parcialidades).toBe(1);
    expect(mapa.conciliada).toBe(1);
    expect((mapa.abierta ?? 0) + mapa.conciliada + mapa.parcialidades).toBe(40);
  });

  it('la IA simulada: 7 consultas, 4 propuestas auditadas con su modelo', async () => {
    const consultas = await filas<{ resultado: string; n: string }>(
      ds,
      `SELECT resultado, count(*) n FROM sugerencias_ia WHERE company_id = $1 GROUP BY resultado`,
      [A],
    );
    const total = consultas.reduce((s, f) => s + +f.n, 0);
    expect(total).toBe(7);

    const auditadas = await filas<{ modelo: string; usuario: string | null }>(
      ds,
      `SELECT datos->>'modelo' AS modelo, user_id AS usuario FROM bitacora
        WHERE company_id = $1 AND accion = 'crear' AND datos->>'origen' = 'llm'`,
      [A],
    );
    expect(auditadas).toHaveLength(4);
    for (const fila of auditadas) {
      expect(fila.modelo).toBe('simulado-demo');
      expect(fila.usuario).toBeNull();
    }
    const motivos = await filas<{ motivo: string }>(
      ds,
      `SELECT motivo FROM conciliaciones WHERE company_id = $1 AND origen = 'llm'`,
      [A],
    );
    for (const { motivo } of motivos) {
      expect(motivo.startsWith('Sugerencia de IA: [SIMULADA')).toBe(true);
    }
  });

  it('Transportes: 4 CFDI, 5 movimientos, 3 sugerencias y 1 sin match; nada cruza', async () => {
    expect(
      await contar('SELECT count(*) n FROM cfdi WHERE company_id = $1', [B]),
    ).toBe(4);
    expect(
      await contar('SELECT count(*) n FROM movimientos WHERE company_id = $1', [
        B,
      ]),
    ).toBe(5);
    const tcu = esperado('final', 'tcu');
    expect([tcu.sugerencia, tcu.sin_match, tcu.conciliado]).toEqual([3, 1, 0]);
    expect(
      await contar(
        `SELECT count(*) n FROM conciliaciones WHERE company_id = $1 AND estado = 'propuesta'`,
        [B],
      ),
    ).toBe(3);
    // Ninguna conciliación une un CFDI de una empresa con un movimiento de otra.
    expect(
      await contar(
        `SELECT count(*) n FROM conciliaciones c
           JOIN cfdi f ON f.id = c.cfdi_id
           JOIN movimientos m ON m.id = c.movimiento_id
          WHERE f.company_id <> c.company_id OR m.company_id <> c.company_id`,
      ),
    ).toBe(0);
  });

  it('repetir la demo no duplica nada: responde que ya estaba cargada', async () => {
    const antes = await contar('SELECT count(*) n FROM cfdi');
    const lineasAntes = lineas.length;
    await expect(ejecutarDemo(opciones())).resolves.toBe('ya-cargado');
    expect(lineas.slice(lineasAntes).join('\n')).toContain(
      'docker compose down -v',
    );
    expect(await contar('SELECT count(*) n FROM cfdi')).toBe(antes);
    expect(await contar('SELECT count(*) n FROM cargas')).toBe(5);
  });
});
