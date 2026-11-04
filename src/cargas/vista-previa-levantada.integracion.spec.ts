import { readFileSync } from 'fs';
import { join } from 'path';
import type { DataSource } from 'typeorm';
import { huellaMovimiento } from '../bancos/huella-movimiento';
import { construirPdfSintetico } from '../bancos/pdf/pdf-sintetico';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { filas, una } from '../database/testing/base-de-pruebas';
import { BancosVistaPrevia } from '../plataforma/bancos-vista-previa.service';
import { ColaSugerencias } from '../sugerencias/cola-sugerencias';
import request from '../testing/supertest-con-origen';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  CARMEN,
  LUIS,
  TRANSPORTES,
} from './testing/app-de-cargas';

/**
 * Historia 3.6, T3: con la vista previa de un banco levantada, el PDF que
 * cuadra pasa directo a conciliación, como si un contador lo hubiera
 * aceptado. SINTÉTICO: el PDF de BBVA es el fixture de la historia.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let levantados: Set<string>;
let conciliar: jest.SpyInstance;
let estaLevantado: jest.SpyInstance;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
}, 60_000);

async function limpiar(): Promise<void> {
  const propias = `(SELECT id FROM cargas WHERE tipo = 'estado_cuenta'
                     AND nombre_archivo LIKE 'lv-%')`;
  await ds.query(
    `DELETE FROM decisiones WHERE movimiento_id IN
       (SELECT id FROM movimientos WHERE carga_id IN ${propias})`,
  );
  await ds.query(`DELETE FROM movimientos WHERE carga_id IN ${propias}`);
  await ds.query(`DELETE FROM movimientos WHERE descripcion = 'lv-previo'`);
  await ds.query(
    `DELETE FROM movimientos_pendientes WHERE carga_id IN ${propias}`,
  );
  await ds.query(
    `DELETE FROM bitacora WHERE entidad = 'cargas'
        AND (entidad_id IN ${propias} OR entidad_id IS NULL)`,
  );
  await ds.query(
    `DELETE FROM cargas WHERE tipo = 'estado_cuenta' AND nombre_archivo LIKE 'lv-%'`,
  );
}

beforeEach(async () => {
  await limpiar();
  levantados = new Set();
  // Sin mock, llama a la real: sin banco levantado se consulta la tabla.
  estaLevantado = jest.spyOn(
    entorno.app.get(BancosVistaPrevia),
    'estaLevantado',
  );
  conciliar = jest
    .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
    .mockResolvedValue({ propuestas: 0 });
  jest
    .spyOn(entorno.app.get(ColaSugerencias), 'activa', 'get')
    .mockReturnValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  if (ds?.isInitialized) {
    await limpiar();
  }
  await entorno?.cerrar();
});

const BBVA = readFileSync(
  join(__dirname, '..', 'bancos', 'fixtures', 'bbva-sintetico.pdf'),
);
const NO_CUADRA = construirPdfSintetico([
  'Periodo DEL 01/10/2026 AL 31/10/2026',
  'Moneda MXN',
  'Saldo Anterior 10,000.00',
  'Saldo Final 11,250.50',
  '02/OCT 02/OCT PAGO PROVEEDOR 2,000.00 8,000.00',
  '15/OCT 15/OCT DEPOSITO CLIENTE 3,000.00 11,000.00',
]);

/**
 * Levantar un banco es cosa de `plataforma/` (T2, ya probado): `cargas` no
 * puede nombrar su tabla, ni siquiera en las pruebas (arquitectura.spec). Aquí
 * se fija lo que `estaLevantado` responde; el caso sin levantar usa la real.
 */
function levantar(banco = 'bbva'): void {
  levantados.add(banco);
  estaLevantado.mockImplementation((b: string) =>
    Promise.resolve(levantados.has(b)),
  );
}

async function subir(
  contenido: Buffer,
  rfc = FERRETERIA,
  banco = 'bbva',
  esperado = 200,
) {
  const res = await request(entorno.app.getHttpServer())
    .post('/cargas/estado-cuenta/pdf')
    .set(
      'Cookie',
      await entorno.token(rfc === TRANSPORTES ? CARMEN : LUIS, rfc),
    )
    .field('banco', banco)
    .attach('archivo', contenido, 'lv-bbva.pdf')
    .expect(esperado);
  return res;
}

const cuerpo = (res: { body: unknown }) =>
  res.body as { cargaId: string; estado: string; yaExistia: boolean };

const movimientosDe = (cargaId: string) =>
  filas<{ estado: string; company_id: string; linea_numero: number }>(
    ds,
    `SELECT estado, company_id, linea_numero FROM movimientos
      WHERE carga_id = $1 ORDER BY linea_numero`,
    [cargaId],
  );

const pendientesDe = (cargaId: string) =>
  una<{ n: number }>(
    ds,
    `SELECT count(*)::int AS n FROM movimientos_pendientes WHERE carga_id = $1`,
    [cargaId],
  );

async function sembrarPrevio(
  fecha: string,
  monto: string,
  referencia: string | null,
  linea: number,
): Promise<void> {
  await ds.query(
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion,
                              referencia, monto, estado, huella)
     VALUES ($1, $2, $3, 'lv-previo', $4, $5, 'abierto', $6)`,
    [
      entorno.empresa(FERRETERIA),
      linea,
      fecha,
      referencia,
      monto,
      huellaMovimiento({ cuenta: null, fecha, monto, referencia }),
    ],
  );
}

describe('banco levantado: el PDF pasa directo a conciliación (3.6, T3)', () => {
  it('un PDF que cuadra entra a movimientos y la carga queda procesada', async () => {
    levantar();
    const res = await subir(BBVA);
    const { cargaId, estado, yaExistia } = cuerpo(res);
    expect(estado).toBe('procesada');
    expect(yaExistia).toBe(false);

    const movimientos = await movimientosDe(cargaId);
    expect(movimientos.map((m) => m.estado)).toEqual(['abierto', 'abierto']);
    expect(
      movimientos.every((m) => m.company_id === entorno.empresa(FERRETERIA)),
    ).toBe(true);
    expect((await pendientesDe(cargaId)).n).toBe(0);

    const carga = await una<{
      estado: string;
      registros_ok: number;
      registros_existentes: number;
      total_registros: number;
    }>(
      ds,
      `SELECT estado, registros_ok, registros_existentes, total_registros
         FROM cargas WHERE id = $1`,
      [cargaId],
    );
    expect(carga).toEqual({
      estado: 'procesada',
      registros_ok: 2,
      registros_existentes: 0,
      total_registros: 2,
    });
    // Arranca la conciliación tras el commit, como al aceptar.
    expect(conciliar).toHaveBeenCalledWith(entorno.empresa(FERRETERIA));
  });

  it('deja bitácora de confirmar distinguible por via: banco_levantado', async () => {
    levantar();
    const { cargaId } = cuerpo(await subir(BBVA));
    const confirmar = await filas<{
      user_id: string;
      datos: Record<string, unknown>;
    }>(
      ds,
      `SELECT user_id, datos FROM bitacora
        WHERE entidad = 'cargas' AND entidad_id = $1 AND accion = 'confirmar'`,
      [cargaId],
    );
    expect(confirmar).toHaveLength(1);
    expect(confirmar[0].user_id).toBe(entorno.persona(LUIS));
    expect(confirmar[0].datos).toMatchObject({
      via: 'banco_levantado',
      estado: 'procesada',
      movimientos: 2,
      nuevos: 2,
      existentes: 0,
      dudosos: 0,
    });
  });

  it('un PDF que no cuadra se rechaza igual y no escribe nada', async () => {
    levantar();
    const res = await subir(NO_CUADRA, FERRETERIA, 'bbva', 400);
    expect((res.body as { error: string }).error).toBe('saldos_no_cuadran');
    const n = await una<{ cargas: number; movimientos: number }>(
      ds,
      `SELECT (SELECT count(*)::int FROM cargas WHERE nombre_archivo LIKE 'lv-%') AS cargas,
              (SELECT count(*)::int FROM movimientos m
                 JOIN cargas c ON c.id = m.carga_id
                WHERE c.nombre_archivo LIKE 'lv-%') AS movimientos`,
    );
    expect(n).toEqual({ cargas: 0, movimientos: 0 });
  });

  it('clasifica como al aceptar: existente se omite y dudoso queda en revisión', async () => {
    levantar();
    // Línea 1 del PDF: exacta. Línea 2: misma huella, referencia cruda distinta.
    await sembrarPrevio('2026-10-02', '-250.0000', null, 9001);
    await sembrarPrevio('2026-10-15', '1500.5000', 'sint-0001', 9002);
    const { cargaId, estado } = cuerpo(await subir(BBVA));
    expect(estado).toBe('procesada');
    const movimientos = await movimientosDe(cargaId);
    expect(movimientos).toEqual([
      expect.objectContaining({
        linea_numero: 2,
        estado: 'pendiente_revision',
      }),
    ]);
    const carga = await una<{
      registros_ok: number;
      registros_existentes: number;
    }>(
      ds,
      `SELECT registros_ok, registros_existentes FROM cargas WHERE id = $1`,
      [cargaId],
    );
    expect(carga).toEqual({ registros_ok: 1, registros_existentes: 1 });
    // Sin movimientos nuevos no hay nada que conciliar.
    expect(conciliar).not.toHaveBeenCalled();
  });

  it('un banco sin levantar sigue en vista previa, sin movimientos', async () => {
    const { cargaId, estado } = cuerpo(await subir(BBVA));
    expect(estado).toBe('pendiente_vista_previa');
    expect(await movimientosDe(cargaId)).toEqual([]);
    expect((await pendientesDe(cargaId)).n).toBe(2);
  });

  it('levantar otro banco no afecta a bbva', async () => {
    levantar('banorte');
    expect(cuerpo(await subir(BBVA)).estado).toBe('pendiente_vista_previa');
  });

  it('el levantamiento es por banco: aplica a todas las empresas, y cada una conserva su company_id', async () => {
    levantar();
    const a = cuerpo(await subir(BBVA, FERRETERIA));
    const b = cuerpo(await subir(BBVA, TRANSPORTES));
    expect(a.estado).toBe('procesada');
    expect(b.estado).toBe('procesada');
    expect(
      (await movimientosDe(a.cargaId)).every(
        (m) => m.company_id === entorno.empresa(FERRETERIA),
      ),
    ).toBe(true);
    expect(
      (await movimientosDe(b.cargaId)).every(
        (m) => m.company_id === entorno.empresa(TRANSPORTES),
      ),
    ).toBe(true);
  });

  it('resubir el mismo PDF no duplica nada', async () => {
    levantar();
    const primero = cuerpo(await subir(BBVA));
    const segundo = cuerpo(await subir(BBVA));
    expect(segundo.cargaId).toBe(primero.cargaId);
    expect(segundo.yaExistia).toBe(true);
    expect(await movimientosDe(primero.cargaId)).toHaveLength(2);
  });
});
