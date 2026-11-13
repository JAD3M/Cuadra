import request from '../testing/supertest-con-origen';
import {
  type AppDeCargas,
  FERRETERIA,
  JORGE,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { BANCOS_PDF } from './pdf/lectores-pdf';

/**
 * Historia 8.3 (UX-DR4): `GET /bancos/pdf` sirve la lista de bancos con lector
 * de PDF; la pantalla de cargas la usa en lugar de tenerla copiada.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
}, 60_000);

afterAll(async () => {
  await entorno?.cerrar();
});

const http = () => request(entorno.app.getHttpServer());

describe('GET /bancos/pdf (historia 8.3)', () => {
  it('quien puede cargar ve BBVA, Banorte y Santander, con su id y su nombre', async () => {
    const res = await http()
      .get('/bancos/pdf')
      .set('Cookie', await entorno.token(LUIS, FERRETERIA))
      .expect(200);
    expect(res.body).toEqual([
      { id: 'bbva', nombre: 'BBVA' },
      { id: 'banorte', nombre: 'Banorte' },
      { id: 'santander', nombre: 'Santander' },
    ]);
  });

  it('trae exactamente los bancos con lector registrado', async () => {
    const res = await http()
      .get('/bancos/pdf')
      .set('Cookie', await entorno.token(LUIS, FERRETERIA))
      .expect(200);
    expect((res.body as Array<{ id: string }>).map((b) => b.id)).toEqual([
      ...BANCOS_PDF,
    ]);
  });

  it('sin sesión: 401', async () => {
    await http().get('/bancos/pdf').expect(401);
  });

  it('un revisor no carga, así que no ve la lista: 403', async () => {
    await http()
      .get('/bancos/pdf')
      .set('Cookie', await entorno.token(JORGE, TRANSPORTES))
      .expect(403);
  });
});
