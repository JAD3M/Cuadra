import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createHash, randomUUID } from 'crypto';
import request from '../testing/supertest-con-origen';
import { abrirSesion } from '../testing/sesion-de-pruebas';
import type { DataSource } from 'typeorm';
import type { EstadoCarga, TipoCarga } from '../common/entities/tipos';
import { una } from '../database/testing/base-de-pruebas';
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
 * CU-24, GET /cargas: las últimas 20 cargas de la empresa de la sesión, de
 * punta a punta contra Postgres real con RLS. Las filas se siembran con la
 * conexión del dueño, sin POST ni cola: el worker nunca las toca.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;
let tokenAna: string;
let tokenLuis: string;
let tokenCarmen: string;
let tokenJorge: string;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  tokenAna = await entorno.token(ANA, FERRETERIA);
  tokenLuis = await entorno.token(LUIS, FERRETERIA);
  tokenCarmen = await entorno.token(CARMEN, TRANSPORTES);
  tokenJorge = await entorno.token(JORGE, TRANSPORTES);
}, 60_000);

afterAll(async () => {
  await entorno?.cerrar();
});

beforeEach(async () => {
  await ds.query('TRUNCATE cfdi, cargas CASCADE');
});

interface Semilla {
  id?: string;
  empresa: string;
  tipo?: TipoCarga;
  estado?: EstadoCarga;
  nombre?: string;
  creada?: string;
  subidoPor?: string | null;
  ok?: number;
  existentes?: number;
  error?: number;
  total?: number;
  banco?: string | null;
  cuenta?: string | null;
  perfil?: string | null;
  procesadaAt?: string | null;
}

/**
 * Inserta una carga como dueño. Los contadores respetan
 * `ck_cargas_total_cuadra`: terminada, el total es la suma exacta.
 */
async function carga(s: Semilla): Promise<string> {
  const id = s.id ?? randomUUID();
  const ok = s.ok ?? 0;
  const existentes = s.existentes ?? 0;
  const error = s.error ?? 0;
  const total = s.total ?? ok + existentes + error;
  await ds.query(
    `INSERT INTO cargas
       (id, company_id, tipo, estado, nombre_archivo, hash_archivo,
        total_registros, registros_ok, registros_existentes, registros_error,
        subido_por_id, banco, cuenta, perfil, procesada_at, created_at,
        resultados, error_mensaje)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
             $16, '[{"archivo":"a.xml","resultado":"nuevo"}]', NULL)`,
    [
      id,
      s.empresa,
      s.tipo ?? 'cfdi',
      s.estado ?? 'procesada',
      s.nombre ?? 'factura.xml',
      createHash('sha256').update(id).digest('hex'),
      total,
      ok,
      existentes,
      error,
      s.subidoPor === undefined ? entorno.persona(ANA) : s.subidoPor,
      s.banco ?? null,
      s.cuenta ?? null,
      s.perfil ?? null,
      s.procesadaAt ?? null,
      s.creada ?? new Date().toISOString(),
    ],
  );
  return id;
}

const listar = (token: string, consulta = '') =>
  request(entorno.app.getHttpServer())
    .get(`/cargas${consulta}`)
    .set('Cookie', token);

/** El cuerpo de la respuesta como `unknown`: cada test lo estrecha con `datos`. */
const cuerpo = async (respuesta: request.Test): Promise<unknown> =>
  (await respuesta).body as unknown;

interface ItemListado {
  id: string;
  tipo: string;
  nombreArchivo: string;
  estado: string;
  totalRegistros: number;
  registrosOk: number;
  registrosExistentes: number;
  registrosError: number;
  banco: string | null;
  perfil: string | null;
  errorMensaje: string | null;
  subidoPor: string | null;
  createdAt: string;
  procesadaAt: string | null;
}

const datos = (cuerpo: unknown) => (cuerpo as { datos: ItemListado[] }).datos;

const dia = (n: number) =>
  new Date(Date.UTC(2026, 8, 1, 12, 0, n)).toISOString();

describe('CRL-1 endpoint, acceso y forma', () => {
  it('admin y contador de la misma empresa reciben cuerpos idénticos', async () => {
    await carga({ empresa: A, creada: dia(1) });
    await carga({ empresa: A, creada: dia(2), estado: 'pendiente' });
    const admin = await listar(tokenAna).expect(200);
    const contador = await listar(tokenLuis).expect(200);
    expect(datos(admin.body)).toHaveLength(2);
    expect(contador.body).toEqual(admin.body);
  });

  it('el revisor no la consulta (FR-53): 403', async () => {
    await carga({ empresa: B, creada: dia(1), nombre: 'b.xml' });
    await listar(tokenJorge).expect(403);
  });

  it('sin token responde 401', async () => {
    await request(entorno.app.getHttpServer()).get('/cargas').expect(401);
  });

  it('una sesión sin empresa elegida responde 401', async () => {
    // Sesión abierta pero sin empresa elegida (`company_id` nulo).
    const token = await abrirSesion(entorno.ds, entorno.persona(ANA), null);
    await listar(token).expect(401);
  });

  it('trae todos los campos con su tipo y ninguno de los excluidos', async () => {
    await carga({
      empresa: A,
      tipo: 'cfdi',
      estado: 'con_errores',
      nombre: 'lote.xml',
      creada: dia(1),
      ok: 2,
      existentes: 1,
      error: 1,
      procesadaAt: dia(5),
    });
    await carga({
      empresa: A,
      tipo: 'estado_cuenta',
      estado: 'pendiente',
      nombre: 'movs.csv',
      creada: dia(2),
      total: 10,
      banco: 'BBVA',
      cuenta: '****1234',
      perfil: 'banco-norte',
    });
    const body = await cuerpo(listar(tokenAna).expect(200));
    const [csv, cfdi] = datos(body);

    expect(Object.keys(csv).sort()).toEqual(
      [
        'id',
        'tipo',
        'nombreArchivo',
        'estado',
        'totalRegistros',
        'registrosOk',
        'registrosExistentes',
        'registrosError',
        'banco',
        'perfil',
        'errorMensaje',
        'subidoPor',
        'createdAt',
        'procesadaAt',
      ].sort(),
    );
    expect(csv).toMatchObject({
      tipo: 'estado_cuenta',
      estado: 'pendiente',
      nombreArchivo: 'movs.csv',
      totalRegistros: 10,
      registrosOk: 0,
      registrosExistentes: 0,
      registrosError: 0,
      banco: 'BBVA',
      perfil: 'banco-norte',
      errorMensaje: null,
      procesadaAt: null,
      createdAt: dia(2),
    });
    expect(cfdi).toMatchObject({
      tipo: 'cfdi',
      estado: 'con_errores',
      banco: null,
      perfil: null,
      errorMensaje: null,
      procesadaAt: dia(5),
    });
    for (const item of [csv, cfdi]) {
      expect(typeof item.totalRegistros).toBe('number');
      expect(typeof item.registrosOk).toBe('number');
      expect(typeof item.registrosExistentes).toBe('number');
      expect(typeof item.registrosError).toBe('number');
      expect(new Date(item.createdAt).toISOString()).toBe(item.createdAt);
    }
    const texto = JSON.stringify(body);
    for (const ausente of [
      'resultados',
      'hashArchivo',
      'hash_archivo',
      '"cuenta"',
      'email',
      'companyId',
      'subidoPorId',
      'ana.reyes@fdb.mx',
      '****1234',
    ]) {
      expect(texto).not.toContain(ausente);
    }
  });

  it('el companyId y el limite de la query no se leen', async () => {
    for (let i = 0; i < 25; i++) {
      await carga({ empresa: A, creada: dia(i) });
    }
    const deB = await carga({ empresa: B, creada: dia(30) });
    const body = await cuerpo(
      listar(tokenAna, `?companyId=${B}&limite=500`).expect(200),
    );
    expect(datos(body)).toHaveLength(20);
    expect(datos(body).map((c) => c.id)).not.toContain(deB);
  });
});

describe('CRL-2 orden, límite y quien subió', () => {
  it('devuelve las 20 más recientes, la más nueva primero', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      ids.push(await carga({ empresa: A, creada: dia(i) }));
    }
    const body = await cuerpo(listar(tokenAna).expect(200));
    expect(datos(body).map((c) => c.id)).toEqual(ids.slice(5).reverse());
    for (const antigua of ids.slice(0, 5)) {
      expect(datos(body).map((c) => c.id)).not.toContain(antigua);
    }
  });

  it('con el mismo created_at el orden es estable y sigue a id DESC (M2)', async () => {
    const ids = [
      '00000000-0000-7000-8000-000000000001',
      '00000000-0000-7000-8000-000000000003',
      '00000000-0000-7000-8000-000000000002',
    ];
    for (const id of ids) {
      await carga({ id, empresa: A, creada: dia(1) });
    }
    const primera = await listar(tokenAna).expect(200);
    const segunda = await listar(tokenAna).expect(200);
    const esperado = [...ids].sort().reverse();
    expect(datos(primera.body).map((c) => c.id)).toEqual(esperado);
    expect(datos(segunda.body).map((c) => c.id)).toEqual(esperado);
  });

  it('subidoPor es el nombre de quien subió', async () => {
    await carga({ empresa: A, subidoPor: entorno.persona(ANA) });
    const body = await cuerpo(listar(tokenAna).expect(200));
    expect(datos(body)[0].subidoPor).toBe('Ana Reyes');
  });

  it('sin quien subió (subido_por_id NULL) la carga sigue en la lista con null', async () => {
    await carga({ empresa: A, subidoPor: null });
    const body = await cuerpo(listar(tokenAna).expect(200));
    expect(datos(body)).toHaveLength(1);
    expect(datos(body)[0].subidoPor).toBeNull();
  });

  it('una empresa sin cargas responde 200 con { datos: [] } (M1)', async () => {
    const body = await cuerpo(listar(tokenAna).expect(200));
    expect(body).toEqual({ datos: [] });
  });
});

describe('CRL-3 alcance por empresa y solo lectura', () => {
  it('la empresa A no ve filas, contadores ni nombres de la B', async () => {
    await carga({ empresa: A, nombre: 'de-a.xml', ok: 1 });
    await carga({
      empresa: B,
      nombre: 'de-b.xml',
      ok: 77,
      subidoPor: entorno.persona(CARMEN),
    });
    const body = await cuerpo(listar(tokenAna).expect(200));
    expect(datos(body).map((c) => c.nombreArchivo)).toEqual(['de-a.xml']);
    const texto = JSON.stringify(body);
    expect(texto).not.toContain('de-b.xml');
    expect(texto).not.toContain('Carmen');
    // El contador de la B es 77; se busca como valor aislado porque la
    // subcadena aparece al azar dentro de UUIDs y fechas del JSON.
    expect(texto).not.toMatch(/(?<![\w-])77(?![\w-])/);
    const deB = await listar(tokenCarmen).expect(200);
    expect(datos(deB.body).map((c) => c.nombreArchivo)).toEqual(['de-b.xml']);
  });

  it('no escribe nada: cargas, carga_archivos y bitacora quedan idénticas tras 3 llamadas', async () => {
    await carga({ empresa: A, creada: dia(1) });
    await carga({ empresa: B, creada: dia(2) });
    const huella = (tabla: string) =>
      una<{ n: number; huella: string }>(
        ds,
        `SELECT count(*)::int AS n,
                coalesce(md5(string_agg(to_jsonb(t)::text, '' ORDER BY t.id)), '') AS huella
           FROM ${tabla} t`,
      );
    const tablas = ['cargas', 'carga_archivos', 'bitacora'];
    const antes = await Promise.all(tablas.map(huella));
    for (let i = 0; i < 3; i++) await listar(tokenAna).expect(200);
    const despues = await Promise.all(tablas.map(huella));
    expect(despues).toEqual(antes);
  });

  it('users no tiene company_id: el nombre se alcanza por la carga filtrada por empresa y sin correo', async () => {
    await carga({ empresa: A, subidoPor: entorno.persona(LUIS) });
    const body = await cuerpo(listar(tokenAna).expect(200));
    expect(datos(body)).toHaveLength(1);
    expect(datos(body)[0].subidoPor).toBe('Luis Mendoza');
    expect(Object.keys(datos(body)[0])).not.toContain('email');
  });
});

describe('CRL-4 documentación y rutas vecinas', () => {
  it('OpenAPI incluye GET /cargas con 200 tipado y 401', () => {
    const documento = SwaggerModule.createDocument(
      entorno.app,
      new DocumentBuilder().addCookieAuth('cuadra_sesion').build(),
    );
    const operacion = documento.paths['/cargas']?.get;
    expect(operacion).toBeDefined();
    expect(Object.keys(operacion?.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '401']),
    );
    const ok = operacion?.responses['200'] as {
      content: Record<string, { schema: { $ref: string } }>;
    };
    expect(ok.content['application/json'].schema.$ref).toContain(
      'RespuestaListaCargasDto',
    );
  });

  it('GET /cargas/:id sigue igual: 400 con un id que no es UUID', async () => {
    await request(entorno.app.getHttpServer())
      .get('/cargas/no-es-uuid')
      .set('Cookie', tokenAna)
      .expect(400);
  });
});
