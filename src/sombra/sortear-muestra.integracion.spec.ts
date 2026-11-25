import type { DataSource } from 'typeorm';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { una } from '../database/testing/base-de-pruebas';
import { leerArgumentosDeSorteo, sortearMuestra } from './sortear-muestra';

/**
 * Sortear la muestra a mano en desarrollo. El programador mensual solo sortea
 * el día 1 y para el mes anterior, así que el demo no tenía casos que verificar.
 * El comando reutiliza `MuestrasService.generar`: mismo candado de empresa, la
 * muestra se guarda y no se re-sortea.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;
let persona: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  persona = (await una<{ id: string }>(ds, `SELECT id FROM users LIMIT 1`)).id;
}, 60_000);

afterAll(async () => {
  await limpiar();
  await ds?.query(`UPDATE companies SET activa = true`);
  await entorno?.cerrar();
});

async function limpiar() {
  if (!ds?.isInitialized) return;
  await ds.query(
    'TRUNCATE muestras_verificacion, evidencia_sombra, decision_lineas, decisiones, movimientos CASCADE',
  );
  await ds.query(`UPDATE companies SET activa = true`);
}

beforeEach(limpiar);

/** `n` confirmaciones en lote de la regla 1, confirmadas en septiembre. */
async function sembrar(empresa: string, n: number): Promise<void> {
  const inicio = linea;
  linea += n;
  await ds.query(
    `WITH m AS (
       INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto, moneda, banco)
       SELECT $1, g, '2026-09-02', 'SPEI RECIBIDO', 'R' || g, '100.00', 'MXN', 'bbva'
         FROM generate_series($2::int, $3::int) g
       RETURNING id
     )
     INSERT INTO decisiones (company_id, movimiento_id, tipo, estado, origen, regla, huella_conjunto,
                             confirmada_por_id, confirmada_at, lote_id)
     SELECT $1, m.id, 'conciliacion', 'confirmada', 'regla', 'referencia_monto_exacto',
            gen_random_uuid()::text, $4::uuid, '2026-09-15T12:00:00Z'::timestamptz, gen_random_uuid()
       FROM m`,
    [empresa, inicio, inicio + n - 1, persona],
  );
}

const filasDe = (empresa: string) =>
  ds.query<{ decision_id: string }[]>(
    `SELECT decision_id FROM muestras_verificacion
      WHERE company_id = $1 AND resultado IS NULL ORDER BY decision_id`,
    [empresa],
  );

describe('sortearMuestra', () => {
  it('sortea el mes pedido para cada empresa activa y lo guarda', async () => {
    await sembrar(A, 30);
    await sembrar(B, 3);

    const r = await sortearMuestra(ds, { mes: '2026-09' });

    const deA = r.find((x) => x.rfc === FERRETERIA);
    const deB = r.find((x) => x.rfc === TRANSPORTES);
    expect(deA).toMatchObject({ estado: 'generada', mes: '2026-09-01' });
    expect(deA?.casos).toBe(20); // al menos 20, y 5 % de 30 es 2
    expect(deB).toMatchObject({ estado: 'generada', casos: 3 });
    expect(await filasDe(A)).toHaveLength(20);
    expect(await filasDe(B)).toHaveLength(3);
  });

  it('repetirlo no re-sortea: devuelve la muestra ya guardada', async () => {
    await sembrar(A, 30);
    await sortearMuestra(ds, { mes: '2026-09', rfc: FERRETERIA });
    const antes = await filasDe(A);

    const r = await sortearMuestra(ds, { mes: '2026-09', rfc: FERRETERIA });

    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ estado: 'existente', casos: 20 });
    expect(await filasDe(A)).toEqual(antes);
  });

  it('con un RFC sortea solo esa empresa, sin tocar las demás', async () => {
    await sembrar(A, 5);
    await sembrar(B, 5);

    const r = await sortearMuestra(ds, { mes: '2026-09', rfc: TRANSPORTES });

    expect(r.map((x) => x.rfc)).toEqual([TRANSPORTES]);
    expect(await filasDe(A)).toHaveLength(0);
    expect(await filasDe(B)).toHaveLength(5);
  });

  it('un mes sin confirmaciones en lote queda sin casos y no crea filas', async () => {
    await sembrar(A, 5);

    const r = await sortearMuestra(ds, { mes: '2026-08', rfc: FERRETERIA });

    expect(r[0]).toMatchObject({ estado: 'sin_casos', casos: 0 });
    expect(await filasDe(A)).toHaveLength(0);
  });

  it('no sortea una empresa inactiva', async () => {
    await sembrar(A, 5);
    await ds.query(`UPDATE companies SET activa = false WHERE id = $1`, [A]);

    const r = await sortearMuestra(ds, { mes: '2026-09' });

    expect(r.some((x) => x.rfc === FERRETERIA)).toBe(false);
    expect(await filasDe(A)).toHaveLength(0);
  });

  it('un RFC que no es de una empresa activa es un error claro', async () => {
    await expect(
      sortearMuestra(ds, { mes: '2026-09', rfc: 'NOEXISTE000000' }),
    ).rejects.toThrow('No hay una empresa activa con RFC NOEXISTE000000.');
  });

  it('un mes mal escrito se rechaza antes de tocar la base', async () => {
    await expect(sortearMuestra(ds, { mes: '2026-13' })).rejects.toThrow(
      'El mes debe ser AAAA-MM',
    );
  });
});

describe('leerArgumentosDeSorteo', () => {
  it('lee el mes y, si viene, la empresa', () => {
    expect(leerArgumentosDeSorteo(['2026-09'])).toEqual({
      mes: '2026-09',
      rfc: undefined,
    });
    expect(
      leerArgumentosDeSorteo(['2026-09', '--empresa=fdb190215qk4']),
    ).toEqual({ mes: '2026-09', rfc: 'FDB190215QK4' });
  });

  it('sin mes, o con un argumento que no conoce, explica cómo se usa', () => {
    expect(() => leerArgumentosDeSorteo([])).toThrow(
      'Uso: npm run sortear:muestra -- AAAA-MM [--empresa=RFC]',
    );
    expect(() => leerArgumentosDeSorteo(['2026-09', '--todas'])).toThrow(
      'Uso: npm run sortear:muestra -- AAAA-MM [--empresa=RFC]',
    );
  });
});
