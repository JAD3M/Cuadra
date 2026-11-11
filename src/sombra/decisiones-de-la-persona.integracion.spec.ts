import { randomUUID } from 'crypto';
import request from '../testing/supertest-con-origen';
import type { DataSource } from 'typeorm';
import {
  ANA,
  CARMEN,
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { sembrarDecision } from '../conciliacion/siembra-decisiones';
import { filas, una } from '../database/testing/base-de-pruebas';

/**
 * Historia 6.2 (FR-35, AD-10, AD-4) contra Postgres real con RLS: lo que la
 * persona hace con una propuesta de la regla 1 (confirmar, rechazar, reabrir) se
 * anota como una fila nueva de `evidencia_sombra`, en la misma sentencia que el
 * cambio de estado, solo si la propuesta ya tenía `habria_cerrado`.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let servicio: ConciliacionService;
let A: string;
let B: string;
let tokenA: string;
let tokenB: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  servicio = entorno.app.get(ConciliacionService);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  tokenA = await entorno.token(ANA, FERRETERIA);
  tokenB = await entorno.token(CARMEN, TRANSPORTES);
}, 60_000);

afterAll(async () => {
  await limpiar();
  await entorno?.cerrar();
});

async function limpiar() {
  if (!ds?.isInitialized) return;
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, decisiones, decision_lineas, evidencia_sombra, bitacora CASCADE',
  );
}

beforeEach(limpiar);

async function movimiento(
  empresa: string,
  o: { referencia?: string; banco?: string } = {},
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto, moneda, banco)
     VALUES ($1,$2,'2026-09-02','SPEI RECIBIDO',$3,'1160.00','MXN',$4) RETURNING id`,
    [empresa, linea++, o.referencia ?? 'A1001', o.banco ?? 'bbva'],
  );
  return id;
}

async function factura(empresa: string, folio = '1001'): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado, xml_raw)
     VALUES ($1,$2,$3,'XAXX010101000','A',$4,'2026-09-01T10:00:00','I','MXN',1160,1160,'abierta',
             '{"_xml":"<x/>"}'::jsonb)
     RETURNING id`,
    [empresa, randomUUID(), empresa === B ? TRANSPORTES : FERRETERIA, folio],
  );
  return id;
}

/** Una propuesta de la regla 1, creada por el motor (lleva `habria_cerrado`). */
async function propuestaDeRegla1(
  empresa: string,
  o: { referencia?: string; folio?: string; banco?: string } = {},
): Promise<string> {
  await movimiento(empresa, o);
  await factura(empresa, o.folio);
  await servicio.conciliar(empresa);
  const { id } = await una<{ id: string }>(
    ds,
    `SELECT id FROM decisiones WHERE company_id = $1 AND estado = 'propuesta'
      ORDER BY created_at DESC, id DESC LIMIT 1`,
    [empresa],
  );
  return id;
}

/** Una propuesta de otra regla: nunca tuvo `habria_cerrado`. */
async function propuestaDeOtraRegla(empresa: string): Promise<string> {
  const movimientoId = await movimiento(empresa, { referencia: 'Z9' });
  const cfdiId = await factura(empresa, '9999');
  return sembrarDecision(ds, {
    companyId: empresa,
    movimientoId,
    cfdiId,
    estado: 'propuesta',
    origen: 'regla',
    regla: 'monto_unico',
    score: '0.9000',
    diferenciaMonto: '0.0000',
    motivo: 'Otra regla',
  });
}

const eventos = (empresa?: string) =>
  filas<{
    company_id: string;
    banco: string | null;
    decision_id: string;
    evento: string;
    persona_id: string | null;
  }>(
    ds,
    `SELECT company_id, banco, decision_id, evento, persona_id
       FROM evidencia_sombra
      WHERE evento <> 'habria_cerrado' AND ($1::uuid IS NULL OR company_id = $1)
      ORDER BY created_at, id`,
    [empresa ?? null],
  );

const post = (ruta: string, token: string, cuerpo: object = {}) =>
  request(entorno.app.getHttpServer())
    .post(ruta)
    .set('Cookie', token)
    .send(cuerpo);

describe('evidencia_sombra: lo que la persona hizo después (S1, S2)', () => {
  it('confirmar una propuesta de la regla 1 anota confirmo con la persona y el banco', async () => {
    const id = await propuestaDeRegla1(A, { banco: 'bbva' });

    await post(`/conciliaciones/${id}/confirmar`, tokenA).expect(200);

    expect(await eventos()).toEqual([
      {
        company_id: A,
        banco: 'bbva',
        decision_id: id,
        evento: 'confirmo',
        persona_id: entorno.persona(ANA),
      },
    ]);
  });

  it('rechazar anota rechazo', async () => {
    const id = await propuestaDeRegla1(A);

    await post(`/conciliaciones/${id}/rechazar`, tokenA, {
      motivo: 'No corresponde',
    }).expect(200);

    expect(await eventos()).toEqual([
      expect.objectContaining({
        decision_id: id,
        evento: 'rechazo',
        persona_id: entorno.persona(ANA),
      }),
    ]);
  });

  it('reabrir una confirmación anota reabrio, después de confirmo', async () => {
    const id = await propuestaDeRegla1(A);
    await post(`/conciliaciones/${id}/confirmar`, tokenA).expect(200);

    await post(`/conciliaciones/${id}/reabrir`, tokenA, {
      motivo: 'Error',
    }).expect(200);

    expect((await eventos()).map((e) => e.evento)).toEqual([
      'confirmo',
      'reabrio',
    ]);
  });

  it('confirmar dentro de un lote anota confirmo; reabrir el lote anota reabrio', async () => {
    const id = await propuestaDeRegla1(A);

    await post('/conciliaciones/lotes', tokenA, { ids: [id] }).expect(200);
    const { lote_id } = await una<{ lote_id: string }>(
      ds,
      `SELECT lote_id FROM decisiones WHERE id = $1`,
      [id],
    );
    await post(`/conciliaciones/lotes/${lote_id}/reabrir`, tokenA, {
      motivo: 'Error',
    }).expect(200);

    expect((await eventos()).map((e) => e.evento)).toEqual([
      'confirmo',
      'reabrio',
    ]);
  });

  it('una propuesta omitida del lote no deja confirmo (el SAVEPOINT también deshace la evidencia)', async () => {
    const rechazada = await propuestaDeRegla1(A);
    await post(`/conciliaciones/${rechazada}/rechazar`, tokenA, {
      motivo: 'No corresponde',
    }).expect(200);

    const res = await post('/conciliaciones/lotes', tokenA, {
      ids: [rechazada],
    }).expect(200);

    expect((res.body as { confirmadas: string[] }).confirmadas).toEqual([]);
    expect((await eventos()).map((e) => e.evento)).toEqual(['rechazo']);
  });

  it('una propuesta de otra regla no anota nada', async () => {
    const id = await propuestaDeOtraRegla(A);

    await post(`/conciliaciones/${id}/confirmar`, tokenA).expect(200);

    expect(await eventos()).toEqual([]);
  });

  it('las filas anteriores no cambian: la evidencia solo se agrega', async () => {
    const id = await propuestaDeRegla1(A);
    const antes = await filas(ds, `SELECT * FROM evidencia_sombra`);

    await post(`/conciliaciones/${id}/confirmar`, tokenA).expect(200);

    const despues = await filas(
      ds,
      `SELECT * FROM evidencia_sombra WHERE evento = 'habria_cerrado'`,
    );
    expect(despues).toEqual(antes);
  });

  it('con dos empresas, cada acción anota solo en la suya', async () => {
    const idA = await propuestaDeRegla1(A);
    const idB = await propuestaDeRegla1(B);

    await post(`/conciliaciones/${idA}/confirmar`, tokenA).expect(200);
    await post(`/conciliaciones/${idB}/rechazar`, tokenB, {
      motivo: 'No corresponde',
    }).expect(200);

    expect(await eventos(A)).toEqual([
      expect.objectContaining({ decision_id: idA, evento: 'confirmo' }),
    ]);
    expect(await eventos(B)).toEqual([
      expect.objectContaining({
        decision_id: idB,
        evento: 'rechazo',
        persona_id: entorno.persona(CARMEN),
      }),
    ]);
  });
});

describe('evidencia_sombra: desmarcar en un lote (S1, A1, A2)', () => {
  const lote = (token: string, cuerpo: object) =>
    post('/conciliaciones/lotes', token, cuerpo);

  it('una desmarcada anota desmarco con la persona y no cambia su estado', async () => {
    const marcada = await propuestaDeRegla1(A, { referencia: 'A1001' });
    const desmarcada = await propuestaDeRegla1(A, {
      referencia: 'A1002',
      folio: '1002',
    });

    await lote(tokenA, { ids: [marcada], desmarcadas: [desmarcada] }).expect(
      200,
    );

    const registrados = await eventos();
    expect(registrados).toHaveLength(2);
    expect(registrados).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ decision_id: marcada, evento: 'confirmo' }),
        {
          company_id: A,
          banco: 'bbva',
          decision_id: desmarcada,
          evento: 'desmarco',
          persona_id: entorno.persona(ANA),
        },
      ]),
    );
    const { estado } = await una<{ estado: string }>(
      ds,
      `SELECT estado FROM decisiones WHERE id = $1`,
      [desmarcada],
    );
    expect(estado).toBe('propuesta');
  });

  it('una id marcada y desmarcada a la vez da 400 y no registra nada', async () => {
    const id = await propuestaDeRegla1(A);

    await lote(tokenA, { ids: [id], desmarcadas: [id.toUpperCase()] }).expect(
      400,
    );

    expect(await eventos()).toEqual([]);
  });

  it('desmarcadas con un id inválido o repetido da 400', async () => {
    const id = await propuestaDeRegla1(A);

    await lote(tokenA, { ids: [id], desmarcadas: ['no-es-uuid'] }).expect(400);
    await lote(tokenA, {
      ids: [id],
      desmarcadas: [randomUUID(), randomUUID().toUpperCase()],
    }).expect(200);
    const repetida = randomUUID();
    await lote(tokenA, { ids: [id], desmarcadas: [repetida, repetida] }).expect(
      400,
    );
  });

  it('se ignora la desmarcada sin habria_cerrado, ya resuelta o de otra empresa', async () => {
    const marcada = await propuestaDeRegla1(A);
    const deOtraRegla = await propuestaDeOtraRegla(A);
    const deOtraEmpresa = await propuestaDeRegla1(B);
    const yaConfirmada = await propuestaDeRegla1(A, {
      referencia: 'A1003',
      folio: '1003',
    });
    await post(`/conciliaciones/${yaConfirmada}/confirmar`, tokenA).expect(200);

    await lote(tokenA, {
      ids: [marcada],
      desmarcadas: [deOtraRegla, deOtraEmpresa, yaConfirmada, randomUUID()],
    }).expect(200);

    expect((await eventos()).map((e) => e.evento)).toEqual([
      'confirmo',
      'confirmo',
    ]);
    expect(await eventos(B)).toEqual([]);
  });

  it('sin el campo desmarcadas el lote funciona igual que antes', async () => {
    const id = await propuestaDeRegla1(A);

    const res = await lote(tokenA, { ids: [id] }).expect(200);

    expect((res.body as { confirmadas: string[] }).confirmadas).toEqual([id]);
    expect((await eventos()).map((e) => e.evento)).toEqual(['confirmo']);
  });
});
