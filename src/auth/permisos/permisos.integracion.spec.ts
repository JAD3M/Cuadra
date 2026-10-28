import { randomUUID } from 'crypto';
import request from '../../testing/supertest-con-origen';
import type { DataSource } from 'typeorm';
import {
  ANA,
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  LUIS,
} from '../../cargas/testing/app-de-cargas';
import { filas, una } from '../../database/testing/base-de-pruebas';

/**
 * Historia 2.1 (FR-53, FR-55) por HTTP contra Postgres real: el auditor no
 * cambia nada, cada 403 deja el rol y el permiso que faltó, y un cambio de rol
 * aplica en la siguiente petición con la misma sesión (AD-6).
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let empresa: string;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  empresa = entorno.empresa(FERRETERIA);
}, 60_000);

afterAll(async () => {
  await restaurar();
  await entorno?.cerrar();
});

beforeEach(async () => {
  await restaurar();
  await ds.query(`DELETE FROM bitacora WHERE accion = 'acceso_denegado'`);
});

/** Luis es contador en FERRETERIA; las pruebas lo vuelven auditor. */
async function restaurar() {
  if (!ds?.isInitialized) return;
  await ds.query(
    `UPDATE user_company_roles SET rol = 'contador'
      WHERE user_id = $1 AND company_id = $2`,
    [entorno.persona(LUIS), empresa],
  );
}

async function comoRol(rol: string) {
  await ds.query(
    `UPDATE user_company_roles SET rol = $3
      WHERE user_id = $1 AND company_id = $2`,
    [entorno.persona(LUIS), empresa, rol],
  );
}

const http = () => request(entorno.app.getHttpServer());

const denegados = () =>
  filas<{ user_id: string; datos: Record<string, unknown> }>(
    ds,
    `SELECT user_id, datos FROM bitacora
      WHERE company_id = $1 AND accion = 'acceso_denegado' ORDER BY created_at`,
    [empresa],
  );

const conteo = async (tabla: string) =>
  Number(
    (await una<{ n: string }>(ds, `SELECT count(*) AS n FROM ${tabla}`)).n,
  );

describe('auditor: solo consulta (FR-54)', () => {
  const ACCIONES: Array<[string, string, string]> = [
    ['confirmar', 'post', `/conciliaciones/${randomUUID()}/confirmar`],
    ['rechazar', 'post', `/conciliaciones/${randomUUID()}/rechazar`],
    ['cargar CFDI', 'post', '/cargas/cfdi'],
    ['cargar estado de cuenta', 'post', '/cargas/estado-cuenta'],
    ['cargar estado de cuenta PDF', 'post', '/cargas/estado-cuenta/pdf'],
    ['editar la tolerancia', 'put', '/empresa/tolerancia'],
  ];

  it.each(ACCIONES)(
    '%s: 403, nada cambia y queda el rol y el permiso',
    async (_nombre, metodo, ruta) => {
      await comoRol('auditor');
      const cookie = await entorno.token(LUIS, FERRETERIA);
      const antes = [
        await conteo('cargas'),
        await conteo('conciliaciones'),
        await conteo('bitacora'),
      ];

      const peticion =
        metodo === 'put'
          ? http().put(ruta).send({ toleranciaMonto: '5' })
          : http().post(ruta).send({});
      const res = await peticion.set('Cookie', cookie);

      expect(res.status).toBe(403);
      expect(await conteo('cargas')).toBe(antes[0]);
      expect(await conteo('conciliaciones')).toBe(antes[1]);
      const filasDenegadas = await denegados();
      expect(await conteo('bitacora')).toBe(antes[2] + 1);
      expect(filasDenegadas).toHaveLength(1);
      expect(filasDenegadas[0]).toMatchObject({
        user_id: entorno.persona(LUIS),
        datos: {
          rolesDelUsuario: ['auditor'],
          permiso: expect.any(String) as unknown,
          motivo: 'rol_insuficiente',
        },
      });
    },
  );

  it('el permiso registrado es el de la matriz, no el nombre de la ruta', async () => {
    await comoRol('auditor');
    await http()
      .post('/cargas/cfdi')
      .set('Cookie', await entorno.token(LUIS, FERRETERIA))
      .send({})
      .expect(403);
    const [fila] = await denegados();
    expect(fila?.datos).toMatchObject({
      permiso: 'cargas.cargar',
      rolesRequeridos: ['admin', 'contador'],
    });
  });

  it('consulta la bandeja y la bitácora: 200', async () => {
    await comoRol('auditor');
    const cookie = await entorno.token(LUIS, FERRETERIA);
    await http().get('/bandeja').set('Cookie', cookie).expect(200);
    await http().get('/bitacora').set('Cookie', cookie).expect(200);
    expect(await denegados()).toHaveLength(0);
  });

  it('no ve cargas ni tolerancia (FR-53): 403 con el permiso que faltó', async () => {
    await comoRol('auditor');
    const cookie = await entorno.token(LUIS, FERRETERIA);
    await http().get('/cargas').set('Cookie', cookie).expect(403);
    await http()
      .get(`/cargas/${randomUUID()}`)
      .set('Cookie', cookie)
      .expect(403);
    await http().get('/empresa/tolerancia').set('Cookie', cookie).expect(403);
    await http().get('/bancos/perfiles').set('Cookie', cookie).expect(403);
    const permisos = (await denegados()).map((d) => d.datos.permiso);
    expect(permisos).toEqual([
      'cargas.ver',
      'cargas.ver',
      'tolerancia.ver',
      'cargas.cargar',
    ]);
  });

  it('consulta el resumen y un caso: pasa el guard', async () => {
    await comoRol('auditor');
    const cookie = await entorno.token(LUIS, FERRETERIA);
    await http().get('/bandeja/resumen').set('Cookie', cookie).expect(200);
    await http()
      .get(`/casos/${randomUUID()}`)
      .set('Cookie', cookie)
      .expect(404);
  });
});

describe('FR-53: el revisor no ve cargas ni tolerancia', () => {
  it('403 en ambas y sí consulta la bandeja', async () => {
    await comoRol('revisor');
    const cookie = await entorno.token(LUIS, FERRETERIA);
    await http().get('/cargas').set('Cookie', cookie).expect(403);
    await http().get('/empresa/tolerancia').set('Cookie', cookie).expect(403);
    await http().get('/bandeja').set('Cookie', cookie).expect(200);
  });
});

describe('AD-6: el cambio de rol aplica en la siguiente petición', () => {
  it('con la misma sesión, de contador a auditor y de vuelta', async () => {
    const cookie = await entorno.token(LUIS, FERRETERIA);
    // Contador: pasa el guard (sin archivos, el 400 viene de la validación).
    const antes = await http().post('/cargas/cfdi').set('Cookie', cookie);
    expect(antes.status).not.toBe(403);

    await comoRol('auditor');
    await http().post('/cargas/cfdi').set('Cookie', cookie).expect(403);

    await comoRol('contador');
    const despues = await http().post('/cargas/cfdi').set('Cookie', cookie);
    expect(despues.status).not.toBe(403);
  });

  it('un admin conserva sus permisos de edición', async () => {
    await http()
      .put('/empresa/tolerancia')
      .set('Cookie', await entorno.token(ANA, FERRETERIA))
      .send({ toleranciaMonto: '0' })
      .expect(200);
  });
});
