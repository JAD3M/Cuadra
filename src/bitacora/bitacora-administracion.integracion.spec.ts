import { randomUUID } from 'crypto';
import request from '../testing/supertest-con-origen';
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
import { filas, una } from '../database/testing/base-de-pruebas';

/**
 * Historia 2.7 (FR-51, FR-50, FR-55) por HTTP contra Postgres real con RLS:
 * los cuatro roles leen las entradas de administración y de acceso denegado
 * de su empresa, la empresa ajena no se ve, y la bitácora no tiene rutas de
 * escritura. Las filas de administración se insertan con el mismo SQL y la
 * misma forma de `datos` que los servicios de usuarios; las de acceso
 * denegado salen del 403 real de `RolesGuard`.
 *
 * Son pruebas de caracterización: el comportamiento ya existía. Cada una
 * falla si se rompe su regla (ver el registro en odd/tasks/v2-2-7).
 */

jest.setTimeout(30_000);

type Rol = 'admin' | 'contador' | 'revisor' | 'auditor';

const ACCIONES_ADMIN = [
  'invitar',
  'reenviar_invitacion',
  'cancelar_invitacion',
  'cambiar_rol',
  'quitar_rol',
] as const;
const ACCIONES = [...ACCIONES_ADMIN, 'acceso_denegado'] as const;

interface EventoApi {
  id: string;
  entidad: string;
  entidadId: string;
  accion: string;
  datos: Record<string, unknown>;
  createdAt: string;
  usuario: { nombre: string; email: string } | null;
}

interface PaginaApi {
  datos: EventoApi[];
  total: number;
}

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
}, 60_000);

afterAll(async () => {
  await restaurar();
  await entorno?.cerrar();
});

beforeEach(async () => {
  await restaurar();
  await ds.query('TRUNCATE bitacora');
});

/** Luis es contador en FERRETERIA; las pruebas lo vuelven revisor o auditor. */
async function restaurar() {
  if (!ds?.isInitialized) return;
  await comoRol('contador');
}

async function comoRol(rol: string) {
  await ds.query(
    `UPDATE user_company_roles SET rol = $3
      WHERE user_id = $1 AND company_id = $2`,
    [entorno.persona(LUIS), A, rol],
  );
}

const http = () => request(entorno.app.getHttpServer());

const bitacora = (cookie: string, consulta = '') =>
  http().get(`/bitacora${consulta}`).set('Cookie', cookie);

const paginaDe = (res: request.Response) => res.body as PaginaApi;

/** Mismo INSERT que `registrar` de los servicios de usuarios (CU-26, 2.3 a 2.6). */
async function registrarAdmin(
  empresa: string,
  actor: string,
  accion: (typeof ACCIONES_ADMIN)[number],
  datos: Record<string, unknown>,
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
     VALUES ($1, $2, 'companies', $1, $3, $4::jsonb) RETURNING id`,
    [empresa, actor, accion, JSON.stringify(datos)],
  );
  return id;
}

/** Una de cada acción de administración, con la forma de datos de su servicio. */
async function sembrarAdmin(
  empresa: string,
  actor: string,
  correo: string,
): Promise<Record<(typeof ACCIONES_ADMIN)[number], string>> {
  const persona = randomUUID();
  const invitacion = randomUUID();
  return {
    invitar: await registrarAdmin(empresa, actor, 'invitar', {
      invitacionId: invitacion,
      email: correo,
      roles: ['contador'],
    }),
    reenviar_invitacion: await registrarAdmin(
      empresa,
      actor,
      'reenviar_invitacion',
      {
        invitacionId: randomUUID(),
        anteriorId: invitacion,
        email: correo,
        roles: ['contador'],
      },
    ),
    cancelar_invitacion: await registrarAdmin(
      empresa,
      actor,
      'cancelar_invitacion',
      { invitacionId: invitacion, email: correo, roles: ['contador'] },
    ),
    cambiar_rol: await registrarAdmin(empresa, actor, 'cambiar_rol', {
      usuarioId: persona,
      email: correo,
      antes: ['revisor'],
      despues: ['contador', 'revisor'],
    }),
    quitar_rol: await registrarAdmin(empresa, actor, 'quitar_rol', {
      usuarioId: persona,
      email: correo,
      roles: ['contador'],
    }),
  };
}

/**
 * Un 403 real de `RolesGuard` (POST /cargas/cfdi exige `cargas.cargar`) deja
 * la fila de acceso denegado. Devuelve su id.
 */
async function denegar(
  persona: string,
  rfc: string,
  empresa: string,
): Promise<string> {
  await http()
    .post('/cargas/cfdi')
    .set('Cookie', await entorno.token(persona, rfc))
    .send({})
    .expect(403);
  const fila = await una<{ id: string }>(
    ds,
    `SELECT id FROM bitacora
      WHERE company_id = $1 AND accion = 'acceso_denegado'
      ORDER BY created_at DESC LIMIT 1`,
    [empresa],
  );
  return fila.id;
}

describe('Historia 2.7: los cuatro roles ven la administración y los accesos denegados', () => {
  const ROLES: Array<[Rol, string, string]> = [
    ['admin', ANA, 'admin'],
    ['contador', LUIS, 'contador'],
    ['revisor', LUIS, 'revisor'],
    ['auditor', LUIS, 'auditor'],
  ];

  it.each(ROLES)(
    '%s: 200 con las seis acciones y su detalle',
    async (rol, persona) => {
      const ana = entorno.persona(ANA);
      const luis = entorno.persona(LUIS);
      const ids = await sembrarAdmin(A, ana, 'nueva@fdb.mx');
      // Luis es auditor al ser denegado; después toma el rol de la prueba.
      await comoRol('auditor');
      const idDenegado = await denegar(LUIS, FERRETERIA, A);
      if (persona === LUIS) await comoRol(rol);

      const res = await bitacora(
        await entorno.token(persona, FERRETERIA),
      ).expect(200);
      const pagina = paginaDe(res);
      const porAccion = new Map(pagina.datos.map((e) => [e.accion, e]));

      expect(pagina.total).toBe(6);
      expect([...porAccion.keys()].sort()).toEqual([...ACCIONES].sort());
      for (const accion of ACCIONES_ADMIN) {
        expect(porAccion.get(accion)).toMatchObject({
          id: ids[accion],
          entidad: 'companies',
          entidadId: A,
          usuario: { email: ANA },
        });
        expect(
          Date.parse(porAccion.get(accion)?.createdAt ?? ''),
        ).not.toBeNaN();
      }
      expect(porAccion.get('invitar')?.datos).toEqual({
        invitacionId: expect.any(String) as unknown,
        email: 'nueva@fdb.mx',
        roles: ['contador'],
      });
      expect(porAccion.get('reenviar_invitacion')?.datos).toMatchObject({
        email: 'nueva@fdb.mx',
        roles: ['contador'],
        anteriorId: expect.any(String) as unknown,
      });
      expect(porAccion.get('cancelar_invitacion')?.datos).toMatchObject({
        email: 'nueva@fdb.mx',
        roles: ['contador'],
      });
      expect(porAccion.get('cambiar_rol')?.datos).toEqual({
        usuarioId: expect.any(String) as unknown,
        email: 'nueva@fdb.mx',
        antes: ['revisor'],
        despues: ['contador', 'revisor'],
      });
      expect(porAccion.get('quitar_rol')?.datos).toEqual({
        usuarioId: expect.any(String) as unknown,
        email: 'nueva@fdb.mx',
        roles: ['contador'],
      });

      const denegado = porAccion.get('acceso_denegado');
      expect(denegado).toMatchObject({
        id: idDenegado,
        entidad: 'companies',
        entidadId: A,
        usuario: { email: LUIS },
        datos: {
          metodo: 'POST',
          motivo: 'rol_insuficiente',
          permiso: 'cargas.cargar',
          rolesRequeridos: ['admin', 'contador'],
          rolesDelUsuario: ['auditor'],
        },
      });
      expect(Date.parse(denegado?.createdAt ?? '')).not.toBeNaN();

      // user_id y created_at están en la fila, no solo en la respuesta.
      const fila = await una<{ user_id: string; created_at: Date }>(
        ds,
        'SELECT user_id, created_at FROM bitacora WHERE id = $1',
        [idDenegado],
      );
      expect(fila.user_id).toBe(luis);
      expect(fila.created_at.toISOString()).toBe(denegado?.createdAt);
    },
  );
});

describe('Historia 2.7: otra empresa no ve nada de la ajena', () => {
  async function dosEmpresas() {
    const idsA = await sembrarAdmin(A, entorno.persona(ANA), 'a@fdb.mx');
    const idsB = await sembrarAdmin(B, entorno.persona(CARMEN), 'b@tcu.mx');
    await comoRol('auditor');
    const denegadoA = await denegar(LUIS, FERRETERIA, A);
    // Jorge es revisor en B: tampoco puede cargar.
    const denegadoB = await denegar(JORGE, TRANSPORTES, B);
    return {
      deA: [...Object.values(idsA), denegadoA],
      deB: [...Object.values(idsB), denegadoB],
    };
  }

  it('la lista y el total solo traen lo propio, vistos desde A y desde B', async () => {
    const { deA, deB } = await dosEmpresas();
    const desdeA = paginaDe(
      await bitacora(await entorno.token(ANA, FERRETERIA)).expect(200),
    );
    const desdeB = paginaDe(
      await bitacora(await entorno.token(CARMEN, TRANSPORTES)).expect(200),
    );

    expect(desdeA.total).toBe(6);
    expect(desdeA.datos.map((e) => e.id).sort()).toEqual([...deA].sort());
    expect(desdeB.total).toBe(6);
    expect(desdeB.datos.map((e) => e.id).sort()).toEqual([...deB].sort());
    expect(JSON.stringify(desdeA)).not.toContain('b@tcu.mx');
    expect(JSON.stringify(desdeB)).not.toContain('a@fdb.mx');
  });

  it.each(ACCIONES)(
    'filtrar por accion %s no cruza empresas',
    async (accion) => {
      const { deA, deB } = await dosEmpresas();
      const res = paginaDe(
        await bitacora(
          await entorno.token(ANA, FERRETERIA),
          `?accion=${accion}`,
        ).expect(200),
      );
      expect(res.total).toBe(1);
      expect(res.datos).toHaveLength(1);
      expect(deA).toContain(res.datos[0].id);
      expect(deB).not.toContain(res.datos[0].id);
    },
  );

  it('filtrar por userId o entidadId de la otra empresa da vacío y total 0', async () => {
    const { deA } = await dosEmpresas();
    const cookie = await entorno.token(ANA, FERRETERIA);
    for (const consulta of [
      `?userId=${entorno.persona(CARMEN)}`,
      `?userId=${entorno.persona(JORGE)}`,
      `?entidadId=${B}`,
    ]) {
      const res = paginaDe(await bitacora(cookie, consulta).expect(200));
      expect({ consulta, total: res.total, datos: res.datos }).toEqual({
        consulta,
        total: 0,
        datos: [],
      });
    }
    // Control: los mismos filtros con valores propios sí devuelven filas.
    const propia = paginaDe(
      await bitacora(cookie, `?entidadId=${A}`).expect(200),
    );
    expect(propia.datos.map((e) => e.id).sort()).toEqual([...deA].sort());
    const deAna = paginaDe(
      await bitacora(cookie, `?userId=${entorno.persona(ANA)}`).expect(200),
    );
    expect(deAna.total).toBe(5);
  });
});

describe('Historia 2.7: la bitácora no tiene rutas de escritura', () => {
  const VERBOS = ['post', 'put', 'patch', 'delete'] as const;

  const instantanea = () =>
    filas<{ id: string; accion: string; datos: unknown }>(
      ds,
      'SELECT id, accion, datos FROM bitacora ORDER BY id',
    );

  it('POST, PUT, PATCH y DELETE sobre /bitacora y /bitacora/:id dan 404 o 405 y no tocan filas', async () => {
    const ids = await sembrarAdmin(A, entorno.persona(ANA), 'x@fdb.mx');
    const antes = await instantanea();
    const cookie = await entorno.token(ANA, FERRETERIA);
    const rutas = [
      '/bitacora',
      `/bitacora/${ids.invitar}`,
      `/bitacora/${randomUUID()}`,
    ];

    for (const ruta of rutas) {
      for (const verbo of VERBOS) {
        const res = await http()
          [verbo](ruta)
          .set('Cookie', cookie)
          .send({ accion: 'crear', datos: {} });
        expect({ ruta, verbo, ok: [404, 405].includes(res.status) }).toEqual({
          ruta,
          verbo,
          ok: true,
        });
      }
    }
    expect(await instantanea()).toEqual(antes);
  });

  it('GET /bitacora/:id no existe: 404 aunque el id sea una fila real y no filtra nada', async () => {
    const ids = await sembrarAdmin(A, entorno.persona(ANA), 'secreto@fdb.mx');
    const res = await http()
      .get(`/bitacora/${ids.cambiar_rol}`)
      .set('Cookie', await entorno.token(ANA, FERRETERIA));
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('secreto@fdb.mx');
  });

  it('sin sesión tampoco hay ruta de escritura: la ruta no existe (404 o 405, no 401)', async () => {
    for (const res of [
      await http().post('/bitacora').send({}),
      await http().delete(`/bitacora/${randomUUID()}`),
    ]) {
      expect([404, 405]).toContain(res.status);
    }
  });
});
