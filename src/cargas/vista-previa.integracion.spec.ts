import { readFileSync } from 'fs';
import { join } from 'path';
import type { DataSource } from 'typeorm';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { ColaSugerencias } from '../sugerencias/cola-sugerencias';
import { huellaMovimiento } from '../bancos/huella-movimiento';
import { filas, una } from '../database/testing/base-de-pruebas';
import request from '../testing/supertest-con-origen';
import {
  ANA,
  type AppDeCargas,
  CARMEN,
  FERRETERIA,
  JORGE,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from './testing/app-de-cargas';

/**
 * Historia 3.4: vista previa de un PDF en espera, y aceptarlo o rechazarlo.
 * SINTÉTICO: el PDF de BBVA es el fixture de la historia, no un estado de
 * cuenta real. Contra Postgres real y la app completa (RLS activo).
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
}, 60_000);

/**
 * La base de pruebas se comparte y la prueba de reversibilidad de migraciones
 * falla si quedan cargas 'rechazada' o 'pendiente_vista_previa': cada prueba
 * parte de cero y la suite deja todo limpio. El dueño borra sin RLS.
 */
async function limpiar(): Promise<void> {
  const propias = `(SELECT id FROM cargas WHERE tipo = 'estado_cuenta'
                     AND nombre_archivo LIKE 'vp-%')`;
  await ds.query(
    `DELETE FROM conciliaciones WHERE movimiento_id IN
       (SELECT id FROM movimientos WHERE carga_id IN ${propias})`,
  );
  await ds.query(`DELETE FROM movimientos WHERE carga_id IN ${propias}`);
  await ds.query(`DELETE FROM movimientos WHERE descripcion = 'vp-previo'`);
  await ds.query(
    `DELETE FROM movimientos_pendientes WHERE carga_id IN ${propias}`,
  );
  await ds.query(
    `DELETE FROM bitacora WHERE entidad = 'cargas'
        AND (entidad_id IN ${propias} OR entidad_id IS NULL)`,
  );
  await ds.query(
    `DELETE FROM bitacora WHERE accion = 'acceso_denegado'
        AND datos ->> 'ruta' LIKE '/cargas/%'`,
  );
  await ds.query(
    `DELETE FROM cargas WHERE tipo = 'estado_cuenta' AND nombre_archivo LIKE 'vp-%'`,
  );
}

beforeEach(async () => {
  await limpiar();
});

afterAll(async () => {
  if (ds?.isInitialized) await limpiar();
  await entorno?.cerrar();
});

const BBVA = readFileSync(
  join(__dirname, '..', 'bancos', 'fixtures', 'bbva-sintetico.pdf'),
);

/** Sube el PDF sintético y devuelve la carga que quedó en espera. */
async function subirPdf(correo: string, rfc: string): Promise<string> {
  const res = await request(entorno.app.getHttpServer())
    .post('/cargas/estado-cuenta/pdf')
    .set('Cookie', await entorno.token(correo, rfc))
    .field('banco', 'bbva')
    .attach('archivo', BBVA, 'vp-bbva.pdf')
    .expect(200);
  return (res.body as { cargaId: string }).cargaId;
}

async function llamar(
  metodo: 'get' | 'post',
  ruta: string,
  correo: string | null,
  esperado: number,
  rfc: string = FERRETERIA,
) {
  let req = request(entorno.app.getHttpServer())[metodo](ruta);
  if (correo) req = req.set('Cookie', await entorno.token(correo, rfc));
  return req.expect(esperado);
}

describe('GET /cargas/:id/vista-previa (T2)', () => {
  it('trae los movimientos leídos, el total y los saldos, exactos', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    const res = await llamar(
      'get',
      `/cargas/${cargaId}/vista-previa`,
      LUIS,
      200,
    );
    expect(res.body).toEqual({
      cargaId,
      archivo: 'vp-bbva.pdf',
      banco: 'bbva',
      total: 2,
      saldoInicial: '10000.0000',
      saldoFinal: '11250.5000',
      resumen: { nuevos: 2, existentes: 0, dudosos: 0 },
      movimientos: [
        { fecha: '2026-10-02', monto: '-250.0000', referencia: null },
        { fecha: '2026-10-15', monto: '1500.5000', referencia: 'SINT-0001' },
      ],
    });
  });

  it('un admin también la ve', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('get', `/cargas/${cargaId}/vista-previa`, ANA, 200);
  });

  it('una carga que no está en espera: 404', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await ds.query(`UPDATE cargas SET estado = 'rechazada' WHERE id = $1`, [
      cargaId,
    ]);
    await llamar('get', `/cargas/${cargaId}/vista-previa`, LUIS, 404);
  });

  it('una carga que no es de PDF o no existe: 404', async () => {
    await llamar(
      'get',
      '/cargas/0198f3a0-0000-7000-8000-000000000000/vista-previa',
      LUIS,
      404,
    );
  });

  it('la carga de otra empresa: 404, igual que una inexistente', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar(
      'get',
      `/cargas/${cargaId}/vista-previa`,
      CARMEN,
      404,
      TRANSPORTES,
    );
  });

  it('un id que no es uuid: 400', async () => {
    await llamar('get', '/cargas/xyz/vista-previa', LUIS, 400);
  });

  it('sin sesión: 401; revisor: 403', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('get', `/cargas/${cargaId}/vista-previa`, null, 401);
    await llamar(
      'get',
      `/cargas/${cargaId}/vista-previa`,
      JORGE,
      403,
      TRANSPORTES,
    );
  });

  it('no escribe nada: la espera queda intacta', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('get', `/cargas/${cargaId}/vista-previa`, LUIS, 200);
    expect(
      await filas(
        ds,
        `SELECT 1 FROM movimientos_pendientes WHERE carga_id = $1`,
        [cargaId],
      ),
    ).toHaveLength(2);
    expect(
      await una<{ estado: string }>(
        ds,
        `SELECT estado FROM cargas WHERE id = $1`,
        [cargaId],
      ),
    ).toEqual({ estado: 'pendiente_vista_previa' });
  });
});

const conteoDeMovimientos = (cargaId: string) =>
  una<{ n: number }>(
    ds,
    `SELECT count(*)::int AS n FROM movimientos WHERE carga_id = $1`,
    [cargaId],
  );

const pendientesDe = (cargaId: string) =>
  una<{ n: number }>(
    ds,
    `SELECT count(*)::int AS n FROM movimientos_pendientes WHERE carga_id = $1`,
    [cargaId],
  );

const bitacoraDe = (cargaId: string, accion: string) =>
  filas<{ user_id: string; datos: Record<string, unknown> }>(
    ds,
    `SELECT user_id, datos FROM bitacora
      WHERE entidad = 'cargas' AND entidad_id = $1 AND accion = $2`,
    [cargaId, accion],
  );

const denegados = () =>
  filas<{ datos: Record<string, unknown> }>(
    ds,
    `SELECT datos FROM bitacora
      WHERE accion = 'acceso_denegado' AND datos ->> 'ruta' LIKE '/cargas/%'`,
  );

const totalEnBandeja = async (correo: string, rfc: string) => {
  const res = await llamar('get', '/bandeja', correo, 200, rfc);
  return (res.body as { total: number }).total;
};

describe('POST /cargas/:id/aceptar (T3)', () => {
  let conciliar: jest.SpyInstance;
  let encolar: jest.SpyInstance;

  beforeEach(() => {
    conciliar = jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });
    const cola = entorno.app.get(ColaSugerencias);
    jest.spyOn(cola, 'activa', 'get').mockReturnValue(true);
    encolar = jest.spyOn(cola, 'encolar').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mueve los movimientos, deja la carga procesada y arranca la conciliación', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    const res = await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 200);
    expect(res.body).toEqual({
      cargaId,
      estado: 'procesada',
      movimientos: 2,
      nuevos: 2,
      existentes: 0,
      dudosos: 0,
    });

    const movimientos = await filas<Record<string, unknown>>(
      ds,
      `SELECT company_id, linea_numero, fecha::text AS fecha, descripcion,
              referencia, monto::text AS monto, moneda, banco, cuenta, estado
         FROM movimientos WHERE carga_id = $1 ORDER BY linea_numero`,
      [cargaId],
    );
    expect(movimientos).toEqual([
      {
        company_id: entorno.empresa(FERRETERIA),
        linea_numero: 1,
        fecha: '2026-10-02',
        descripcion: 'PAGO PROVEEDOR SINTETICO',
        referencia: null,
        monto: '-250.0000',
        moneda: 'MXN',
        banco: 'bbva',
        cuenta: null,
        estado: 'abierto',
      },
      {
        company_id: entorno.empresa(FERRETERIA),
        linea_numero: 2,
        fecha: '2026-10-15',
        descripcion: 'DEPOSITO CLIENTE SINTETICO',
        referencia: 'SINT-0001',
        monto: '1500.5000',
        moneda: 'MXN',
        banco: 'bbva',
        cuenta: null,
        estado: 'abierto',
      },
    ]);
    expect((await pendientesDe(cargaId)).n).toBe(0);

    const carga = await una<Record<string, unknown>>(
      ds,
      `SELECT estado, total_registros, registros_ok, registros_existentes,
              registros_error, procesada_at IS NOT NULL AS termino
         FROM cargas WHERE id = $1`,
      [cargaId],
    );
    expect(carga).toEqual({
      estado: 'procesada',
      total_registros: 2,
      registros_ok: 2,
      registros_existentes: 0,
      registros_error: 0,
      termino: true,
    });

    const [entrada, ...resto] = await bitacoraDe(cargaId, 'confirmar');
    expect(resto).toHaveLength(0);
    expect(entrada.user_id).toBe(entorno.persona(LUIS));
    expect(entrada.datos).toMatchObject({
      cargaId,
      archivo: 'vp-bbva.pdf',
      movimientos: 2,
      estado: 'procesada',
    });

    expect(conciliar).toHaveBeenCalledTimes(1);
    expect(conciliar).toHaveBeenCalledWith(entorno.empresa(FERRETERIA));
    expect(encolar).toHaveBeenCalledWith(entorno.empresa(FERRETERIA));
  });

  it('mientras espera, la bandeja no ve nada y conciliar no encuentra nada; al aceptar, sí', async () => {
    jest.restoreAllMocks();
    const antes = await totalEnBandeja(LUIS, FERRETERIA);
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    expect(await totalEnBandeja(LUIS, FERRETERIA)).toBe(antes);
    await entorno.app
      .get(ConciliacionService)
      .conciliar(entorno.empresa(FERRETERIA));
    expect(await totalEnBandeja(LUIS, FERRETERIA)).toBe(antes);
    expect((await conteoDeMovimientos(cargaId)).n).toBe(0);

    await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 200);
    expect((await conteoDeMovimientos(cargaId)).n).toBe(2);
    expect(await totalEnBandeja(LUIS, FERRETERIA)).toBeGreaterThan(antes);
  });

  it('aceptar dos veces no duplica: la segunda es 409', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 200);
    await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 409);
    expect((await conteoDeMovimientos(cargaId)).n).toBe(2);
    expect(await bitacoraDe(cargaId, 'confirmar')).toHaveLength(1);
    expect(conciliar).toHaveBeenCalledTimes(1);
  });

  it('dos aceptaciones simultáneas: una gana, la otra 409, sin duplicar', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    const estados = (
      await Promise.all(
        [1, 2].map(async () => {
          const token = await entorno.token(LUIS, FERRETERIA);
          return request(entorno.app.getHttpServer())
            .post(`/cargas/${cargaId}/aceptar`)
            .set('Cookie', token);
        }),
      )
    )
      .map((r) => r.status)
      .sort();
    expect(estados).toEqual([200, 409]);
    expect((await conteoDeMovimientos(cargaId)).n).toBe(2);
    expect(await bitacoraDe(cargaId, 'confirmar')).toHaveLength(1);
  });

  it('si algo falla a medias, no queda nada movido', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    // Una línea ya ocupada en `movimientos` hace saltar el índice único a la
    // mitad del INSERT … SELECT.
    await ds.query(
      `INSERT INTO movimientos (company_id, carga_id, linea_numero, fecha,
                                descripcion, monto)
       VALUES ($1, $2, 2, '2026-10-15', 'ocupada', 1)`,
      [entorno.empresa(FERRETERIA), cargaId],
    );
    await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 500);

    expect((await pendientesDe(cargaId)).n).toBe(2);
    expect((await conteoDeMovimientos(cargaId)).n).toBe(1);
    expect(
      await una<{ estado: string; registros_ok: number }>(
        ds,
        `SELECT estado, registros_ok FROM cargas WHERE id = $1`,
        [cargaId],
      ),
    ).toEqual({ estado: 'pendiente_vista_previa', registros_ok: 0 });
    expect(await bitacoraDe(cargaId, 'confirmar')).toHaveLength(0);
    expect(conciliar).not.toHaveBeenCalled();
  });

  it('si conciliar o encolar fallan, la respuesta sigue siendo 200', async () => {
    conciliar.mockRejectedValue(new Error('motor caído'));
    encolar.mockRejectedValue(new Error('redis caído'));
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 200);
    expect((await conteoDeMovimientos(cargaId)).n).toBe(2);
  });

  it('una carga que no está en espera: 409 y no se toca', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await ds.query(`UPDATE cargas SET estado = 'fallida' WHERE id = $1`, [
      cargaId,
    ]);
    await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 409);
    expect((await pendientesDe(cargaId)).n).toBe(2);
    expect((await conteoDeMovimientos(cargaId)).n).toBe(0);
  });

  it('inexistente, ajena o con id inválido: 404 / 404 / 400', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar(
      'post',
      '/cargas/0198f3a0-0000-7000-8000-000000000000/aceptar',
      LUIS,
      404,
    );
    await llamar(
      'post',
      `/cargas/${cargaId}/aceptar`,
      CARMEN,
      404,
      TRANSPORTES,
    );
    await llamar('post', '/cargas/xyz/aceptar', LUIS, 400);
    expect((await pendientesDe(cargaId)).n).toBe(2);
  });

  it('sin sesión: 401; revisor: 403 con acceso denegado, sin tocar nada', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${cargaId}/aceptar`, null, 401);
    const antes = (await denegados()).length;
    await llamar('post', `/cargas/${cargaId}/aceptar`, JORGE, 403, TRANSPORTES);
    const despues = await denegados();
    expect(despues).toHaveLength(antes + 1);
    expect(despues.at(-1)?.datos).toMatchObject({
      metodo: 'POST',
      ruta: `/cargas/${cargaId}/aceptar`,
    });
    expect((await pendientesDe(cargaId)).n).toBe(2);
    expect((await conteoDeMovimientos(cargaId)).n).toBe(0);
  });

  it('un admin también acepta', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${cargaId}/aceptar`, ANA, 200);
  });
});

describe('POST /cargas/:id/rechazar (T4)', () => {
  let conciliar: jest.SpyInstance;

  beforeEach(() => {
    conciliar = jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('descarta la espera, deja la carga rechazada y no entra nada a movimientos', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    const res = await llamar('post', `/cargas/${cargaId}/rechazar`, LUIS, 200);
    expect(res.body).toEqual({ cargaId, estado: 'rechazada' });

    expect((await pendientesDe(cargaId)).n).toBe(0);
    expect((await conteoDeMovimientos(cargaId)).n).toBe(0);
    expect(
      await una<Record<string, unknown>>(
        ds,
        `SELECT estado, total_registros, registros_ok, registros_existentes,
                registros_error
           FROM cargas WHERE id = $1`,
        [cargaId],
      ),
    ).toEqual({
      estado: 'rechazada',
      total_registros: 2,
      registros_ok: 0,
      registros_existentes: 0,
      registros_error: 0,
    });

    const [entrada, ...resto] = await bitacoraDe(cargaId, 'rechazar');
    expect(resto).toHaveLength(0);
    expect(entrada.user_id).toBe(entorno.persona(LUIS));
    expect(entrada.datos).toMatchObject({
      cargaId,
      archivo: 'vp-bbva.pdf',
      estado: 'rechazada',
      movimientosDescartados: 2,
    });
    expect(conciliar).not.toHaveBeenCalled();
  });

  it('el historial muestra la carga como rechazada y la vista previa ya no existe', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${cargaId}/rechazar`, LUIS, 200);
    const lista = await llamar('get', '/cargas', LUIS, 200);
    const cuerpo = lista.body as {
      datos: Array<{ id: string; estado: string }>;
    };
    expect(cuerpo.datos.find((c) => c.id === cargaId)?.estado).toBe(
      'rechazada',
    );
    await llamar('get', `/cargas/${cargaId}/vista-previa`, LUIS, 404);
  });

  it('rechazar dos veces: la segunda es 409 y no duplica la bitácora', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${cargaId}/rechazar`, LUIS, 200);
    await llamar('post', `/cargas/${cargaId}/rechazar`, LUIS, 409);
    expect(await bitacoraDe(cargaId, 'rechazar')).toHaveLength(1);
  });

  it('una carga ya aceptada no se puede rechazar, ni una rechazada aceptar', async () => {
    const aceptada = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${aceptada}/aceptar`, LUIS, 200);
    await llamar('post', `/cargas/${aceptada}/rechazar`, LUIS, 409);
    expect((await conteoDeMovimientos(aceptada)).n).toBe(2);
    expect(
      await una<{ estado: string }>(
        ds,
        `SELECT estado FROM cargas WHERE id = $1`,
        [aceptada],
      ),
    ).toEqual({ estado: 'procesada' });

    await limpiar();
    const rechazada = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${rechazada}/rechazar`, LUIS, 200);
    await llamar('post', `/cargas/${rechazada}/aceptar`, LUIS, 409);
    expect((await conteoDeMovimientos(rechazada)).n).toBe(0);
  });

  it('aceptar y rechazar a la vez: una gana y la otra 409, sin mezclar', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    const token = await entorno.token(LUIS, FERRETERIA);
    const [a, r] = await Promise.all(
      ['aceptar', 'rechazar'].map((accion) =>
        request(entorno.app.getHttpServer())
          .post(`/cargas/${cargaId}/${accion}`)
          .set('Cookie', token),
      ),
    );
    expect([a.status, r.status].sort()).toEqual([200, 409]);
    const { estado } = await una<{ estado: string }>(
      ds,
      `SELECT estado FROM cargas WHERE id = $1`,
      [cargaId],
    );
    expect((await pendientesDe(cargaId)).n).toBe(0);
    expect((await conteoDeMovimientos(cargaId)).n).toBe(
      estado === 'procesada' ? 2 : 0,
    );
  });

  it('inexistente, ajena o con id inválido: 404 / 404 / 400', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar(
      'post',
      '/cargas/0198f3a0-0000-7000-8000-000000000000/rechazar',
      LUIS,
      404,
    );
    await llamar(
      'post',
      `/cargas/${cargaId}/rechazar`,
      CARMEN,
      404,
      TRANSPORTES,
    );
    await llamar('post', '/cargas/xyz/rechazar', LUIS, 400);
    expect((await pendientesDe(cargaId)).n).toBe(2);
  });

  it('sin sesión: 401; revisor: 403 con acceso denegado, sin tocar nada', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${cargaId}/rechazar`, null, 401);
    const antes = (await denegados()).length;
    await llamar(
      'post',
      `/cargas/${cargaId}/rechazar`,
      JORGE,
      403,
      TRANSPORTES,
    );
    const despues = await denegados();
    expect(despues).toHaveLength(antes + 1);
    expect(despues.at(-1)?.datos).toMatchObject({
      metodo: 'POST',
      ruta: `/cargas/${cargaId}/rechazar`,
    });
    expect((await pendientesDe(cargaId)).n).toBe(2);
    expect(await bitacoraDe(cargaId, 'rechazar')).toHaveLength(0);
  });

  it('un admin también rechaza', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${cargaId}/rechazar`, ANA, 200);
  });
});

describe('volver a subir un PDF rechazado', () => {
  let conciliar: jest.SpyInstance;

  beforeEach(() => {
    conciliar = jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const subirOtraVez = (correo: string) =>
    request(entorno.app.getHttpServer())
      .post('/cargas/estado-cuenta/pdf')
      .set('Cookie', entornoToken.get(correo) as string)
      .field('banco', 'bbva')
      .attach('archivo', BBVA, 'vp-bbva.pdf');
  const entornoToken = new Map<string, string>();

  beforeEach(async () => {
    entornoToken.set(LUIS, await entorno.token(LUIS, FERRETERIA));
  });

  it('reabre la misma carga: espera de vuelta, vista previa y aceptar funcionan', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${cargaId}/rechazar`, LUIS, 200);
    expect((await pendientesDe(cargaId)).n).toBe(0);

    const res = await subirOtraVez(LUIS).expect(200);
    expect(res.body).toMatchObject({
      cargaId,
      estado: 'pendiente_vista_previa',
      yaExistia: false,
    });
    expect((await pendientesDe(cargaId)).n).toBe(2);
    expect(
      await una<Record<string, unknown>>(
        ds,
        `SELECT estado, total_registros, registros_ok, registros_existentes,
                registros_error, saldo_inicial::text AS saldo_inicial
           FROM cargas WHERE id = $1`,
        [cargaId],
      ),
    ).toMatchObject({
      estado: 'pendiente_vista_previa',
      total_registros: 2,
      registros_ok: 0,
      registros_existentes: 0,
      registros_error: 0,
    });

    const vista = await llamar(
      'get',
      `/cargas/${cargaId}/vista-previa`,
      LUIS,
      200,
    );
    expect((vista.body as { total: number }).total).toBe(2);
    await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 200);
    expect((await conteoDeMovimientos(cargaId)).n).toBe(2);
  });

  it('deja una entrada cargar que dice que es una nueva subida', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${cargaId}/rechazar`, LUIS, 200);
    await subirOtraVez(LUIS).expect(200);
    const entradas = await bitacoraDe(cargaId, 'cargar');
    expect(entradas).toHaveLength(2);
    expect(entradas.filter((e) => e.datos.resubida === true)).toHaveLength(1);
  });

  it('rechazar de nuevo y volver a subir otra vez también funciona', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    for (let i = 0; i < 2; i++) {
      await llamar('post', `/cargas/${cargaId}/rechazar`, LUIS, 200);
      await subirOtraVez(LUIS).expect(200);
      expect((await pendientesDe(cargaId)).n).toBe(2);
    }
  });

  it('dos subidas simultáneas de un rechazado: una sola espera, sin duplicar', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${cargaId}/rechazar`, LUIS, 200);
    const [a, b] = await Promise.all([subirOtraVez(LUIS), subirOtraVez(LUIS)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(
      [a, b].filter((r) => (r.body as { yaExistia: boolean }).yaExistia),
    ).toHaveLength(1);
    expect((await pendientesDe(cargaId)).n).toBe(2);
    expect(
      (await bitacoraDe(cargaId, 'cargar')).filter(
        (e) => e.datos.resubida === true,
      ),
    ).toHaveLength(1);
  });

  it('una carga procesada no se reabre: sigue siendo yaExistia', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 200);
    const res = await subirOtraVez(LUIS).expect(200);
    expect(res.body).toMatchObject({
      cargaId,
      estado: 'procesada',
      yaExistia: true,
    });
    expect((await pendientesDe(cargaId)).n).toBe(0);
    expect((await conteoDeMovimientos(cargaId)).n).toBe(2);
    expect(conciliar).toHaveBeenCalled();
  });
});

describe('vista previa de una carga sin saldos (anterior a la migración)', () => {
  it('devuelve saldoInicial y saldoFinal en null, sin fallar', async () => {
    const cargaId = await subirPdf(LUIS, FERRETERIA);
    await ds.query(
      `UPDATE cargas SET saldo_inicial = NULL, saldo_final = NULL WHERE id = $1`,
      [cargaId],
    );
    const res = await llamar(
      'get',
      `/cargas/${cargaId}/vista-previa`,
      LUIS,
      200,
    );
    expect(res.body).toMatchObject({
      cargaId,
      total: 2,
      saldoInicial: null,
      saldoFinal: null,
    });
  });
});

// ---------------------------------------------------------------------------
// Historia 3.5 (T4): huellas al aceptar la vista previa.
// ---------------------------------------------------------------------------

interface FilaDePrueba {
  fecha: string;
  monto: string;
  referencia: string | null;
}

let consecutivo = 0;

/** Una carga en espera con las filas dadas, sin pasar por el lector de PDF. */
async function crearEnEspera(
  rfc: string,
  filasEnEspera: FilaDePrueba[],
): Promise<string> {
  const empresa = entorno.empresa(rfc);
  const n = ++consecutivo;
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cargas (company_id, tipo, nombre_archivo, hash_archivo,
                         estado, total_registros, banco)
     VALUES ($1, 'estado_cuenta', $2, $3, 'pendiente_vista_previa', $4, 'bbva')
     RETURNING id`,
    [
      empresa,
      `vp-huella-${n}.pdf`,
      `h${n}`.padEnd(64, '0'),
      filasEnEspera.length,
    ],
  );
  for (const [i, f] of filasEnEspera.entries()) {
    await ds.query(
      `INSERT INTO movimientos_pendientes
         (company_id, carga_id, linea_numero, fecha, descripcion, referencia, monto)
       VALUES ($1, $2, $3, $4, 'vp-espera', $5, $6)`,
      [empresa, id, i + 1, f.fecha, f.referencia, f.monto],
    );
  }
  return id;
}

/** Un movimiento que ya estaba en la base, en el estado dado. */
async function sembrarPrevio(
  rfc: string,
  f: FilaDePrueba,
  estado: string,
): Promise<void> {
  await ds.query(
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion,
                              referencia, monto, estado, huella)
     VALUES ($1, $2, $3, 'vp-previo', $4, $5, $6, $7)`,
    [
      entorno.empresa(rfc),
      ++consecutivo,
      f.fecha,
      f.referencia,
      f.monto,
      estado,
      huellaMovimiento({ cuenta: null, ...f }),
    ],
  );
}

const A: FilaDePrueba = {
  fecha: '2026-10-02',
  monto: '-250.0000',
  referencia: 'REF-A',
};
const B: FilaDePrueba = {
  fecha: '2026-10-15',
  monto: '1500.5000',
  referencia: 'REF-B',
};
const C: FilaDePrueba = {
  fecha: '2026-10-20',
  monto: '90.0000',
  referencia: 'REF-C',
};

const movimientosDeCarga = (cargaId: string) =>
  filas<{ estado: string; huella: string; linea_numero: number }>(
    ds,
    `SELECT estado, huella, linea_numero FROM movimientos
      WHERE carga_id = $1 ORDER BY linea_numero`,
    [cargaId],
  );

describe('huellas al aceptar (3.5, T4)', () => {
  let conciliar: jest.SpyInstance;

  beforeEach(() => {
    conciliar = jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });
    const cola = entorno.app.get(ColaSugerencias);
    jest.spyOn(cola, 'activa', 'get').mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('el resumen cuenta nuevos, existentes (cualquier estado) y dudosos', async () => {
    await sembrarPrevio(FERRETERIA, A, 'descartado');
    await sembrarPrevio(FERRETERIA, { ...B, referencia: 'ref b' }, 'abierto');
    const cargaId = await crearEnEspera(FERRETERIA, [A, B, C]);
    const res = await llamar(
      'get',
      `/cargas/${cargaId}/vista-previa`,
      LUIS,
      200,
    );
    expect(res.body).toMatchObject({
      total: 3,
      resumen: { nuevos: 1, existentes: 1, dudosos: 1 },
    });
  });

  it('aceptar importa nuevos y dudosos, omite los exactos y cuadra los contadores', async () => {
    await sembrarPrevio(FERRETERIA, A, 'conciliado');
    await sembrarPrevio(FERRETERIA, { ...B, referencia: 'ref b' }, 'abierto');
    const cargaId = await crearEnEspera(FERRETERIA, [A, B, C]);
    const res = await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 200);
    expect(res.body).toEqual({
      cargaId,
      estado: 'procesada',
      movimientos: 2,
      nuevos: 1,
      existentes: 1,
      dudosos: 1,
    });

    const importados = await movimientosDeCarga(cargaId);
    expect(importados.map((m) => [m.linea_numero, m.estado])).toEqual([
      [2, 'pendiente_revision'],
      [3, 'abierto'],
    ]);
    expect(importados[0].huella).toBe(huellaMovimiento({ cuenta: null, ...B }));
    expect(importados[1].huella).toBe(huellaMovimiento({ cuenta: null, ...C }));
    expect((await pendientesDe(cargaId)).n).toBe(0);

    expect(
      await una(
        ds,
        `SELECT estado, total_registros, registros_ok, registros_existentes,
                registros_error FROM cargas WHERE id = $1`,
        [cargaId],
      ),
    ).toEqual({
      estado: 'procesada',
      total_registros: 3,
      registros_ok: 2,
      registros_existentes: 1,
      registros_error: 0,
    });
    const [entrada] = await bitacoraDe(cargaId, 'confirmar');
    expect(entrada.datos).toMatchObject({
      nuevos: 1,
      existentes: 1,
      dudosos: 1,
    });
    expect(JSON.stringify(entrada.datos)).not.toContain('REF-');
    expect(conciliar).toHaveBeenCalledTimes(1);
  });

  it('todo existente: procesada con ok = 0 y no arranca la conciliación', async () => {
    await sembrarPrevio(FERRETERIA, A, 'abierto');
    await sembrarPrevio(FERRETERIA, B, 'descartado');
    const cargaId = await crearEnEspera(FERRETERIA, [A, B]);
    const res = await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 200);
    expect(res.body).toMatchObject({
      movimientos: 0,
      nuevos: 0,
      existentes: 2,
      dudosos: 0,
    });
    expect((await conteoDeMovimientos(cargaId)).n).toBe(0);
    expect(
      await una(
        ds,
        `SELECT estado, registros_ok, registros_existentes FROM cargas WHERE id = $1`,
        [cargaId],
      ),
    ).toEqual({
      estado: 'procesada',
      registros_ok: 0,
      registros_existentes: 2,
    });
    expect(conciliar).not.toHaveBeenCalled();
  });

  it('solo dudosos: entran como pendiente_revision y no se concilia', async () => {
    await sembrarPrevio(FERRETERIA, { ...A, referencia: 'ref a' }, 'abierto');
    const cargaId = await crearEnEspera(FERRETERIA, [A]);
    await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 200);
    expect((await movimientosDeCarga(cargaId)).map((m) => m.estado)).toEqual([
      'pendiente_revision',
    ]);
    expect(conciliar).not.toHaveBeenCalled();
  });

  it('multiplicidad: la base tiene 1 y la carga trae 2 iguales -> 1 existente y 1 nuevo', async () => {
    await sembrarPrevio(FERRETERIA, A, 'abierto');
    const cargaId = await crearEnEspera(FERRETERIA, [A, A]);
    const res = await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 200);
    expect(res.body).toMatchObject({ nuevos: 1, existentes: 1, dudosos: 0 });
    expect((await conteoDeMovimientos(cargaId)).n).toBe(1);
  });

  it('otra empresa con los mismos movimientos no cuenta como existente', async () => {
    await sembrarPrevio(TRANSPORTES, A, 'abierto');
    const cargaId = await crearEnEspera(FERRETERIA, [A]);
    const res = await llamar('post', `/cargas/${cargaId}/aceptar`, LUIS, 200);
    expect(res.body).toMatchObject({ nuevos: 1, existentes: 0, dudosos: 0 });
  });

  it('dos cargas con los mismos movimientos aceptadas a la vez: sin duplicar', async () => {
    const c1 = await crearEnEspera(FERRETERIA, [A, B]);
    const c2 = await crearEnEspera(FERRETERIA, [A, B]);
    const respuestas = await Promise.all(
      [c1, c2].map(async (id) =>
        request(entorno.app.getHttpServer())
          .post(`/cargas/${id}/aceptar`)
          .set('Cookie', await entorno.token(LUIS, FERRETERIA)),
      ),
    );
    expect(respuestas.map((r) => r.status)).toEqual([200, 200]);
    const cuerpos = respuestas.map(
      (r) => r.body as { nuevos: number; existentes: number },
    );
    expect(cuerpos.map((c) => c.nuevos).sort()).toEqual([0, 2]);
    expect(cuerpos.map((c) => c.existentes).sort()).toEqual([0, 2]);
    expect(
      (await conteoDeMovimientos(c1)).n + (await conteoDeMovimientos(c2)).n,
    ).toBe(2);
  });
});
