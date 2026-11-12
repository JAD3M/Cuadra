import { readFileSync } from 'fs';
import { join } from 'path';
import type { DataSource } from 'typeorm';
import request from '../testing/supertest-con-origen';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  LUIS,
} from '../cargas/testing/app-de-cargas';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { filas } from '../database/testing/base-de-pruebas';
import {
  CSV_EQUIVALENTE,
  nombreDeCfdi,
  PDF_CUADRA,
  PDF_NO_CUADRA,
} from '../../scripts/ejemplos/generar';
import { FACTURAS, MOVIMIENTOS } from '../../scripts/ejemplos/juego';

/**
 * Historia 7.1 (S3): el juego de ejemplo de BBVA, cargado completo por HTTP
 * contra Postgres real con RLS, produce un caso de cada tipo. Lo esperado sale
 * de la tabla del juego (`scripts/ejemplos/juego.ts`); si el motor no lo
 * produce, se corrige el dato, nunca el motor.
 */

jest.setTimeout(60_000);

const RAIZ = join(__dirname, '..', '..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta));

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let token: string;

async function limpiar() {
  await ds.query(`UPDATE companies SET tolerancia_monto = 0`);
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, movimientos_pendientes, decisiones, decision_lineas, evidencia_sombra, bitacora CASCADE',
  );
}

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  token = await entorno.token(LUIS, FERRETERIA);
  await limpiar();
}, 60_000);

afterAll(async () => {
  if (ds?.isInitialized) await limpiar();
  await entorno?.cerrar();
});

const subirPdf = (nombre: string, ruta: string) =>
  request(entorno.app.getHttpServer())
    .post('/cargas/estado-cuenta/pdf')
    .set('Cookie', token)
    .field('banco', 'bbva')
    .attach('archivo', leer(ruta), nombre);

describe('ejemplos de BBVA: se cargan completos y producen todos los casos (S3)', () => {
  it('el PDF que no cuadra se rechaza completo y no deja nada', async () => {
    const res = await subirPdf('no-cuadra.pdf', PDF_NO_CUADRA).expect(400);

    expect(res.body).toMatchObject({
      error: 'saldos_no_cuadran',
      diferencia: '100',
    });
    const [{ n }] = await filas<{ n: string }>(
      ds,
      `SELECT (SELECT count(*) FROM movimientos) + (SELECT count(*) FROM movimientos_pendientes) AS n`,
    );
    expect(Number(n)).toBe(0);
  });

  it('con las facturas y el PDF que cuadra, cada movimiento produce lo que declara el juego', async () => {
    // Las nueve facturas, en una sola carga.
    const cfdi = request(entorno.app.getHttpServer())
      .post('/cargas/cfdi')
      .set('Cookie', token);
    for (const f of FACTURAS) {
      cfdi.attach('archivos', leer(nombreDeCfdi(f.folio)), `${f.folio}.xml`);
    }
    const subida = await cfdi.expect(202);
    const fin = await entorno.esperarFin(
      token,
      (subida.body as { id: string }).id,
    );
    expect(fin).toMatchObject({ estado: 'procesada', registrosOk: 9 });

    // El PDF queda en espera y se acepta (la vista previa obligatoria).
    const carga = await subirPdf('septiembre.pdf', PDF_CUADRA).expect(200);
    const cargaId = (carga.body as { cargaId: string }).cargaId;
    await request(entorno.app.getHttpServer())
      .post(`/cargas/${cargaId}/aceptar`)
      .set('Cookie', token)
      .expect(200);

    await entorno.app.get(ConciliacionService).conciliar(A);

    const resultado = await filas<{
      descripcion: string;
      estado: string;
      clase: string | null;
      regla_sin_match: string | null;
      regla: string | null;
    }>(
      ds,
      `SELECT m.descripcion, m.estado, m.clase, m.regla_sin_match,
              (SELECT d.regla FROM decisiones d
                WHERE d.movimiento_id = m.id AND d.estado = 'propuesta') AS regla
         FROM movimientos m WHERE m.company_id = $1 ORDER BY m.fecha`,
      [A],
    );

    expect(resultado).toHaveLength(MOVIMIENTOS.length);
    MOVIMIENTOS.forEach((m, i) => {
      const obtenido = resultado[i];
      expect(obtenido.descripcion).toBe(m.descripcion);
      if (m.esperado.estado === 'sugerencia') {
        expect(obtenido.regla).toBe(m.esperado.regla);
      } else if (m.esperado.estado === 'sin_match') {
        expect(obtenido.regla).toBeNull();
        expect(obtenido.regla_sin_match).not.toBeNull();
      } else {
        expect(obtenido.regla).toBeNull();
        expect(obtenido.regla_sin_match).toBeNull();
        expect(obtenido.clase).toBe(m.esperado.clase ?? null);
      }
    });

    // La cancelada y la de dólares no participan: ninguna propuesta las usa.
    const usadas = await filas<{ folio: string }>(
      ds,
      `SELECT DISTINCT f.folio FROM decision_lineas l JOIN cfdi f ON f.id = l.cfdi_id`,
    );
    expect(usadas.map((u) => u.folio).sort()).toEqual([
      '5001',
      '5002',
      '5003',
      '5004',
      '5005',
    ]);
  });

  it('el CSV equivalente trae los mismos movimientos que el PDF cargado', () => {
    const lineas = leer(CSV_EQUIVALENTE).toString('utf8').trim().split('\n');
    expect(lineas).toHaveLength(MOVIMIENTOS.length + 1);
  });
});
