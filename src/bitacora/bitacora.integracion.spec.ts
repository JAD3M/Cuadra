import { randomUUID } from 'crypto';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import {
  ANA,
  type AppDeCargas,
  CARMEN,
  FERRETERIA,
  JORGE,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { ENTIDADES_BITACORA } from '../common/entities/tipos';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { una } from '../database/testing/base-de-pruebas';

/**
 * CU-16 (lectura) de punta a punta contra Postgres real con RLS:
 * GET /conciliaciones/:id/historial y GET /bitacora. Los datos se preparan
 * con la conexión del dueño; los endpoints leen como cuadra_app. Las filas
 * de confirmar y rechazar salen de los endpoints reales de CU-15.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;
let tokenAna: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  tokenAna = await entorno.token(ANA, FERRETERIA);
}, 60_000);

afterAll(async () => {
  await entorno?.cerrar();
});

beforeEach(async () => {
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, conciliaciones, bitacora CASCADE',
  );
  // confirmar y rechazar vuelven a evaluar al liberar un lado; aquí no
  // interesa el motor.
  jest
    .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
    .mockResolvedValue({ propuestas: 0 });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function movimiento(empresa: string): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto, estado)
     VALUES ($1,$2,'2026-09-02','SPEI RECIBIDO','1160.00','abierto')
     RETURNING id`,
    [empresa, linea++],
  );
  return id;
}

async function factura(empresa: string): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado,
                       metodo_pago, xml_raw)
     VALUES ($1,$2,$3,'XAXX010101000','A','1001','2026-09-01T10:00:00','I','MXN',
             '1160.00','1160.00','abierta','PUE','{"_xml":"<x/>"}'::jsonb)
     RETURNING id`,
    [empresa, randomUUID(), FERRETERIA],
  );
  return id;
}

/** Propuesta lista para resolver. Con `crear` deja la fila del motor. */
async function propuesta(
  empresa = A,
  o: { movimientoId?: string; crear?: boolean } = {},
) {
  const cfdiId = await factura(empresa);
  const movimientoId = o.movimientoId ?? (await movimiento(empresa));
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen, regla, score,
                                 diferencia_monto, motivo)
     VALUES ($1,$2,$3,'propuesta','regla','monto_unico','0.9000','0.0000','Motivo de propuesta')
     RETURNING id`,
    [empresa, cfdiId, movimientoId],
  );
  if (o.crear !== false) await crearDelMotor(empresa, id, cfdiId, movimientoId);
  return { id, cfdiId, movimientoId };
}

/** La fila 'crear' que escribe el motor (user_id NULL), en el pasado. */
async function crearDelMotor(
  empresa: string,
  id: string,
  cfdiId: string,
  movimientoId: string,
): Promise<void> {
  await ds.query(
    `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos, ip, user_agent, created_at)
     VALUES ($1,NULL,'conciliaciones',$2,'crear',$3::jsonb,'203.0.113.7','jest',
             now() - interval '1 minute')`,
    [
      empresa,
      id,
      JSON.stringify({
        despues: { estado: 'propuesta' },
        origen: 'regla',
        regla: 'monto_unico',
        score: '0.9000',
        diferenciaMonto: '0.0000',
        cfdiId,
        movimientoId,
      }),
    ],
  );
}

const confirmar = (id: string, token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .post(`/conciliaciones/${id}/confirmar`)
    .auth(token, { type: 'bearer' })
    .send();

const rechazar = (id: string, token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .post(`/conciliaciones/${id}/rechazar`)
    .auth(token, { type: 'bearer' })
    .send({ motivo: 'No corresponde' });

const historial = (id: string, token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .get(`/conciliaciones/${id}/historial`)
    .auth(token, { type: 'bearer' });

interface Evento {
  id: string;
  entidad: string;
  entidadId: string;
  accion: string;
  datos: Record<string, any>;
  createdAt: string;
  usuario: { nombre: string; email: string } | null;
}

/** Los eventos de la respuesta, tipados. */
const eventosDe = (res: request.Response) =>
  (res.body as { datos: Evento[] }).datos;

const accionesDe = (res: request.Response) =>
  eventosDe(res).map((e) => e.accion);

const filaDe = (id: string, accion: string) =>
  una<{ datos: Record<string, unknown> }>(
    ds,
    'SELECT datos FROM bitacora WHERE entidad_id = $1 AND accion = $2',
    [id, accion],
  );

describe('GET /conciliaciones/:id/historial (AU-10 a AU-14)', () => {
  it('AU-10: un id que no es UUID es 400', async () => {
    await historial('no-es-uuid').expect(400);
  });

  it('AU-10: inexistente y ajena dan el mismo 404', async () => {
    const ajena = await propuesta(B);
    const inexistente = await historial(randomUUID()).expect(404);
    const deOtraEmpresa = await historial(ajena.id).expect(404);
    expect(deOtraEmpresa.body).toEqual(inexistente.body);
  });

  it('AU-11 y AU-14: crear y luego confirmar, en orden, con su actor', async () => {
    const { id } = await propuesta();
    await confirmar(id).expect(200);

    const res = await historial(id).expect(200);
    const ana = await una<{ nombre: string; email: string }>(
      ds,
      'SELECT nombre, email FROM users WHERE email = $1',
      [ANA],
    );

    expect(accionesDe(res)).toEqual(['crear', 'confirmar']);
    expect(eventosDe(res)[0]).toMatchObject({
      entidad: 'conciliaciones',
      entidadId: id,
      usuario: null,
      datos: { origen: 'regla' },
    });
    expect(eventosDe(res)[1].usuario).toEqual(ana);
    expect(Date.parse(eventosDe(res)[0].createdAt)).toBeLessThan(
      Date.parse(eventosDe(res)[1].createdAt),
    );
  });

  it('AU-11: no expone ip ni userAgent', async () => {
    const { id } = await propuesta();
    const res = await historial(id).expect(200);
    expect(res.body).toEqual({ datos: [expect.any(Object)] });
    for (const evento of eventosDe(res)) {
      expect(evento).not.toHaveProperty('ip');
      expect(evento).not.toHaveProperty('userAgent');
    }
    expect(JSON.stringify(res.body)).not.toContain('203.0.113.7');
  });

  it('AU-12: una propuesta anterior a CU-16 devuelve solo lo posterior', async () => {
    const { id } = await propuesta(A, { crear: false });
    const vacio = await historial(id).expect(200);
    expect(vacio.body).toEqual({ datos: [] });

    await rechazar(id).expect(200);
    const res = await historial(id).expect(200);
    expect(accionesDe(res)).toEqual(['rechazar']);
  });

  it('AU-13: las dos formas de datos de CU-15 salen tal como se guardaron', async () => {
    const confirmada = await propuesta();
    const rechazada = await propuesta();
    await confirmar(confirmada.id).expect(200);
    await rechazar(rechazada.id).expect(200);

    const deConfirmar = await historial(confirmada.id).expect(200);
    const deRechazar = await historial(rechazada.id).expect(200);

    const c = eventosDe(deConfirmar).find((e) => e.accion === 'confirmar');
    const r = eventosDe(deRechazar).find((e) => e.accion === 'rechazar');
    // ENT-1: las filas de confirmar y rechazar usan una entidad de la lista.
    expect(ENTIDADES_BITACORA).toContain(c?.entidad);
    expect(ENTIDADES_BITACORA).toContain(r?.entidad);
    expect(c?.datos).toEqual((await filaDe(confirmada.id, 'confirmar')).datos);
    expect(c?.datos).toMatchObject({
      cfdi: { id: confirmada.cfdiId },
      movimiento: { id: confirmada.movimientoId },
    });
    expect(r?.datos).toEqual((await filaDe(rechazada.id, 'rechazar')).datos);
    expect(r?.datos).toMatchObject({
      cfdiId: rechazada.cfdiId,
      movimientoId: rechazada.movimientoId,
    });
  });

  it('AU-13: el rechazo de una hermana aparece en el historial de la hermana', async () => {
    const movimientoId = await movimiento(A);
    const ganadora = await propuesta(A, { movimientoId });
    const hermana = await propuesta(A, { movimientoId });
    await confirmar(ganadora.id).expect(200);

    const res = await historial(hermana.id).expect(200);
    expect(accionesDe(res)).toEqual(['crear', 'rechazar']);
    expect(eventosDe(res)[1].entidadId).toBe(hermana.id);
  });

  it('AU-10: contador y revisor leen; sin token es 401', async () => {
    const { id } = await propuesta();
    await historial(id, await entorno.token(LUIS, FERRETERIA)).expect(200);
    const deB = await propuesta(B);
    await historial(deB.id, await entorno.token(JORGE, TRANSPORTES)).expect(
      200,
    );
    await request(entorno.app.getHttpServer())
      .get(`/conciliaciones/${id}/historial`)
      .expect(401);
  });
});

interface EventoGeneral extends Evento {
  ip: string | null;
  userAgent: string | null;
}

interface Pagina {
  datos: EventoGeneral[];
  pagina: number;
  limite: number;
  total: number;
}

const bitacora = (consulta = '', token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .get(`/bitacora${consulta}`)
    .auth(token, { type: 'bearer' });

const paginaDe = (res: request.Response) => res.body as Pagina;

/** Una fila de bitácora directa, con la conexión del dueño. */
async function evento(
  o: {
    empresa?: string;
    userId?: string | null;
    entidad?: string;
    entidadId?: string;
    accion?: string;
    creadoEn?: string;
    ip?: string | null;
    userAgent?: string | null;
  } = {},
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos, ip, user_agent, created_at)
     VALUES ($1,$2,$3,$4,$5,'{"k":1}'::jsonb,$6,$7,COALESCE($8::timestamptz, now()))
     RETURNING id`,
    [
      o.empresa ?? A,
      o.userId ?? null,
      o.entidad ?? 'cfdi',
      o.entidadId ?? randomUUID(),
      o.accion ?? 'crear',
      o.ip ?? null,
      o.userAgent ?? null,
      o.creadoEn ?? null,
    ],
  );
  return id;
}

describe('GET /bitacora (AU-20 a AU-26)', () => {
  it('AU-20: forma y valores por defecto', async () => {
    const id = await evento();
    const res = await bitacora().expect(200);
    expect(paginaDe(res)).toMatchObject({ pagina: 1, limite: 50, total: 1 });
    expect(eventosDe(res).map((e) => e.id)).toEqual([id]);
  });

  it.each([
    'limite=201',
    'limite=0',
    'limite=-1',
    'limite=abc',
    'limite=1.5',
    'pagina=0',
    'pagina=1.5',
    'pagina=x',
    'desconocido=1',
  ])('AU-20: %s es 400', async (consulta) => {
    await bitacora(`?${consulta}`).expect(400);
  });

  it('AU-20: limite 200 es válido', async () => {
    await bitacora('?limite=200').expect(200);
  });

  it('AU-21: orden created_at DESC, id DESC, estable entre páginas', async () => {
    const mismoInstante = '2026-09-10T10:00:00Z';
    for (let i = 0; i < 4; i++) await evento({ creadoEn: mismoInstante });
    const masNuevo = await evento({ creadoEn: '2026-09-11T10:00:00Z' });
    const masViejo = await evento({ creadoEn: '2026-09-09T10:00:00Z' });

    const todo = eventosDe(await bitacora().expect(200)).map((e) => e.id);
    expect(todo[0]).toBe(masNuevo);
    expect(todo[5]).toBe(masViejo);
    const empatados = todo.slice(1, 5);
    expect(empatados).toEqual([...empatados].sort().reverse());

    const paginas: string[] = [];
    for (const p of [1, 2, 3]) {
      const res = await bitacora(`?limite=2&pagina=${p}`).expect(200);
      expect(paginaDe(res)).toMatchObject({ pagina: p, limite: 2, total: 6 });
      paginas.push(...eventosDe(res).map((e) => e.id));
    }
    expect(paginas).toEqual(todo);
    const mas = await bitacora('?limite=2&pagina=4').expect(200);
    expect(paginaDe(mas)).toMatchObject({ datos: [], total: 6 });
  });

  it('AU-22: cada filtro y sus combinaciones', async () => {
    const ana = entorno.persona(ANA);
    const luis = entorno.persona(LUIS);
    const e1 = randomUUID();
    const e2 = randomUUID();
    const a = await evento({
      entidad: 'cfdi',
      entidadId: e1,
      accion: 'cargar',
      userId: ana,
    });
    const b = await evento({
      entidad: 'movimientos',
      entidadId: e2,
      accion: 'cargar',
      userId: luis,
    });
    const c = await evento({
      entidad: 'cfdi',
      entidadId: e2,
      accion: 'crear',
      userId: ana,
    });
    const ids = async (q: string) =>
      eventosDe(await bitacora(q).expect(200))
        .map((e) => e.id)
        .sort();

    expect(await ids('?entidad=cfdi')).toEqual([a, c].sort());
    expect(await ids(`?entidadId=${e2}`)).toEqual([b, c].sort());
    expect(await ids('?accion=cargar')).toEqual([a, b].sort());
    expect(await ids(`?userId=${ana}`)).toEqual([a, c].sort());
    expect(await ids(`?entidad=cfdi&accion=cargar&userId=${ana}`)).toEqual([a]);
    expect(await ids(`?entidad=cfdi&entidadId=${e2}&accion=crear`)).toEqual([
      c,
    ]);
    expect(await ids(`?entidad=cfdi&userId=${luis}`)).toEqual([]);
  });

  it('AU-22: desde inclusivo y hasta exclusivo', async () => {
    const t10 = await evento({ creadoEn: '2026-09-10T10:00:00Z' });
    const t11 = await evento({ creadoEn: '2026-09-10T11:00:00Z' });
    const t12 = await evento({ creadoEn: '2026-09-10T12:00:00Z' });
    const ids = async (q: string) =>
      eventosDe(await bitacora(q).expect(200)).map((e) => e.id);

    expect(
      await ids('?desde=2026-09-10T10:00:00Z&hasta=2026-09-10T12:00:00Z'),
    ).toEqual([t11, t10]);
    expect(await ids('?desde=2026-09-10T11:00:00Z')).toEqual([t12, t11]);
    expect(await ids('?hasta=2026-09-10T11:00:00Z')).toEqual([t10]);
    expect(
      await ids('?desde=2026-09-10T11:00:00Z&hasta=2026-09-10T11:00:00Z'),
    ).toEqual([]);
    // Un hasta de solo fecha es medianoche UTC: excluye ese día.
    expect(await ids('?desde=2026-09-10&hasta=2026-09-11')).toEqual([
      t12,
      t11,
      t10,
    ]);
    expect(await ids('?hasta=2026-09-10')).toEqual([]);
  });

  it.each([
    'entidadId=no-uuid',
    'userId=no-uuid',
    'accion=inventada',
    'desde=ayer',
    'hasta=2026-13-45',
    `entidad=${'x'.repeat(65)}`,
    'desde=2026-09-11T00:00:00Z&hasta=2026-09-10T00:00:00Z',
  ])('AU-22: %s es 400', async (consulta) => {
    await evento();
    await bitacora(`?${consulta}`).expect(400);
  });

  it('AU-22: un valor válido sin coincidencias es 200 vacío', async () => {
    await evento();
    const res = await bitacora(
      `?entidad=nada&entidadId=${randomUUID()}&userId=${randomUUID()}`,
    ).expect(200);
    expect(paginaDe(res)).toMatchObject({ datos: [], total: 0 });
  });

  it('ENT-1: la lista canónica de entidades es conciliaciones y companies', () => {
    expect([...ENTIDADES_BITACORA]).toEqual(['conciliaciones', 'companies']);
  });

  it('ENT-2: GET /bitacora no valida entidad: una fuera de la lista es 200 vacío', async () => {
    await evento();
    const res = await bitacora('?entidad=cargas').expect(200);
    expect(paginaDe(res)).toMatchObject({ datos: [], total: 0 });
  });

  it('AU-22: total no depende de la página', async () => {
    for (let i = 0; i < 3; i++) await evento({ accion: 'cargar' });
    await evento({ accion: 'crear' });
    const res = await bitacora('?accion=cargar&limite=1&pagina=2').expect(200);
    expect(paginaDe(res)).toMatchObject({ total: 3, limite: 1, pagina: 2 });
    expect(eventosDe(res)).toHaveLength(1);
  });

  it('AU-23: ip como host, userAgent y usuario', async () => {
    const ana = entorno.persona(ANA);
    await evento({
      userId: ana,
      accion: 'confirmar',
      ip: '203.0.113.7',
      userAgent: 'jest/1',
    });
    await evento({ accion: 'crear' });
    const datos = eventosDe(await bitacora().expect(200));
    const humano = datos.find((e) => e.accion === 'confirmar');
    const sistema = datos.find((e) => e.accion === 'crear');
    expect(humano).toMatchObject({
      entidad: 'cfdi',
      datos: { k: 1 },
      ip: '203.0.113.7',
      userAgent: 'jest/1',
      usuario: { email: ANA },
    });
    expect(humano?.usuario?.nombre).toEqual(expect.any(String));
    expect(sistema).toMatchObject({ usuario: null, ip: null, userAgent: null });
  });

  it('AU-24: las filas de otra empresa no aparecen ni cuentan', async () => {
    const compartido = randomUUID();
    const deB = entorno.persona(JORGE);
    const propia = await evento({ entidadId: compartido });
    await evento({ empresa: B, entidadId: compartido, userId: deB });
    await evento({ empresa: B });

    const todo = await bitacora().expect(200);
    expect(paginaDe(todo).total).toBe(1);
    expect(eventosDe(todo).map((e) => e.id)).toEqual([propia]);
    for (const q of [`?entidadId=${compartido}`, `?userId=${deB}`]) {
      const res = await bitacora(q).expect(200);
      expect(paginaDe(res).total).toBe(q.startsWith('?userId') ? 0 : 1);
    }
  });

  it('AU-26: la historia de un CFDI y de un movimiento pasa por conciliaciones', async () => {
    const confirmada = await propuesta();
    const rechazada = await propuesta();
    await confirmar(confirmada.id).expect(200);
    await rechazar(rechazada.id).expect(200);
    await evento({
      entidad: 'cfdi',
      entidadId: confirmada.cfdiId,
      accion: 'actualizar',
    });
    const acciones = async (q: string) =>
      eventosDe(await bitacora(q).expect(200))
        .map((e) => `${e.entidad}:${e.accion}`)
        .sort();

    expect(
      await acciones(`?entidad=cfdi&entidadId=${confirmada.cfdiId}`),
    ).toEqual([
      'cfdi:actualizar',
      'conciliaciones:confirmar',
      'conciliaciones:crear',
    ]);
    expect(
      await acciones(
        `?entidad=movimientos&entidadId=${confirmada.movimientoId}`,
      ),
    ).toEqual(['conciliaciones:confirmar', 'conciliaciones:crear']);
    // Forma del rechazo (cfdiId/movimientoId planos).
    expect(
      await acciones(`?entidad=cfdi&entidadId=${rechazada.cfdiId}`),
    ).toEqual(['conciliaciones:crear', 'conciliaciones:rechazar']);
    expect(
      await acciones(
        `?entidad=movimientos&entidadId=${rechazada.movimientoId}`,
      ),
    ).toEqual(['conciliaciones:crear', 'conciliaciones:rechazar']);
    // El id de un CFDI no arrastra la historia de un movimiento y viceversa.
    expect(
      await acciones(`?entidad=movimientos&entidadId=${confirmada.cfdiId}`),
    ).toEqual([]);
  });

  it('AU-25: admin, contador y revisor leen; sin token 401; otra empresa 403', async () => {
    await bitacora('', await entorno.token(LUIS, FERRETERIA)).expect(200);
    await bitacora('', await entorno.token(JORGE, TRANSPORTES)).expect(200);
    await request(entorno.app.getHttpServer()).get('/bitacora').expect(401);
    await bitacora('', await entorno.token(ANA, TRANSPORTES)).expect(403);
  });
});

interface UsuarioListado {
  id: string;
  nombre: string;
}

const usuarios = (token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .get('/bitacora/usuarios')
    .auth(token, { type: 'bearer' });

const listadoDe = (res: request.Response) =>
  (res.body as { datos: UsuarioListado[] }).datos;

const cuentaBitacora = async () =>
  Number(
    (await una<{ n: string }>(ds, 'SELECT count(*) AS n FROM bitacora')).n,
  );

describe('AU-26: GET /bitacora/usuarios', () => {
  // `users` y `user_company_roles` quedan fuera de RLS: el filtro por
  // company_id de la consulta es la única barrera, de ahí el aislamiento.
  // El spec trunca la bitácora por prueba, pero los usuarios que crea una
  // prueba se borran siempre (también si falla): el borrado de un usuario
  // arrastra sus roles (CASCADE) y deja sus eventos con user_id NULL.
  const creados: string[] = [];

  async function usuarioExtra(
    nombre: string,
    o: { empresa?: string; rol?: string; activo?: boolean } = {},
  ): Promise<string> {
    const { id } = await una<{ id: string }>(
      ds,
      `INSERT INTO users (email, nombre, password_hash, activo)
       VALUES ($1, $2, 'sin-contrasena', $3) RETURNING id`,
      [`extra-${randomUUID()}@prueba.mx`, nombre, o.activo ?? true],
    );
    creados.push(id);
    if (o.empresa) {
      await ds.query(
        `INSERT INTO user_company_roles (user_id, company_id, rol)
         VALUES ($1, $2, $3)`,
        [id, o.empresa, o.rol ?? 'revisor'],
      );
    }
    return id;
  }

  afterEach(async () => {
    const ids = creados.splice(0);
    if (ids.length > 0) {
      await ds.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [ids]);
    }
    // Rol extra de Ana (prueba de dedupe): se retira por si la prueba falló.
    await ds.query(
      `DELETE FROM user_company_roles WHERE user_id = $1 AND company_id = $2
          AND rol = 'contador'`,
      [entorno.persona(ANA), A],
    );
  });

  it.each([
    ['admin', ANA, FERRETERIA],
    ['contador', LUIS, FERRETERIA],
    ['revisor', JORGE, TRANSPORTES],
  ])('USR-1: %s lee la lista', async (_rol, email, rfc) => {
    await usuarios(await entorno.token(email, rfc)).expect(200);
  });

  it('USR-1: sin token es 401; sin membresía es 403 y queda acceso_denegado', async () => {
    await request(entorno.app.getHttpServer())
      .get('/bitacora/usuarios')
      .expect(401);
    await usuarios(await entorno.token(ANA, TRANSPORTES)).expect(403);
    const filasDenegadas = await ds.query<{ entidad_id: string }[]>(
      `SELECT entidad_id FROM bitacora WHERE accion = 'acceso_denegado'`,
    );
    expect(filasDenegadas).toEqual([{ entidad_id: B }]);
  });

  it('USR-3: forma exacta y orden por nombre, solo id y nombre', async () => {
    const res = await usuarios().expect(200);
    expect(res.body).toEqual({
      datos: [
        { id: entorno.persona(ANA), nombre: 'Ana Reyes' },
        { id: entorno.persona(JORGE), nombre: 'Jorge Tapia' },
        { id: entorno.persona(LUIS), nombre: 'Luis Mendoza' },
      ],
    });
  });

  it('USR-2: cada empresa ve solo a los suyos; Jorge conserva su id', async () => {
    const deA = listadoDe(await usuarios().expect(200));
    const deB = listadoDe(
      await usuarios(await entorno.token(JORGE, TRANSPORTES)).expect(200),
    );
    expect(deA.map((u) => u.nombre)).not.toContain('Carmen Olvera');
    expect(deB).toEqual([
      { id: entorno.persona(CARMEN), nombre: 'Carmen Olvera' },
      { id: entorno.persona(JORGE), nombre: 'Jorge Tapia' },
    ]);
    expect(deB.map((u) => u.nombre)).not.toEqual(
      expect.arrayContaining(['Ana Reyes']),
    );
    expect(deB.map((u) => u.nombre)).not.toContain('Luis Mendoza');
    expect(deA.find((u) => u.nombre === 'Jorge Tapia')?.id).toBe(
      deB.find((u) => u.nombre === 'Jorge Tapia')?.id,
    );
  });

  it('USR-3: varios roles en la misma empresa no duplican a la persona', async () => {
    await ds.query(
      `INSERT INTO user_company_roles (user_id, company_id, rol)
       VALUES ($1, $2, 'contador')`,
      [entorno.persona(ANA), A],
    );
    const nombres = listadoDe(await usuarios().expect(200)).map(
      (u) => u.nombre,
    );
    expect(nombres.filter((n) => n === 'Ana Reyes')).toHaveLength(1);
    expect(nombres).toHaveLength(3);
  });

  it('USR-4: un autor que ya no es miembro sigue en la lista (D15)', async () => {
    await evento({ userId: entorno.persona(CARMEN) });
    const nombres = listadoDe(await usuarios().expect(200)).map(
      (u) => u.nombre,
    );
    expect(nombres).toEqual([
      'Ana Reyes',
      'Carmen Olvera',
      'Jorge Tapia',
      'Luis Mendoza',
    ]);
  });

  it('USR-2: un autor con eventos solo en otra empresa no aparece', async () => {
    const intruso = await usuarioExtra('Intruso');
    await evento({ empresa: B, userId: intruso });
    const nombres = listadoDe(await usuarios().expect(200)).map(
      (u) => u.nombre,
    );
    expect(nombres).not.toContain('Intruso');
    // Control positivo: en la empresa donde sí firmó, aparece.
    expect(
      listadoDe(await usuarios(await entorno.token(JORGE, TRANSPORTES))),
    ).toContainEqual({ id: intruso, nombre: 'Intruso' });
  });

  it('USR-3: los eventos sin usuario no agregan a nadie', async () => {
    await evento({ userId: null });
    await evento({ userId: null, accion: 'confirmar' });
    expect(listadoDe(await usuarios().expect(200))).toHaveLength(3);
  });

  it('USR-4: un miembro inactivo con membresía sí aparece', async () => {
    const id = await usuarioExtra('Zoe Inactiva', {
      empresa: A,
      activo: false,
    });
    expect(listadoDe(await usuarios().expect(200))).toContainEqual({
      id,
      nombre: 'Zoe Inactiva',
    });
  });

  it('USR-3: homónimos se desempatan por id ascendente, igual en cada llamada', async () => {
    const x = await usuarioExtra('Ana Mendoza', { empresa: A });
    const y = await usuarioExtra('Ana Mendoza', { empresa: A });
    const primera = listadoDe(await usuarios().expect(200));
    const segunda = listadoDe(await usuarios().expect(200));
    const homonimos = primera.filter((u) => u.nombre === 'Ana Mendoza');
    expect(homonimos.map((u) => u.id)).toEqual([x, y].sort());
    expect(primera.slice(0, 2)).toEqual(homonimos);
    expect(segunda).toEqual(primera);
  });

  it('USR-5: es solo lectura: no escribe y el resto de verbos no existe', async () => {
    await evento({ userId: entorno.persona(ANA) });
    const antes = await cuentaBitacora();
    await usuarios().expect(200);
    expect(await cuentaBitacora()).toBe(antes);

    const servidor = entorno.app.getHttpServer();
    const verbos = [
      request(servidor).post('/bitacora/usuarios'),
      request(servidor).put('/bitacora/usuarios'),
      request(servidor).patch('/bitacora/usuarios'),
      request(servidor).delete('/bitacora/usuarios'),
    ];
    for (const peticion of verbos) {
      const res = await peticion.auth(tokenAna, { type: 'bearer' }).send({});
      expect([404, 405]).toContain(res.status);
    }
    expect(await cuentaBitacora()).toBe(antes);
  });

  it('USR-4: el id listado sirve como userId en GET /bitacora', async () => {
    const luis = entorno.persona(LUIS);
    const suyo = await evento({ userId: luis });
    await evento({ userId: entorno.persona(ANA) });
    await evento({ empresa: B, userId: luis });
    const lista = listadoDe(await usuarios().expect(200));
    const id = lista.find((u) => u.nombre === 'Luis Mendoza')?.id;
    expect(id).toBe(luis);
    const res = await bitacora(`?userId=${id}`).expect(200);
    expect(eventosDe(res).map((e) => e.id)).toEqual([suyo]);
    expect(paginaDe(res).total).toBe(1);
  });
});
