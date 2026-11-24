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
 * Historia 9.5 (FR-37, SM-C1, AD-5, AD-10): el dueño ve si los datos de todas
 * las empresas cumplen la condición para considerar el cierre automático. Sale
 * de funciones que cruzan empresas y devuelven solo conteos; se calcula en cada
 * consulta, no se guarda nada y no activa nada. Los umbrales y la tasa se
 * prueban a fondo en `condicion-cierre.spec.ts`; aquí, la lectura real.
 */

jest.setTimeout(30_000);

const CORREO_DUENO = 'dueno-condicion@cuadra.test';
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
    'TRUNCATE cfdi, cargas, movimientos, decisiones, decision_lineas, evidencia_sombra, muestras_verificacion, bitacora CASCADE',
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

interface Condicion {
  cumple: boolean;
  criterios: Record<
    'propuestas' | 'empresas' | 'meses',
    { pide: number; hoy: number; falta: number; cumple: boolean }
  >;
  tasa: {
    registradas: { casos: number; desacuerdos: number; tasa: string | null };
    muestra: { casos: number; desacuerdos: number; tasa: string | null };
    usada: 'registradas' | 'muestra' | null;
    tasaUsada: string | null;
    exceso: string | null;
    maxima: string;
    cumple: boolean;
  };
}

async function consultar(cookie: string): Promise<Condicion> {
  const res = await http()
    .get('/plataforma/condicion-cierre')
    .set('Cookie', cookie)
    .expect(200);
  return res.body as Condicion;
}

/** Una marca de la muestra de septiembre: primero el sorteo, luego la marca. */
async function marcarMuestra(
  empresa: string,
  decisionId: string,
  resultado: 'conforme' | 'desacuerdo',
  quien: string,
) {
  await ds.query(
    `INSERT INTO muestras_verificacion (company_id, mes, decision_id)
     VALUES ($1, '2026-09-01', $2) ON CONFLICT DO NOTHING`,
    [empresa, decisionId],
  );
  await ds.query(
    `INSERT INTO muestras_verificacion (company_id, mes, decision_id, verificador_id, resultado)
     VALUES ($1, '2026-09-01', $2, $3, $4)`,
    [empresa, decisionId, entorno.persona(quien), resultado],
  );
}

/** Cuántas filas hay donde la condición podría escribir, y no debe. */
async function conteoDeTablas() {
  return una<Record<'e' | 'm' | 'd' | 'b', string>>(
    ds,
    `SELECT (SELECT count(*) FROM evidencia_sombra) AS e,
            (SELECT count(*) FROM muestras_verificacion) AS m,
            (SELECT count(*) FROM decisiones) AS d,
            (SELECT count(*) FROM bitacora) AS b`,
  );
}

describe('GET /plataforma/condicion-cierre (9.5)', () => {
  it('sin datos nada se cumple, falta todo y las tasas son null, no cero', async () => {
    const r = await consultar(await loginDueno());

    expect(r.cumple).toBe(false);
    expect(r.criterios.propuestas).toEqual({
      pide: 1000,
      hoy: 0,
      falta: 1000,
      cumple: false,
    });
    expect(r.criterios.empresas).toMatchObject({ hoy: 0, falta: 3 });
    expect(r.criterios.meses).toMatchObject({ hoy: 0, falta: 3 });
    expect(r.tasa.registradas.tasa).toBeNull();
    expect(r.tasa.muestra.tasa).toBeNull();
    expect(r.tasa.usada).toBeNull();
    expect(r.tasa.cumple).toBe(false);
  });

  it('cuenta propuestas, empresas y meses de todas las empresas (S1)', async () => {
    const dueno = await loginDueno();
    await propuesta(A, 'bbva');
    await propuesta(A, 'banorte');
    await propuesta(B, 'bbva');

    const r = await consultar(dueno);

    expect(r.criterios.propuestas).toMatchObject({ hoy: 3, falta: 997 });
    expect(r.criterios.empresas).toMatchObject({ hoy: 2, falta: 1 });
    expect(r.criterios.meses).toMatchObject({ hoy: 1, falta: 2 });
    expect(r.cumple).toBe(false);
  });

  it('un mes distinto en la evidencia cuenta como otro mes (A1)', async () => {
    const dueno = await loginDueno();
    const id = await propuesta(A, 'bbva');
    await propuesta(A, 'bbva');
    await ds.query(
      `UPDATE evidencia_sombra SET created_at = '2026-07-20T12:00:00Z'
        WHERE decision_id = $1 AND evento = 'habria_cerrado'`,
      [id],
    );

    expect((await consultar(dueno)).criterios.meses).toMatchObject({
      hoy: 2,
      falta: 1,
    });
  });

  it('los meses se cuentan en UTC aunque la sesión de la base use otra zona (A1)', async () => {
    const id = await propuesta(A, 'bbva');
    const otra = await propuesta(A, 'bbva');
    // 23:30 del 31 de julio en México es el 1 de agosto a las 05:30 en UTC.
    await ds.query(
      `UPDATE evidencia_sombra SET created_at = '2026-07-31T23:30:00-06:00'
        WHERE decision_id = $1 AND evento = 'habria_cerrado'`,
      [id],
    );
    await ds.query(
      `UPDATE evidencia_sombra SET created_at = '2026-08-15T12:00:00Z'
        WHERE decision_id = $1 AND evento = 'habria_cerrado'`,
      [otra],
    );

    const qr = ds.createQueryRunner();
    try {
      await qr.query(`SET TIME ZONE 'America/Mexico_City'`);
      const { meses } = await una<{ meses: string }>(
        qr,
        `SELECT meses FROM conteos_condicion_cierre()`,
      );
      // En hora local serían dos meses (julio y agosto); en UTC es solo agosto.
      expect(Number(meses)).toBe(1);
    } finally {
      await qr.release();
    }
  });

  it('las respuestas registradas son la tasa de la 6.2, sumada entre empresas (S2)', async () => {
    const dueno = await loginDueno();
    await confirmar(await propuesta(A, 'bbva'), tokenA);
    await rechazar(await propuesta(A, 'bbva'), tokenA);
    await confirmar(await propuesta(B, 'bbva'), tokenB);
    await confirmar(await propuesta(B, 'bbva'), tokenB);
    await propuesta(B, 'bbva'); // sin tratar: no entra a la tasa

    const r = await consultar(dueno);

    expect(r.tasa.registradas).toEqual({
      casos: 4,
      desacuerdos: 1,
      tasa: '0.2500',
    });
    const de62 = await sombra.tasaDesacuerdo(A);
    expect(de62.tratadas + (await sombra.tasaDesacuerdo(B)).tratadas).toBe(4);
  });

  it('la muestra verificada se mide aparte y de cada caso vale la última marca (S2)', async () => {
    const dueno = await loginDueno();
    const uno = await propuesta(A, 'bbva');
    const dos = await propuesta(A, 'bbva');
    await marcarMuestra(A, uno, 'desacuerdo', ANA);
    await marcarMuestra(A, dos, 'conforme', ANA);

    expect((await consultar(dueno)).tasa.muestra).toEqual({
      casos: 2,
      desacuerdos: 1,
      tasa: '0.5000',
    });

    await marcarMuestra(A, uno, 'conforme', ANA);

    expect((await consultar(dueno)).tasa.muestra).toEqual({
      casos: 2,
      desacuerdos: 0,
      tasa: '0.0000',
    });
  });

  it('se evalúa con la más alta de las dos y dice cuánto pasa del 0.5 % (S3)', async () => {
    const dueno = await loginDueno();
    const uno = await propuesta(A, 'bbva');
    await confirmar(uno, tokenA);
    await marcarMuestra(A, uno, 'desacuerdo', ANA);

    const r = await consultar(dueno);

    expect(r.tasa.registradas.tasa).toBe('0.0000');
    expect(r.tasa.muestra.tasa).toBe('1.0000');
    expect(r.tasa.usada).toBe('muestra');
    expect(r.tasa.tasaUsada).toBe('1.0000');
    expect(r.tasa.exceso).toBe('0.9950');
    expect(r.tasa.maxima).toBe('0.0050');
    expect(r.tasa.cumple).toBe(false);
  });

  it('se calcula por consulta: una reapertura o una marca nueva cambian la siguiente respuesta (S5)', async () => {
    const dueno = await loginDueno();
    const id = await propuesta(A, 'bbva');
    await confirmar(id, tokenA);
    expect((await consultar(dueno)).tasa.registradas.tasa).toBe('0.0000');

    await post(`/conciliaciones/${id}/reabrir`, tokenA, {
      motivo: 'Se confirmó por error',
    }).expect(200);

    expect((await consultar(dueno)).tasa.registradas).toMatchObject({
      casos: 1,
      desacuerdos: 1,
      tasa: '1.0000',
    });

    await marcarMuestra(A, id, 'conforme', ANA);
    expect((await consultar(dueno)).tasa.muestra.casos).toBe(1);
  });

  it('solo expone conteos y tasas: ni ids de decisión, ni montos, ni RFC', async () => {
    const dueno = await loginDueno();
    await confirmar(await propuesta(A, 'bbva'), tokenA);

    const r = await consultar(dueno);

    expect(Object.keys(r).sort()).toEqual(['criterios', 'cumple', 'tasa']);
    expect(Object.keys(r.criterios).sort()).toEqual([
      'empresas',
      'meses',
      'propuestas',
    ]);
    expect(Object.keys(r.tasa).sort()).toEqual([
      'cumple',
      'exceso',
      'maxima',
      'muestra',
      'registradas',
      'tasaUsada',
      'usada',
    ]);
  });

  it('solo informa: consultarla no escribe nada (S4)', async () => {
    const dueno = await loginDueno();
    await confirmar(await propuesta(A, 'bbva'), tokenA);
    const antes = await conteoDeTablas();

    await consultar(dueno);
    await consultar(dueno);

    expect(await conteoDeTablas()).toEqual(antes);
  });

  it('una sesión de empresa recibe 403, incluso la del administrador (S6)', async () => {
    await http()
      .get('/plataforma/condicion-cierre')
      .set('Cookie', tokenA)
      .expect(403);
  });

  it('sin sesión recibe 401', async () => {
    await http().get('/plataforma/condicion-cierre').expect(401);
  });
});
