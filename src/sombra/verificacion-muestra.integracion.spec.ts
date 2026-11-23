import { randomUUID } from 'crypto';
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
import { sembrarDecision } from '../conciliacion/siembra-decisiones';
import { filas, una } from '../database/testing/base-de-pruebas';
import request from '../testing/supertest-con-origen';
import type { MarcaGuardadaDto, MuestraDto } from './dto/muestra.dto';

/**
 * Historia 9.4 (FR-63, AD-7, AD-10, AD-11) de punta a punta contra Postgres
 * real con RLS: GET /muestra y POST /muestra/casos/:decisionId/verificar.
 * Ferretería: Ana es admin, Luis contador (quien confirma el lote) y Jorge
 * se vuelve revisor; las pruebas mueven esos roles.
 */

jest.setTimeout(60_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;
let linea = 0;

const MES = '2026-09';

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
}, 60_000);

afterAll(async () => {
  await restaurar();
  await limpiar();
  await entorno?.cerrar();
});

async function limpiar() {
  if (!ds?.isInitialized) return;
  await ds.query(
    'TRUNCATE muestras_verificacion, cfdi, cargas, movimientos, decisiones, decision_lineas, bitacora CASCADE',
  );
}

async function restaurar() {
  if (!ds?.isInitialized) return;
  await ds.query(
    `DELETE FROM user_company_roles WHERE user_id = $1 AND company_id = $2`,
    [entorno.persona(JORGE), A],
  );
  await ds.query(
    `UPDATE user_company_roles SET rol = 'contador' WHERE user_id = $1 AND company_id = $2`,
    [entorno.persona(LUIS), A],
  );
}

beforeEach(async () => {
  await restaurar();
  await limpiar();
});

async function darRol(correo: string, rol: string) {
  await ds.query(
    `INSERT INTO user_company_roles (user_id, company_id, rol) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [entorno.persona(correo), A, rol],
  );
}

async function cambiarRol(correo: string, rol: string) {
  await ds.query(
    `UPDATE user_company_roles SET rol = $3 WHERE user_id = $1 AND company_id = $2`,
    [entorno.persona(correo), A, rol],
  );
}

/** Una confirmada en lote de la regla 1, ya dentro de la muestra de septiembre. */
async function enLaMuestra(
  opciones: { empresa?: string; confirma?: string; enMuestra?: boolean } = {},
) {
  const empresa = opciones.empresa ?? A;
  const { id: movimientoId } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, carga_id, linea_numero, fecha, descripcion, referencia, monto, banco, estado)
     VALUES ($1,NULL,$2,'2026-09-02','SPEI RECIBIDO','R1','1160.00','bbva','conciliado') RETURNING id`,
    [empresa, linea++],
  );
  const { id: cfdiId } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, carga_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado,
                       metodo_pago, xml_raw)
     VALUES ($1,NULL,$2,$3,'XAXX010101000','A','1001','2026-09-01T10:00:00','I','MXN',
             1000,1160,'conciliada','PUE','{"_xml":"<x/>"}'::jsonb) RETURNING id`,
    [empresa, randomUUID(), FERRETERIA],
  );
  const id = await sembrarDecision(ds, {
    companyId: empresa,
    movimientoId,
    cfdiId,
    estado: 'confirmada',
    origen: 'regla',
    regla: 'referencia_monto_exacto',
    score: '1.0000',
    diferenciaMonto: '0.0000',
    confirmadaPorId: entorno.persona(opciones.confirma ?? LUIS),
    confirmadaAt: new Date('2026-09-15T12:00:00Z'),
  });
  await ds.query(
    `UPDATE decisiones SET lote_id = gen_random_uuid() WHERE id = $1`,
    [id],
  );
  if (opciones.enMuestra !== false) {
    await ds.query(
      `INSERT INTO muestras_verificacion (company_id, mes, decision_id) VALUES ($1, '2026-09-01', $2)`,
      [empresa, id],
    );
  }
  return { id, movimientoId, cfdiId };
}

const token = (correo: string, rfc = FERRETERIA) => entorno.token(correo, rfc);

interface Respuesta {
  status: number;
  /** La lectura (GET) y la marca guardada (POST) comparten la forma del cuerpo. */
  body: MuestraDto & MarcaGuardadaDto;
}

/** Una petición que se puede esperar (`await`) o encadenar con `.expect(estado)`. */
interface Pedido extends PromiseLike<Respuesta> {
  expect(estado: number): Promise<Respuesta>;
}

function pedir(
  hacer: (cookie: string) => PromiseLike<Respuesta>,
  correo: string,
  rfc = FERRETERIA,
): Pedido {
  const respuesta = token(correo, rfc).then(hacer);
  return {
    then: (alCumplir, alFallar) => respuesta.then(alCumplir, alFallar),
    expect: async (estado) => {
      const r = await respuesta;
      expect(r.status).toBe(estado);
      return r;
    },
  };
}

const leer = (correo: string, query = `?mes=${MES}`, rfc = FERRETERIA) =>
  pedir(
    (cookie) =>
      request(entorno.app.getHttpServer())
        .get(`/muestra${query}`)
        .set('Cookie', cookie),
    correo,
    rfc,
  );

const marcar = (
  correo: string,
  decisionId: string,
  cuerpo: object = { resultado: 'conforme' },
) =>
  pedir(
    (cookie) =>
      request(entorno.app.getHttpServer())
        .post(`/muestra/casos/${decisionId}/verificar`)
        .set('Cookie', cookie)
        .send(cuerpo),
    correo,
  );

const marcas = (decisionId: string) =>
  filas<{ resultado: string; verificador_id: string }>(
    ds,
    `SELECT resultado, verificador_id FROM muestras_verificacion
      WHERE decision_id = $1 AND resultado IS NOT NULL ORDER BY created_at, id`,
    [decisionId],
  );

const bitacora = () =>
  filas<{
    user_id: string;
    entidad: string;
    entidad_id: string;
    datos: { mes: string; resultado: string };
  }>(
    ds,
    `SELECT user_id, entidad, entidad_id, datos FROM bitacora WHERE accion = 'verificar_muestra'`,
  );

describe('verificar la muestra (9.4)', () => {
  it('el revisor ve cada caso con su factura, su movimiento y la regla (S1)', async () => {
    await darRol(JORGE, 'revisor');
    const caso = await enLaMuestra();

    const r = await leer(JORGE).expect(200);

    expect(r.body.mes).toBe(MES);
    expect(r.body.meses).toEqual([MES]);
    expect(r.body.avance).toEqual({
      total: 1,
      conformes: 0,
      desacuerdos: 0,
      pendientes: 1,
    });
    expect(r.body.casos).toHaveLength(1);
    const c = r.body.casos[0];
    expect(c).toMatchObject({
      decisionId: caso.id,
      movimientoId: caso.movimientoId,
      regla: 'referencia_monto_exacto',
      monto: '1160.0000',
      banco: 'bbva',
      marca: 'pendiente',
      reabierta: false,
      puedeMarcar: true,
    });
    expect(c.cfdis).toHaveLength(1);
    expect(c.cfdis[0]).toMatchObject({ id: caso.cfdiId, total: '1160.0000' });
  });

  it('sin mes pedido muestra el más reciente; sin muestra, vacía', async () => {
    await darRol(JORGE, 'revisor');
    expect((await leer(JORGE, '')).body).toMatchObject({
      mes: null,
      meses: [],
      casos: [],
    });
    await enLaMuestra();
    expect((await leer(JORGE, '')).body.mes).toBe(MES);
    await leer(JORGE, '?mes=septiembre').expect(400);
  });

  it('en una empresa sin revisor la verifica el admin (S2)', async () => {
    const caso = await enLaMuestra();

    const lectura = await leer(ANA).expect(200);
    expect(lectura.body.casos[0].puedeMarcar).toBe(true);
    await marcar(ANA, caso.id).expect(201);
    expect(await marcas(caso.id)).toHaveLength(1);
  });

  it('con un revisor en la empresa, el admin ya no marca: solo lee (S2)', async () => {
    await darRol(JORGE, 'revisor');
    const caso = await enLaMuestra();

    expect((await leer(ANA)).body.casos[0].puedeMarcar).toBe(false);
    await marcar(ANA, caso.id).expect(403);
    expect(await marcas(caso.id)).toHaveLength(0);
    const denegados = await filas(
      ds,
      `SELECT 1 FROM bitacora WHERE accion = 'acceso_denegado' AND user_id = $1`,
      [entorno.persona(ANA)],
    );
    expect(denegados).toHaveLength(1);
  });

  it('quien confirmó el lote no lo verifica si hay otra persona elegible (S3)', async () => {
    await cambiarRol(LUIS, 'revisor');
    await darRol(JORGE, 'revisor');
    const caso = await enLaMuestra({ confirma: LUIS });

    expect((await leer(LUIS)).body.casos[0].puedeMarcar).toBe(false);
    await marcar(LUIS, caso.id).expect(403);
    await marcar(JORGE, caso.id).expect(201);
  });

  it('si quien confirmó es la única persona elegible, sí puede (S3)', async () => {
    await cambiarRol(LUIS, 'revisor');
    const caso = await enLaMuestra({ confirma: LUIS });

    expect((await leer(LUIS)).body.casos[0].puedeMarcar).toBe(true);
    await marcar(LUIS, caso.id).expect(201);
  });

  it('cada marca queda con persona y fecha, y en la bitácora; la última vale (S4)', async () => {
    await darRol(JORGE, 'revisor');
    const caso = await enLaMuestra();

    await marcar(JORGE, caso.id, { resultado: 'desacuerdo' }).expect(201);
    const segunda = await marcar(JORGE, caso.id, {
      resultado: 'conforme',
    }).expect(201);

    expect(segunda.body).toMatchObject({
      decisionId: caso.id,
      marca: 'conforme',
    });
    expect((await marcas(caso.id)).map((m) => m.resultado)).toEqual([
      'desacuerdo',
      'conforme',
    ]);
    expect((await marcas(caso.id))[0].verificador_id).toBe(
      entorno.persona(JORGE),
    );
    const rastro = await bitacora();
    expect(rastro).toHaveLength(2);
    expect(rastro[0]).toMatchObject({
      user_id: entorno.persona(JORGE),
      entidad: 'decisiones',
      entidad_id: caso.id,
    });
    expect(rastro.map((f) => f.datos.resultado).sort()).toEqual([
      'conforme',
      'desacuerdo',
    ]);
    expect(rastro[0].datos.mes).toBe(MES);

    const lectura = (await leer(JORGE)).body;
    expect(lectura.casos[0]).toMatchObject({ marca: 'conforme' });
    expect(lectura.avance).toEqual({
      total: 1,
      conformes: 1,
      desacuerdos: 0,
      pendientes: 0,
    });
  });

  it('en desacuerdo no reabre nada por sí solo (S5)', async () => {
    await darRol(JORGE, 'revisor');
    const caso = await enLaMuestra();

    await marcar(JORGE, caso.id, { resultado: 'desacuerdo' }).expect(201);

    const d = await una<{ estado: string }>(
      ds,
      `SELECT estado FROM decisiones WHERE id = $1`,
      [caso.id],
    );
    const m = await una<{ estado: string }>(
      ds,
      `SELECT estado FROM movimientos WHERE id = $1`,
      [caso.movimientoId],
    );
    expect(d.estado).toBe('confirmada');
    expect(m.estado).toBe('conciliado');
  });

  it('el auditor ve la muestra pero no la marca (S6)', async () => {
    await cambiarRol(LUIS, 'auditor');
    const caso = await enLaMuestra({ confirma: ANA });

    const lectura = await leer(LUIS).expect(200);
    expect(lectura.body.casos[0].puedeMarcar).toBe(false);
    await marcar(LUIS, caso.id).expect(403);
  });

  it('un contador no ve la muestra', async () => {
    await enLaMuestra();
    await leer(LUIS).expect(403);
  });

  it('un caso reabierto se muestra como tal y ya no se marca', async () => {
    await darRol(JORGE, 'revisor');
    const caso = await enLaMuestra();
    await ds.query(`UPDATE decisiones SET estado = 'reabierta' WHERE id = $1`, [
      caso.id,
    ]);

    expect((await leer(JORGE)).body.casos[0]).toMatchObject({
      reabierta: true,
      puedeMarcar: false,
    });
    await marcar(JORGE, caso.id).expect(409);
  });

  it('rechaza un resultado inválido, un caso fuera de la muestra y uno de otra empresa', async () => {
    await darRol(JORGE, 'revisor');
    const caso = await enLaMuestra();
    const fuera = await enLaMuestra({ enMuestra: false });
    const ajena = await enLaMuestra({ empresa: B });

    await marcar(JORGE, caso.id, { resultado: 'quizas' }).expect(400);
    await marcar(JORGE, caso.id, {}).expect(400);
    await marcar(JORGE, fuera.id).expect(404);
    await marcar(JORGE, ajena.id).expect(404);
    await marcar(JORGE, randomUUID()).expect(404);
    expect(await marcas(caso.id)).toHaveLength(0);
  });

  it('cada empresa ve solo su muestra', async () => {
    await darRol(JORGE, 'revisor');
    const deA = await enLaMuestra();
    const deB = await enLaMuestra({ empresa: B, confirma: CARMEN });

    const a = (await leer(JORGE)).body.casos;
    expect(a.map((c: { decisionId: string }) => c.decisionId)).toEqual([
      deA.id,
    ]);
    const b = await leer(CARMEN, `?mes=${MES}`, TRANSPORTES).expect(200);
    expect(
      b.body.casos.map((c: { decisionId: string }) => c.decisionId),
    ).toEqual([deB.id]);
  });
});
