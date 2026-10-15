import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { createHash, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { request as peticionHttp } from 'http';
import { join } from 'path';
import request from '../testing/supertest-con-origen';
import type { DataSource } from 'typeorm';
import { filas, una } from '../database/testing/base-de-pruebas';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import {
  MAX_ARCHIVOS,
  MAX_BYTES_POR_ARCHIVO,
  MAX_BYTES_POR_PETICION,
} from './archivos.guard';
import type { ResultadoDeArchivo } from './carga.entity';
import {
  type EstadoDeCarga,
  hashDelLote,
  type RespuestaDeCarga,
} from './cargas.service';
import { COLA_CARGAS, ColaCargas, type TrabajoDeCarga } from './cola-cargas';
import { MENSAJE_FALLIDA, ProcesadorCargas } from './procesador-cargas';
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
 * CU-06, CU-07 y CU-08 de punta a punta: HTTP, guards globales, transacción
 * de empresa como cuadra_app (RLS activo), Postgres real y la cola en el
 * Redis del compose, con el worker corriendo en el mismo proceso. XML
 * sintéticos de CU-05.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let app: AppDeCargas['app'];
/** Dueño: limpia y verifica sin RLS. */
let ds: DataSource;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ app, ds } = entorno);
}, 60_000);

afterAll(async () => {
  await entorno?.cerrar();
});

const tokenSesion = (email: string, rfc: string) => entorno.token(email, rfc);
const esperarFin = (token: string, id: string) => entorno.esperarFin(token, id);

/**
 * Fixture de CU-05 con UUID nuevo: cada test es independiente de los demás
 * y de corridas anteriores.
 */
function cfdi(nombre: string, uuid = randomUUID().toUpperCase()) {
  const original = readFileSync(
    join(__dirname, '..', 'cfdi', 'fixtures', nombre),
    'utf8',
  );
  return {
    uuid,
    xml: original.replace(/UUID="[^"]+"/, `UUID="${uuid}"`),
  };
}

interface Archivo {
  nombre: string;
  contenido: string | Buffer;
}

function subir(token: string, archivos: Archivo[]) {
  let req = request(app.getHttpServer())
    .post('/cargas/cfdi')
    .set('Cookie', token);
  for (const { nombre, contenido } of archivos) {
    req = req.attach('archivos', Buffer.from(contenido), nombre);
  }
  return req;
}

async function conteos() {
  return una<{ cfdi: number; cargas: number }>(
    ds,
    `SELECT (SELECT count(*)::int FROM cfdi) AS cfdi,
            (SELECT count(*)::int FROM cargas) AS cargas`,
  );
}

/**
 * Multipart a mano con Transfer-Encoding: chunked. Supertest siempre manda
 * Content-Length, así que el atajo del header se llevaría este caso y el
 * contador del almacenamiento quedaría sin probar.
 */
async function subirChunked(
  token: string,
  archivos: Archivo[],
): Promise<{ status: number; cuerpo: string }> {
  const frontera = `----cuadra${randomUUID()}`;
  const destino = new URL('/cargas/cfdi', await app.getUrl());
  return new Promise((resolve, reject) => {
    const req = peticionHttp(
      destino,
      {
        method: 'POST',
        headers: {
          cookie: token,
          origin: process.env.ORIGEN_AUTORIZADO as string,
          'content-type': `multipart/form-data; boundary=${frontera}`,
          'transfer-encoding': 'chunked',
        },
      },
      (res) => {
        let cuerpo = '';
        res.setEncoding('utf8');
        res.on('data', (parte: string) => (cuerpo += parte));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, cuerpo }));
      },
    );
    req.on('error', reject);
    for (const { nombre, contenido } of archivos) {
      req.write(
        `--${frontera}\r\nContent-Disposition: form-data; name="archivos"; filename="${nombre}"\r\nContent-Type: application/xml\r\n\r\n`,
      );
      req.write(contenido);
      req.write('\r\n');
    }
    req.end(`--${frontera}--\r\n`);
  });
}

/** POST, comprueba el 202 en 'pendiente' y espera a que el worker termine. */
async function cargarYEsperar(
  token: string,
  archivos: Archivo[],
): Promise<EstadoDeCarga> {
  const res = await subir(token, archivos).expect(202);
  const recibida = res.body as RespuestaDeCarga;
  expect(recibida).toMatchObject({ estado: 'pendiente', yaExistia: false });
  return esperarFin(token, recibida.id);
}

/**
 * Falla de infraestructura real: un trigger que hace RAISE EXCEPTION al
 * insertar el CFDI con ese UUID. Con `veces`, solo las primeras; la cuenta va
 * en una secuencia porque nextval no se revierte con el rollback del intento.
 */
async function conFalla<T>(
  uuid: string,
  veces: number | 'siempre',
  cuerpo: () => Promise<T>,
): Promise<T> {
  const condicion =
    veces === 'siempre' ? 'true' : `nextval('falla_cu08') <= ${veces}`;
  await ds.query('CREATE SEQUENCE falla_cu08');
  await ds.query('GRANT USAGE ON SEQUENCE falla_cu08 TO cuadra_app');
  await ds.query(`
    CREATE FUNCTION falla_cu08() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF ${condicion} THEN
        RAISE EXCEPTION 'falla simulada de la base';
      END IF;
      RETURN NEW;
    END $$`);
  await ds.query(
    `CREATE TRIGGER falla_cu08 BEFORE INSERT ON cfdi
       FOR EACH ROW WHEN (NEW.uuid_fiscal = '${uuid}')
       EXECUTE FUNCTION falla_cu08()`,
  );
  try {
    return await cuerpo();
  } finally {
    await ds.query('DROP TRIGGER falla_cu08 ON cfdi');
    await ds.query('DROP FUNCTION falla_cu08()');
    await ds.query('DROP SEQUENCE falla_cu08');
  }
}

/** Los resultados de un lote de CFDI son por archivo, no por fila. */
function porArchivo(carga: EstadoDeCarga): ResultadoDeArchivo[] {
  return carga.resultados.filter(
    (r): r is ResultadoDeArchivo => 'archivo' in r,
  );
}

function motivoDe(carga: EstadoDeCarga, archivo: string): string {
  const resultado = porArchivo(carga).find((r) => r.archivo === archivo);
  if (resultado?.resultado !== 'error') {
    throw new Error(`"${archivo}" no terminó en error`);
  }
  return resultado.motivo;
}

function mensaje(res: { body: unknown }): string {
  return (res.body as { message: string }).message;
}

async function enCfdi(uuids: string[]) {
  return filas<{ uuid_fiscal: string; estado: string; carga_id: string }>(
    ds,
    'SELECT uuid_fiscal, estado, carga_id FROM cfdi WHERE uuid_fiscal = ANY($1)',
    [uuids],
  );
}

describe('POST /cargas/cfdi en segundo plano (CU-08)', () => {
  it('responde 202 en pendiente y el GET llega a procesada', async () => {
    const token = await tokenSesion(LUIS, FERRETERIA);
    const pue = cfdi('pue-valido.xml');

    const carga = await cargarYEsperar(token, [
      { nombre: 'pue.xml', contenido: pue.xml },
    ]);

    expect(carga).toMatchObject({
      estado: 'procesada',
      totalRegistros: 1,
      registrosOk: 1,
      resultados: [{ archivo: 'pue.xml', resultado: 'nuevo' }],
      errorMensaje: null,
    });
    expect(await enCfdi([pue.uuid])).toEqual([
      expect.objectContaining({ carga_id: carga.id }),
    ]);
  });

  // Si se encolara antes del COMMIT, el worker podría tomar el job y no ver
  // la carga. Esa carrera casi nunca se da en una corrida, así que se mira
  // directo: cuando se llama a encolar(), la carga ya tiene que ser visible
  // desde otra conexión.
  it('encola después del COMMIT: la carga ya es visible desde otra conexión', async () => {
    const cola = app.get(ColaCargas);
    // Antes de espiar: después, cola.encolar ya es el espía. El tipo va
    // explícito porque con strictBindCallApply apagado bind devuelve any.
    const original: (trabajo: TrabajoDeCarga) => Promise<void> =
      cola.encolar.bind(cola) as (trabajo: TrabajoDeCarga) => Promise<void>;
    const visibles: boolean[] = [];
    const espia = jest
      .spyOn(cola, 'encolar')
      .mockImplementation(async (trabajo: TrabajoDeCarga) => {
        const [fila] = await filas(ds, 'SELECT 1 FROM cargas WHERE id = $1', [
          trabajo.cargaId,
        ]);
        visibles.push(fila !== undefined);
        return original(trabajo);
      });
    try {
      await cargarYEsperar(await tokenSesion(ANA, FERRETERIA), [
        { nombre: 'pue.xml', contenido: cfdi('pue-valido.xml').xml },
      ]);
    } finally {
      espia.mockRestore();
    }
    expect(visibles).toEqual([true]);
  });

  it('lote de 3 con 1 inválido: termina en con_errores con su motivo, 2 entran', async () => {
    const pue = cfdi('pue-valido.xml');
    const descuento = cfdi('con-descuento.xml');
    const malo = cfdi('rechazo-total-no-cuadra.xml');

    const carga = await cargarYEsperar(await tokenSesion(LUIS, FERRETERIA), [
      { nombre: 'pue.xml', contenido: pue.xml },
      { nombre: 'malo.xml', contenido: malo.xml },
      { nombre: 'descuento.xml', contenido: descuento.xml },
    ]);

    expect(carga).toMatchObject({
      estado: 'con_errores',
      totalRegistros: 3,
      registrosOk: 2,
      registrosExistentes: 0,
      registrosError: 1,
    });
    expect(porArchivo(carga).map((r) => [r.archivo, r.resultado])).toEqual([
      ['pue.xml', 'nuevo'],
      ['malo.xml', 'error'],
      ['descuento.xml', 'nuevo'],
    ]);
    expect(motivoDe(carga, 'malo.xml')).toMatch(/Total no cuadra/);
    const guardados = await enCfdi([pue.uuid, descuento.uuid, malo.uuid]);
    expect(guardados.map((c) => c.uuid_fiscal).sort()).toEqual(
      [pue.uuid, descuento.uuid].sort(),
    );
  });

  it('todos los XML inválidos: con_errores, no fallida', async () => {
    const carga = await cargarYEsperar(await tokenSesion(ANA, FERRETERIA), [
      { nombre: 'v33.xml', contenido: cfdi('rechazo-version-33.xml').xml },
      { nombre: 'rfc.xml', contenido: cfdi('rechazo-rfc-invalido.xml').xml },
    ]);

    expect(carga).toMatchObject({
      estado: 'con_errores',
      registrosOk: 0,
      registrosError: 2,
      errorMensaje: null,
    });
  });

  it('un archivo con bytes nulos es error del archivo, no tumba al lote', async () => {
    const bueno = cfdi('pue-valido.xml');
    const carga = await cargarYEsperar(await tokenSesion(ANA, FERRETERIA), [
      { nombre: 'nulo.xml', contenido: Buffer.from('<x>\0</x>') },
      { nombre: 'bueno.xml', contenido: bueno.xml },
    ]);

    expect(carga).toMatchObject({ estado: 'con_errores', registrosOk: 1 });
    expect(motivoDe(carga, 'nulo.xml')).toMatch(/bytes nulos/);
  });

  it('un PPD queda en parcialidades', async () => {
    const ppd = cfdi('ppd-valido.xml');
    await cargarYEsperar(await tokenSesion(ANA, FERRETERIA), [
      { nombre: 'ppd.xml', contenido: ppd.xml },
    ]);

    expect(await enCfdi([ppd.uuid])).toEqual([
      expect.objectContaining({ estado: 'parcialidades' }),
    ]);
  });

  describe('reintentos', () => {
    it('falla de infraestructura en los 2 primeros intentos y éxito en el tercero: procesada, sin duplicados', async () => {
      const primero = cfdi('pue-valido.xml');
      const segundo = cfdi('con-descuento.xml');

      // Falla el segundo archivo: el primero ya había entrado en ese
      // intento, así que un rollback incompleto lo dejaría duplicado.
      const carga = await conFalla(segundo.uuid, 2, async () =>
        cargarYEsperar(await tokenSesion(ANA, FERRETERIA), [
          { nombre: 'primero.xml', contenido: primero.xml },
          { nombre: 'segundo.xml', contenido: segundo.xml },
        ]),
      );

      expect(carga).toMatchObject({
        estado: 'procesada',
        registrosOk: 2,
        registrosError: 0,
      });
      const guardados = await enCfdi([primero.uuid, segundo.uuid]);
      expect(guardados.map((c) => c.uuid_fiscal).sort()).toEqual(
        [primero.uuid, segundo.uuid].sort(),
      );
    });

    it('falla en todos los intentos: fallida con mensaje genérico y cero CFDI', async () => {
      const primero = cfdi('pue-valido.xml');
      const segundo = cfdi('con-descuento.xml');

      const carga = await conFalla(segundo.uuid, 'siempre', async () =>
        cargarYEsperar(await tokenSesion(ANA, FERRETERIA), [
          { nombre: 'primero.xml', contenido: primero.xml },
          { nombre: 'segundo.xml', contenido: segundo.xml },
        ]),
      );

      expect(carga).toMatchObject({
        estado: 'fallida',
        totalRegistros: 2,
        registrosOk: 0,
        registrosError: 0,
        resultados: [],
        // Sin el detalle de la base: ese va al log.
        errorMensaje: MENSAJE_FALLIDA,
      });
      const [{ n }] = await filas<{ n: number }>(
        ds,
        'SELECT count(*)::int AS n FROM cfdi WHERE carga_id = $1',
        [carga.id],
      );
      expect(n).toBe(0);
    });
  });

  describe('el worker respeta RLS', () => {
    it('con la empresa A fijada no puede escribir un CFDI de B', async () => {
      const transaccion = app.get(TransaccionEmpresa);
      const intruso = cfdi('pue-valido.xml');

      await expect(
        transaccion.ejecutar(entorno.empresa(FERRETERIA), (manager) =>
          manager.query(
            `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor,
               fecha_emision, tipo_comprobante, subtotal, total, xml_raw)
             VALUES ($1, $2, 'FDB190215QK4', 'TCU170830R52',
               '2026-09-15T10:30:00', 'I', 1, 1, '{"_xml": ""}')`,
            [entorno.empresa(TRANSPORTES), intruso.uuid],
          ),
        ),
      ).rejects.toThrow(/row-level security/);
      expect(await enCfdi([intruso.uuid])).toEqual([]);
    });

    it('un job con la empresa B no toca la carga de A', async () => {
      // Carga de Ferretería en espera, creada por fuera para que ningún job
      // de la cola la tome primero.
      const [{ id: cargaId }] = await filas<{ id: string }>(
        ds,
        `INSERT INTO cargas (company_id, tipo, estado, nombre_archivo,
           hash_archivo, total_registros)
         VALUES ($1, 'cfdi', 'pendiente', 'a.xml', $2, 1) RETURNING id`,
        [entorno.empresa(FERRETERIA), randomUUID().replace(/-/g, '').repeat(2)],
      );
      const pue = cfdi('pue-valido.xml');
      await ds.query(
        `INSERT INTO carga_archivos (company_id, carga_id, orden, nombre, hash, contenido)
         VALUES ($1, $2, 0, 'a.xml', $3, $4)`,
        [entorno.empresa(FERRETERIA), cargaId, 'a'.repeat(64), pue.xml],
      );

      await app
        .get(ProcesadorCargas)
        .procesar({ cargaId, companyId: entorno.empresa(TRANSPORTES) });

      const [carga] = await filas<{ estado: string }>(
        ds,
        'SELECT estado FROM cargas WHERE id = $1',
        [cargaId],
      );
      expect(carga.estado).toBe('pendiente');
      expect(await enCfdi([pue.uuid])).toEqual([]);
    });
  });
});

describe('resubir un lote que no terminó lo reencola (CU-08)', () => {
  it('fallida: vuelve a pendiente, termina procesada, mismo cargaId y sin duplicados', async () => {
    const token = await tokenSesion(ANA, FERRETERIA);
    const primero = cfdi('pue-valido.xml');
    const segundo = cfdi('con-descuento.xml');
    const lote = [
      { nombre: 'primero.xml', contenido: primero.xml },
      { nombre: 'segundo.xml', contenido: segundo.xml },
    ];
    const fallida = await conFalla(segundo.uuid, 'siempre', () =>
      cargarYEsperar(token, lote),
    );
    expect(fallida.estado).toBe('fallida');

    // Ya sin la falla: la base "se recuperó".
    const resubida = (await subir(token, lote).expect(200))
      .body as RespuestaDeCarga;
    expect(resubida).toMatchObject({
      id: fallida.id,
      yaExistia: true,
      estado: 'pendiente',
      registrosOk: 0,
      registrosError: 0,
      registrosExistentes: 0,
      resultados: [],
      errorMensaje: null,
    });

    const final = await esperarFin(token, fallida.id);
    expect(final).toMatchObject({ estado: 'procesada', registrosOk: 2 });
    const guardados = await enCfdi([primero.uuid, segundo.uuid]);
    expect(guardados.map((c) => c.uuid_fiscal).sort()).toEqual(
      [primero.uuid, segundo.uuid].sort(),
    );
  });

  it('en cola: un solo job, y se procesa una vez', async () => {
    const token = await tokenSesion(ANA, FERRETERIA);
    const lote = [{ nombre: 'a.xml', contenido: cfdi('pue-valido.xml').xml }];
    const procesador = app.get(ProcesadorCargas);
    const espia = jest.spyOn(procesador, 'procesar');
    // Worker en pausa: el job se queda en espera mientras se resube.
    await procesador.worker.pause();
    try {
      const recibida = (await subir(token, lote).expect(202))
        .body as RespuestaDeCarga;
      const resubida = (await subir(token, lote).expect(200))
        .body as RespuestaDeCarga;
      expect(resubida).toMatchObject({
        id: recibida.id,
        yaExistia: true,
        estado: 'pendiente',
      });

      const cola = app.get<Queue>(getQueueToken(COLA_CARGAS));
      // La pausa es del worker local: el job sigue en 'waiting'.
      const enEspera = await cola.getJobs(['waiting', 'delayed']);
      expect(enEspera.map((j) => j.id)).toEqual([recibida.id]);

      await procesador.worker.resume();
      await esperarFin(token, recibida.id);
      // Si hubiera un segundo job, correría justo después del primero.
      await new Promise((r) => setTimeout(r, 300));
      const llamadas = espia.mock.calls.filter(
        ([trabajo]) => trabajo.cargaId === recibida.id,
      );
      expect(llamadas).toHaveLength(1);
    } finally {
      await procesador.worker.resume();
      espia.mockRestore();
    }
  });

  it('atorada en procesando sin job: resubir la termina', async () => {
    // Como si el worker hubiera muerto a media carga: 'procesando' en la
    // base y ningún job en Redis.
    const pue = cfdi('pue-valido.xml');
    const hash = createHash('sha256').update(pue.xml).digest('hex');
    const [{ id: cargaId }] = await filas<{ id: string }>(
      ds,
      `INSERT INTO cargas (company_id, tipo, estado, nombre_archivo,
         hash_archivo, total_registros)
       VALUES ($1, 'cfdi', 'procesando', 'atorada.xml', $2, 1) RETURNING id`,
      [entorno.empresa(FERRETERIA), hashDelLote([hash])],
    );
    await ds.query(
      `INSERT INTO carga_archivos (company_id, carga_id, orden, nombre, hash, contenido)
       VALUES ($1, $2, 0, 'atorada.xml', $3, $4)`,
      [entorno.empresa(FERRETERIA), cargaId, hash, pue.xml],
    );

    const token = await tokenSesion(ANA, FERRETERIA);
    const resubida = (
      await subir(token, [
        { nombre: 'atorada.xml', contenido: pue.xml },
      ]).expect(200)
    ).body as RespuestaDeCarga;
    expect(resubida).toMatchObject({
      id: cargaId,
      yaExistia: true,
      estado: 'procesando',
    });

    expect(await esperarFin(token, cargaId)).toMatchObject({
      estado: 'procesada',
      registrosOk: 1,
    });
    expect(await enCfdi([pue.uuid])).toHaveLength(1);
  });
});

describe('POST /cargas/cfdi, idempotencia (CU-07)', () => {
  describe('lote repetido', () => {
    it('la segunda vez: 200, yaExistia, la carga original y nada crece', async () => {
      const token = await tokenSesion(ANA, FERRETERIA);
      const lote = [
        { nombre: 'a.xml', contenido: cfdi('pue-valido.xml').xml },
        { nombre: 'b.xml', contenido: cfdi('con-descuento.xml').xml },
      ];
      const original = await cargarYEsperar(token, lote);
      const antes = await conteos();

      const segunda = (await subir(token, lote).expect(200))
        .body as RespuestaDeCarga;

      expect(segunda).toEqual({ ...original, yaExistia: true });
      expect(await conteos()).toEqual(antes);
    });

    it('en otro orden es el mismo lote: igual que el anterior', async () => {
      const token = await tokenSesion(ANA, FERRETERIA);
      const a = { nombre: 'a.xml', contenido: cfdi('pue-valido.xml').xml };
      const b = { nombre: 'b.xml', contenido: cfdi('con-descuento.xml').xml };
      const original = await cargarYEsperar(token, [a, b]);
      const antes = await conteos();

      const segunda = (await subir(token, [b, a]).expect(200))
        .body as RespuestaDeCarga;

      expect(segunda).toEqual({ ...original, yaExistia: true });
      expect(await conteos()).toEqual(antes);
    });
  });

  describe('CFDI que ya estaba en la empresa', () => {
    // También prueba el savepoint: el ya cargado va primero, y sin ROLLBACK
    // TO SAVEPOINT su 23505 abortaría la transacción y el nuevo no entraría.
    it('lote nuevo con 1 ya cargado + 1 nuevo: 1 nuevo, 1 ya_existia, procesada', async () => {
      const token = await tokenSesion(ANA, FERRETERIA);
      const previo = cfdi('pue-valido.xml');
      await cargarYEsperar(token, [
        { nombre: 'previo.xml', contenido: previo.xml },
      ]);

      // Mismo UUID, otro contenido (otro folio): otro lote, otro hash.
      const repetido = previo.xml.replace('Folio="1001"', 'Folio="2001"');
      const nuevo = cfdi('usd-tipo-cambio.xml');

      const carga = await cargarYEsperar(token, [
        { nombre: 'repetido.xml', contenido: repetido },
        { nombre: 'nuevo.xml', contenido: nuevo.xml },
      ]);

      expect(carga).toMatchObject({
        estado: 'procesada',
        totalRegistros: 2,
        registrosOk: 1,
        registrosExistentes: 1,
        registrosError: 0,
      });
      expect(carga.resultados).toEqual([
        { archivo: 'repetido.xml', resultado: 'ya_existia' },
        { archivo: 'nuevo.xml', resultado: 'nuevo' },
      ]);
      // El CFDI previo sigue en su carga original; no se duplica.
      const [guardadoPrevio] = await enCfdi([previo.uuid]);
      expect(guardadoPrevio.carga_id).not.toBe(carga.id);
      expect(await enCfdi([nuevo.uuid])).toEqual([
        expect.objectContaining({ carga_id: carga.id }),
      ]);
    });

    it('si todos ya existían, la carga es procesada', async () => {
      const token = await tokenSesion(ANA, FERRETERIA);
      const previo = cfdi('pue-valido.xml');
      await cargarYEsperar(token, [
        { nombre: 'previo.xml', contenido: previo.xml },
      ]);

      const carga = await cargarYEsperar(token, [
        {
          nombre: 'otra-vez.xml',
          contenido: previo.xml.replace('Folio="1001"', 'Folio="3001"'),
        },
      ]);

      expect(carga).toMatchObject({
        estado: 'procesada',
        registrosOk: 0,
        registrosExistentes: 1,
        registrosError: 0,
      });
    });

    it('el mismo CFDI en otra empresa sí entra: el UUID es único por empresa', async () => {
      const mismo = cfdi('pue-valido.xml');
      const archivo = [{ nombre: 'mismo.xml', contenido: mismo.xml }];

      await cargarYEsperar(await tokenSesion(ANA, FERRETERIA), archivo);
      const carga = await cargarYEsperar(
        await tokenSesion(CARMEN, TRANSPORTES),
        archivo,
      );

      expect(carga).toMatchObject({ estado: 'procesada', registrosOk: 1 });
      const guardados = await filas<{ company_id: string }>(
        ds,
        'SELECT company_id FROM cfdi WHERE uuid_fiscal = $1',
        [mismo.uuid],
      );
      expect(guardados.map((g) => g.company_id).sort()).toEqual(
        [entorno.empresa(FERRETERIA), entorno.empresa(TRANSPORTES)].sort(),
      );
    });
  });
});

describe('POST /cargas/cfdi, acceso y límites (CU-06)', () => {
  it('un revisor no sube: 403', async () => {
    await subir(await tokenSesion(JORGE, TRANSPORTES), [
      { nombre: 'pue.xml', contenido: cfdi('pue-valido.xml').xml },
    ]).expect(403);
  });

  describe('límites → 400 o 413 con motivo', () => {
    it('un archivo que no es .xml', async () => {
      const res = await subir(await tokenSesion(ANA, FERRETERIA), [
        { nombre: 'notas.txt', contenido: 'hola' },
      ]).expect(400);
      expect(mensaje(res)).toMatch(/\.xml/);
    });

    it(`un archivo de más de ${MAX_BYTES_POR_ARCHIVO} bytes`, async () => {
      const res = await subir(await tokenSesion(ANA, FERRETERIA), [
        {
          nombre: 'grande.xml',
          contenido: Buffer.alloc(MAX_BYTES_POR_ARCHIVO + 1, 'a'),
        },
      ]).expect(400);
      expect(mensaje(res)).toMatch(/MB/);
    });

    it(`más de ${MAX_ARCHIVOS} archivos`, async () => {
      const archivos = Array.from({ length: MAX_ARCHIVOS + 1 }, (_, i) => ({
        nombre: `f${i}.xml`,
        contenido: `<x>${i}</x>`,
      }));
      const res = await subir(
        await tokenSesion(ANA, FERRETERIA),
        archivos,
      ).expect(400);
      expect(mensaje(res)).toMatch(/Máximo 500/);
    });

    // 26 × (2 MB − 1): cada archivo cabe, la suma no.
    const archivosQueSumanDeMas = () =>
      Array.from(
        {
          length: Math.ceil(MAX_BYTES_POR_PETICION / MAX_BYTES_POR_ARCHIVO) + 1,
        },
        (_, i) => ({
          nombre: `f${i}.xml`,
          contenido: Buffer.alloc(MAX_BYTES_POR_ARCHIVO - 1, 'a'),
        }),
      );

    it('más de 50 MB en total, con Content-Length: 413', async () => {
      const res = await subir(
        await tokenSesion(ANA, FERRETERIA),
        archivosQueSumanDeMas(),
      ).expect(413);
      expect(mensaje(res)).toMatch(/50 MB/);
    });

    it('más de 50 MB en total, chunked y sin Content-Length: 413', async () => {
      const { status, cuerpo } = await subirChunked(
        await tokenSesion(ANA, FERRETERIA),
        archivosQueSumanDeMas(),
      );
      expect(status).toBe(413);
      expect(cuerpo).toMatch(/50 MB/);
    });

    it('un nombre de archivo de más de 255 caracteres', async () => {
      const res = await subir(await tokenSesion(ANA, FERRETERIA), [
        { nombre: `${'n'.repeat(252)}.xml`, contenido: '<x/>' },
      ]).expect(400);
      expect(mensaje(res)).toMatch(/255 caracteres/);
    });

    it('sin archivos', async () => {
      const res = await request(app.getHttpServer())
        .post('/cargas/cfdi')
        .set('Cookie', await tokenSesion(ANA, FERRETERIA))
        .expect(400);
      expect(mensaje(res)).toMatch(/al menos un archivo/);
    });
  });
});

describe('GET /cargas/:id (CU-06, CU-07, CU-08)', () => {
  let cargaTransportes: string;

  beforeAll(async () => {
    const carga = await cargarYEsperar(await tokenSesion(CARMEN, TRANSPORTES), [
      { nombre: 'transportes.xml', contenido: cfdi('pue-valido.xml').xml },
    ]);
    cargaTransportes = carga.id;
  });

  it('su empresa ve estado, contadores y resultado por archivo: 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/cargas/${cargaTransportes}`)
      .set('Cookie', await tokenSesion(CARMEN, TRANSPORTES))
      .expect(200);

    expect(res.body).toEqual({
      id: cargaTransportes,
      estado: 'procesada',
      totalRegistros: 1,
      registrosOk: 1,
      registrosExistentes: 0,
      registrosError: 0,
      resultados: [{ archivo: 'transportes.xml', resultado: 'nuevo' }],
      errorMensaje: null,
    });
  });

  // Pendiente de CU-04: ahora contra el endpoint real, que sí podría leer la query.
  it('companyId en la query se ignora: carga ajena sigue en 404, igual que inexistente', async () => {
    const token = await tokenSesion(ANA, FERRETERIA);
    const ajena = await request(app.getHttpServer())
      .get(`/cargas/${cargaTransportes}`)
      .query({ companyId: entorno.empresa(TRANSPORTES) })
      .set('Cookie', token)
      .expect(404);
    const inexistente = await request(app.getHttpServer())
      .get(`/cargas/${randomUUID()}`)
      .set('Cookie', token)
      .expect(404);

    expect(ajena.body).toEqual(inexistente.body);
  });
});
