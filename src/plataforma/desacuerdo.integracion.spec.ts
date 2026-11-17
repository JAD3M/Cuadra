import { randomUUID } from 'crypto';
import type { DataSource } from 'typeorm';
import { PasswordHasher } from '../auth/password';
import {
  ANA,
  CARMEN,
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { una } from '../database/testing/base-de-pruebas';
import { SombraService } from '../sombra/sombra.service';
import { cookieDe } from '../testing/sesion-de-pruebas';
import request from '../testing/supertest-con-origen';

/**
 * Historia 9.2 (FR-37, AD-5, AD-10): el dueño ve la tasa de desacuerdo por
 * empresa y por banco. Sale de una función que cruza empresas y devuelve solo
 * conteos; la definición es la de la 6.2 y no se guarda nada.
 */

jest.setTimeout(30_000);

const CORREO_DUENO = 'dueno-desacuerdo@cuadra.test';
const PASSWORD_DUENO = 'una-contraseña-larga-123';

let entorno: AppDeCargas;
let ds: DataSource;
let servicio: ConciliacionService;
let sombra: SombraService;
let A: string;
let B: string;
let tokenA: string;
let tokenB: string;
let linea = 0;
let n = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  servicio = entorno.app.get(ConciliacionService);
  sombra = entorno.app.get(SombraService);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  tokenA = await entorno.token(ANA, FERRETERIA);
  tokenB = await entorno.token(CARMEN, TRANSPORTES);
  const hashPw = await new PasswordHasher().hashear(PASSWORD_DUENO);
  await ds.query(
    `INSERT INTO plataforma_usuarios (correo, password_hash)
     VALUES ($1, $2) ON CONFLICT (correo) DO UPDATE SET password_hash = $2, activo = true`,
    [CORREO_DUENO, hashPw],
  );
}, 60_000);

afterAll(async () => {
  if (ds?.isInitialized) {
    await limpiar();
    await ds.query(
      'DELETE FROM sesiones WHERE plataforma_usuario_id IS NOT NULL',
    );
    await ds.query('DELETE FROM bitacora_plataforma');
    await ds.query('DELETE FROM plataforma_usuarios WHERE correo = $1', [
      CORREO_DUENO,
    ]);
  }
  await entorno?.cerrar();
});

async function limpiar() {
  if (!ds?.isInitialized) return;
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, decisiones, decision_lineas, evidencia_sombra, bitacora CASCADE',
  );
}

beforeEach(limpiar);

const http = () => request(entorno.app.getHttpServer());

async function loginDueno(): Promise<string> {
  const res = await http()
    .post('/plataforma/auth/login')
    .send({ email: CORREO_DUENO, password: PASSWORD_DUENO })
    .expect(200);
  return cookieDe(res);
}

/** Una propuesta de la regla 1 del banco indicado, creada por el motor. */
async function propuesta(empresa: string, banco: string): Promise<string> {
  n++;
  await ds.query(
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto, moneda, banco)
     VALUES ($1,$2,'2026-09-02','SPEI RECIBIDO',$3,'1160.00','MXN',$4)`,
    [empresa, linea++, `A${1000 + n}`, banco],
  );
  await ds.query(
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado, xml_raw)
     VALUES ($1,$2,$3,'XAXX010101000','A',$4,'2026-09-01T10:00:00','I','MXN',1160,1160,'abierta',
             '{"_xml":"<x/>"}'::jsonb)`,
    [
      empresa,
      randomUUID(),
      empresa === B ? TRANSPORTES : FERRETERIA,
      `${1000 + n}`,
    ],
  );
  await servicio.conciliar(empresa);
  const { id } = await una<{ id: string }>(
    ds,
    `SELECT id FROM decisiones WHERE company_id = $1 AND estado = 'propuesta'
      ORDER BY created_at DESC, id DESC LIMIT 1`,
    [empresa],
  );
  return id;
}

const post = (ruta: string, token: string, cuerpo: object = {}) =>
  http().post(ruta).set('Cookie', token).send(cuerpo);
const confirmar = (id: string, token: string) =>
  post(`/conciliaciones/${id}/confirmar`, token).expect(200);
const rechazar = (id: string, token: string) =>
  post(`/conciliaciones/${id}/rechazar`, token, {
    motivo: 'No corresponde',
  }).expect(200);

interface FilaDesacuerdo {
  companyId: string;
  razonSocial: string;
  banco: string | null;
  propuestas: number;
  tratadas: number;
  desacuerdos: number;
  tasa: string | null;
}

async function consultar(cookie: string): Promise<FilaDesacuerdo[]> {
  const res = await http()
    .get('/plataforma/desacuerdo')
    .set('Cookie', cookie)
    .expect(200);
  return res.body as FilaDesacuerdo[];
}

const fila = (filas: FilaDesacuerdo[], empresa: string, banco: string) =>
  filas.find((f) => f.companyId === empresa && f.banco === banco);

describe('GET /plataforma/desacuerdo (9.2)', () => {
  it('da la tasa por empresa y por banco, sin mezclar las de otra', async () => {
    const dueno = await loginDueno();
    await confirmar(await propuesta(A, 'bbva'), tokenA);
    await rechazar(await propuesta(A, 'bbva'), tokenA);
    await rechazar(await propuesta(A, 'banorte'), tokenA);
    await confirmar(await propuesta(B, 'bbva'), tokenB);

    const filas = await consultar(dueno);

    expect(fila(filas, A, 'bbva')).toMatchObject({
      razonSocial: expect.any(String) as string,
      propuestas: 2,
      tratadas: 2,
      desacuerdos: 1,
      tasa: '0.5000',
    });
    expect(fila(filas, A, 'banorte')).toMatchObject({
      propuestas: 1,
      tratadas: 1,
      desacuerdos: 1,
      tasa: '1.0000',
    });
    expect(fila(filas, B, 'bbva')).toMatchObject({
      propuestas: 1,
      tratadas: 1,
      desacuerdos: 0,
      tasa: '0.0000',
    });
    expect(filas).toHaveLength(3);
  });

  it('con propuestas sin tratar la tasa es null, no un cero engañoso', async () => {
    const dueno = await loginDueno();
    await propuesta(A, 'bbva');

    expect(fila(await consultar(dueno), A, 'bbva')).toMatchObject({
      propuestas: 1,
      tratadas: 0,
      desacuerdos: 0,
      tasa: null,
    });
  });

  it('una empresa sin propuestas no aparece: no inventa filas', async () => {
    const dueno = await loginDueno();
    await propuesta(A, 'bbva');

    const filas = await consultar(dueno);

    expect(filas.some((f) => f.companyId === B)).toBe(false);
  });

  it('la suma por empresa es la tasa de la 6.2 (una sola definición)', async () => {
    const dueno = await loginDueno();
    await confirmar(await propuesta(A, 'bbva'), tokenA);
    await rechazar(await propuesta(A, 'bbva'), tokenA);
    await rechazar(await propuesta(A, 'banorte'), tokenA);
    await propuesta(A, 'santander'); // sin tratar

    const delDueno = (await consultar(dueno)).filter((f) => f.companyId === A);
    const total = delDueno.reduce(
      (s, f) => ({
        propuestas: s.propuestas + f.propuestas,
        tratadas: s.tratadas + f.tratadas,
        desacuerdos: s.desacuerdos + f.desacuerdos,
      }),
      { propuestas: 0, tratadas: 0, desacuerdos: 0 },
    );

    const de62 = await sombra.tasaDesacuerdo(A);
    expect(total).toEqual({
      propuestas: de62.propuestas,
      tratadas: de62.tratadas,
      desacuerdos: de62.desacuerdos,
    });
  });

  it('solo expone conteos y porcentajes: ni ids de decisión, ni montos, ni RFC', async () => {
    const dueno = await loginDueno();
    await confirmar(await propuesta(A, 'bbva'), tokenA);

    const [primera] = await consultar(dueno);

    expect(Object.keys(primera).sort()).toEqual(
      [
        'banco',
        'companyId',
        'desacuerdos',
        'propuestas',
        'razonSocial',
        'tasa',
        'tratadas',
      ].sort(),
    );
  });

  it('se calcula por consulta: un rechazo nuevo cambia la siguiente respuesta', async () => {
    const dueno = await loginDueno();
    await confirmar(await propuesta(A, 'bbva'), tokenA);
    expect(fila(await consultar(dueno), A, 'bbva')?.tasa).toBe('0.0000');

    await rechazar(await propuesta(A, 'bbva'), tokenA);

    expect(fila(await consultar(dueno), A, 'bbva')?.tasa).toBe('0.5000');
  });

  it('una sesión de empresa recibe 403, incluso la del administrador', async () => {
    await http()
      .get('/plataforma/desacuerdo')
      .set('Cookie', tokenA)
      .expect(403);
  });

  it('sin sesión recibe 401', async () => {
    await http().get('/plataforma/desacuerdo').expect(401);
  });
});
