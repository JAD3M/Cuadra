import { randomUUID } from 'crypto';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import {
  ANA,
  type AppDeCargas,
  FERRETERIA,
  JORGE,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { filas, una } from '../database/testing/base-de-pruebas';
import type { ResolucionRespuestaDto } from './dto/resolucion.dto';

/**
 * CU-15 (rechazo) de punta a punta contra Postgres real con RLS:
 * POST /conciliaciones/:id/rechazar. Los datos se preparan con la conexión
 * del dueño; el endpoint escribe como cuadra_app.
 */

jest.setTimeout(30_000);

const RFC_FERRETERIA = FERRETERIA;

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
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function movimiento(
  empresa: string,
  o: { monto?: string; estado?: string; cargaId?: string | null } = {},
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, carga_id, linea_numero, fecha, descripcion, monto, estado)
     VALUES ($1,$2,$3,'2026-09-02','SPEI RECIBIDO',$4,$5)
     RETURNING id`,
    [
      empresa,
      o.cargaId ?? null,
      linea++,
      o.monto ?? '1160.00',
      o.estado ?? 'abierto',
    ],
  );
  return id;
}

/** El emisor es la empresa (Ferretería), como pide el motor. */
async function factura(
  empresa: string,
  o: { total?: string; cargaId?: string | null; estado?: string } = {},
): Promise<string> {
  const total = o.total ?? '1160.00';
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, carga_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado,
                       metodo_pago, xml_raw)
     VALUES ($1,$2,$3,$4,'XAXX010101000','A','1001','2026-09-01T10:00:00','I','MXN',
             $5,$5,$6,'PUE','{"_xml":"<x/>"}'::jsonb)
     RETURNING id`,
    [
      empresa,
      o.cargaId ?? null,
      randomUUID(),
      RFC_FERRETERIA,
      total,
      o.estado ?? 'abierta',
    ],
  );
  return id;
}

async function carga(
  empresa: string,
  subidoPor: string,
  tipo: 'cfdi' | 'estado_cuenta',
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cargas (company_id, tipo, estado, nombre_archivo, hash_archivo, subido_por_id)
     VALUES ($1,$2,'procesada','x',$3,$4) RETURNING id`,
    [empresa, tipo, randomUUID().replace(/-/g, '').repeat(2), subidoPor],
  );
  return id;
}

async function conciliacion(
  empresa: string,
  cfdiId: string,
  movimientoId: string,
  estado: 'propuesta' | 'rechazada' | 'confirmada' = 'propuesta',
  diferencia = '0.0000',
): Promise<string> {
  const persona = estado === 'confirmada' ? entorno.persona(ANA) : null;
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen, regla, score,
                                 diferencia_monto, motivo, confirmada_por_id, confirmada_at)
     VALUES ($1,$2,$3,$4::text,'regla','monto_unico','0.9000',$5,'Motivo de propuesta',$6,
             CASE WHEN $6::uuid IS NULL THEN NULL ELSE now() END)
     RETURNING id`,
    [empresa, cfdiId, movimientoId, estado, diferencia, persona],
  );
  return id;
}

/** Una propuesta lista para resolver, con su CFDI y su movimiento. */
async function propuesta(empresa = A, diferencia = '0.0000') {
  const cfdiId = await factura(empresa);
  const movimientoId = await movimiento(empresa);
  const id = await conciliacion(
    empresa,
    cfdiId,
    movimientoId,
    'propuesta',
    diferencia,
  );
  return { id, cfdiId, movimientoId };
}

const rechazar = (id: string, token = tokenAna, cuerpo: object = {}) =>
  request(entorno.app.getHttpServer())
    .post(`/conciliaciones/${id}/rechazar`)
    .auth(token, { type: 'bearer' })
    .send(cuerpo);

const confirmar = (id: string, token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .post(`/conciliaciones/${id}/confirmar`)
    .auth(token, { type: 'bearer' })
    .send();

const estadoDe = async (tabla: 'cfdi' | 'movimientos', id: string) =>
  (
    await una<{ estado: string }>(
      ds,
      `SELECT estado FROM ${tabla} WHERE id = $1`,
      [id],
    )
  ).estado;

const conciliacionEn = (id: string) =>
  una<{ estado: string; motivo: string | null }>(
    ds,
    'SELECT estado, motivo FROM conciliaciones WHERE id = $1',
    [id],
  );

const bitacoraDe = (id: string) =>
  filas<{
    accion: string;
    entidad: string;
    userId: string;
    datos: Record<string, any>;
  }>(
    ds,
    `SELECT accion, entidad, user_id AS "userId", datos
       FROM bitacora WHERE entidad_id = $1`,
    [id],
  );

describe('POST /conciliaciones/:id/rechazar (RS-R1, RS-R2)', () => {
  it('rechaza la propuesta, guarda el motivo y deja abiertos al CFDI y al movimiento', async () => {
    const { id, cfdiId, movimientoId } = await propuesta();
    jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });

    const res = await rechazar(id, tokenAna, {
      motivo: '  El pago es de otro cliente  ',
    }).expect(200);

    expect(res.body).toEqual({
      id,
      estado: 'rechazada',
      cfdiId,
      movimientoId,
      motivo: 'El pago es de otro cliente',
      confirmadaAt: null,
      rechazadasAutomaticamente: [],
    });
    expect(await conciliacionEn(id)).toEqual({
      estado: 'rechazada',
      motivo: 'El pago es de otro cliente',
    });
    expect(
      (
        await una<{ estado: string }>(
          ds,
          'SELECT estado FROM cfdi WHERE id=$1',
          [cfdiId],
        )
      ).estado,
    ).toBe('abierta');
    expect(
      (
        await una<{ estado: string }>(
          ds,
          'SELECT estado FROM movimientos WHERE id=$1',
          [movimientoId],
        )
      ).estado,
    ).toBe('abierto');
  });

  it.each([{}, { motivo: '   ' }])(
    'sin motivo (%j) conserva el de la propuesta',
    async (cuerpo) => {
      const { id } = await propuesta();
      jest
        .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
        .mockResolvedValue({ propuestas: 0 });

      const res = await rechazar(id, tokenAna, cuerpo).expect(200);

      expect(res.body).toMatchObject({ motivo: 'Motivo de propuesta' });
      expect((await conciliacionEn(id)).motivo).toBe('Motivo de propuesta');
    },
  );

  it('un motivo de más de 500 caracteres da 400 y no escribe nada', async () => {
    const { id } = await propuesta();

    await rechazar(id, tokenAna, { motivo: 'x'.repeat(501) }).expect(400);

    expect((await conciliacionEn(id)).estado).toBe('propuesta');
    expect(await bitacoraDe(id)).toHaveLength(0);
  });

  it('un id que no es uuid da 400', async () => {
    await rechazar('no-es-uuid').expect(400);
  });

  it('sin sesión da 401', async () => {
    const { id } = await propuesta();
    await request(entorno.app.getHttpServer())
      .post(`/conciliaciones/${id}/rechazar`)
      .expect(401);
  });

  it.each([
    ['contador', LUIS, FERRETERIA],
    ['revisor', JORGE, TRANSPORTES],
  ] as const)('un %s puede rechazar', async (_rol, persona, rfc) => {
    const empresa = entorno.empresa(rfc);
    const cfdiId = await factura(empresa);
    const movimientoId = await movimiento(empresa);
    const id = await conciliacion(empresa, cfdiId, movimientoId);
    jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });

    await rechazar(id, await entorno.token(persona, rfc)).expect(200);

    expect((await conciliacionEn(id)).estado).toBe('rechazada');
  });
});

describe('RS-R3: quien subió la carga sí puede rechazar', () => {
  it('Ana subió el CFDI y el estado de cuenta y rechaza igual', async () => {
    const ana = entorno.persona(ANA);
    const cfdiId = await factura(A, {
      cargaId: await carga(A, ana, 'cfdi'),
    });
    const movimientoId = await movimiento(A, {
      cargaId: await carga(A, ana, 'estado_cuenta'),
    });
    const id = await conciliacion(A, cfdiId, movimientoId);
    jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });

    await rechazar(id).expect(200);

    expect((await conciliacionEn(id)).estado).toBe('rechazada');
  });
});

describe('RS-X2, RS-X3: 404 sin fuga y solo una propuesta transiciona', () => {
  it('una conciliación de otra empresa y un uuid inexistente dan el mismo 404, sin cambios', async () => {
    const ajena = await propuesta(B);

    const deOtra = await rechazar(ajena.id).expect(404);
    const inexistente = await rechazar(randomUUID()).expect(404);

    expect(deOtra.body).toEqual(inexistente.body);
    expect((await conciliacionEn(ajena.id)).estado).toBe('propuesta');
    expect(await bitacoraDe(ajena.id)).toHaveLength(0);
  });

  it('rechazar dos veces da 409 la segunda y no escribe otra bitácora', async () => {
    const { id } = await propuesta();
    jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });
    await rechazar(id).expect(200);

    await rechazar(id, tokenAna, { motivo: 'otra vez' }).expect(409);

    expect((await conciliacionEn(id)).motivo).toBe('Motivo de propuesta');
    expect(await bitacoraDe(id)).toHaveLength(1);
  });

  it('una conciliación confirmada da 409 y no cambia', async () => {
    const cfdiId = await factura(A);
    const movimientoId = await movimiento(A, { estado: 'conciliado' });
    const id = await conciliacion(A, cfdiId, movimientoId, 'confirmada');

    await rechazar(id).expect(409);

    expect((await conciliacionEn(id)).estado).toBe('confirmada');
    expect(await bitacoraDe(id)).toHaveLength(0);
  });
});

describe('RS-X6: bitácora', () => {
  it('escribe una fila rechazar con antes, después y la diferencia como texto', async () => {
    const { id, cfdiId, movimientoId } = await propuesta(A, '0.5000');
    jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });

    await rechazar(id, tokenAna, { motivo: 'No corresponde' }).expect(200);

    const [fila, ...resto] = await bitacoraDe(id);
    expect(resto).toHaveLength(0);
    expect(fila).toMatchObject({
      accion: 'rechazar',
      entidad: 'conciliaciones',
      userId: entorno.persona(ANA),
    });
    expect(fila.datos).toEqual({
      antes: { estado: 'propuesta', motivo: 'Motivo de propuesta' },
      despues: { estado: 'rechazada', motivo: 'No corresponde' },
      cfdiId,
      movimientoId,
      diferenciaMonto: '0.5000',
    });
  });
});

describe('RS-X7: permisos de cuadra_app', () => {
  it('no puede borrar conciliaciones ni tocar la bitácora salvo insertar', async () => {
    const privilegio = async (tabla: string, permiso: string) =>
      (
        await una<{ ok: boolean }>(
          ds,
          `SELECT has_table_privilege('cuadra_app', $1, $2) AS ok`,
          [tabla, permiso],
        )
      ).ok;

    expect(await privilegio('conciliaciones', 'UPDATE')).toBe(true);
    expect(await privilegio('conciliaciones', 'DELETE')).toBe(false);
    expect(await privilegio('bitacora', 'INSERT')).toBe(true);
    expect(await privilegio('bitacora', 'UPDATE')).toBe(false);
    expect(await privilegio('bitacora', 'DELETE')).toBe(false);
  });
});

describe('RS-R4, RS-R5: conciliar después del commit', () => {
  it('corre una vez cuando el rechazo libera al movimiento', async () => {
    const { id } = await propuesta();
    const conciliar = jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });

    await rechazar(id).expect(200);

    expect(conciliar).toHaveBeenCalledTimes(1);
    expect(conciliar).toHaveBeenCalledWith(A);
  });

  it('no corre si el movimiento y el CFDI conservan otra propuesta', async () => {
    const c1 = await factura(A);
    const c2 = await factura(A);
    const m1 = await movimiento(A);
    const m2 = await movimiento(A);
    const id = await conciliacion(A, c1, m1);
    await conciliacion(A, c2, m1);
    await conciliacion(A, c1, m2);
    const conciliar = jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });

    await rechazar(id).expect(200);

    expect(conciliar).not.toHaveBeenCalled();
  });

  it('si conciliar truena, el rechazo responde 200 y queda confirmado', async () => {
    const { id } = await propuesta();
    const conciliar = jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockRejectedValue(new Error('se cayó el motor'));

    await rechazar(id).expect(200);

    expect(conciliar).toHaveBeenCalledTimes(1);
    expect((await conciliacionEn(id)).estado).toBe('rechazada');
  });

  it('el motor real no vuelve a proponer el par rechazado', async () => {
    const { id, cfdiId, movimientoId } = await propuesta();

    await rechazar(id).expect(200);

    const vivas = await filas(
      ds,
      `SELECT id FROM conciliaciones
        WHERE cfdi_id = $1 AND movimiento_id = $2 AND estado <> 'rechazada'`,
      [cfdiId, movimientoId],
    );
    expect(vivas).toHaveLength(0);
    expect((await conciliacionEn(id)).estado).toBe('rechazada');
  });
});

describe('RS-K2: rechazos concurrentes', () => {
  it('dos rechazos a la vez: uno da 200 y el otro 409', async () => {
    const { id } = await propuesta();
    jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });

    const resultados = await Promise.all([rechazar(id), rechazar(id)]);

    expect(resultados.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await bitacoraDe(id)).toHaveLength(1);
  });
});

/** La propuesta con un movimiento que trae su motivo de "sin match" guardado. */
async function movimientoConMotivo(empresa: string): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto, estado,
                              motivo_sin_match, regla_sin_match, evaluado_at)
     VALUES ($1,$2,'2026-09-02','SPEI RECIBIDO','1160.00','abierto','Sin candidato',
             'sin_candidato_monto', now())
     RETURNING id`,
    [empresa, linea++],
  );
  return id;
}

describe('POST /conciliaciones/:id/confirmar (RS-C1..C3)', () => {
  it('confirma, cierra al CFDI y al movimiento y limpia el motivo de sin match', async () => {
    const cfdiId = await factura(A);
    const movimientoId = await movimientoConMotivo(A);
    const id = await conciliacion(A, cfdiId, movimientoId);

    const res = await confirmar(id).expect(200);

    expect(res.body).toMatchObject({
      id,
      estado: 'confirmada',
      cfdiId,
      movimientoId,
      motivo: 'Motivo de propuesta',
      rechazadasAutomaticamente: [],
    });
    expect(typeof (res.body as ResolucionRespuestaDto).confirmadaAt).toBe(
      'string',
    );
    const fila = await una<{
      estado: string;
      porId: string;
      at: Date | null;
    }>(
      ds,
      `SELECT estado, confirmada_por_id AS "porId", confirmada_at AS at
         FROM conciliaciones WHERE id = $1`,
      [id],
    );
    expect(fila.estado).toBe('confirmada');
    expect(fila.porId).toBe(entorno.persona(ANA));
    expect(fila.at).toBeInstanceOf(Date);
    expect(await estadoDe('cfdi', cfdiId)).toBe('conciliada');
    expect(await estadoDe('movimientos', movimientoId)).toBe('conciliado');
    expect(
      await una(
        ds,
        `SELECT motivo_sin_match, regla_sin_match, evaluado_at FROM movimientos WHERE id = $1`,
        [movimientoId],
      ),
    ).toEqual({
      motivo_sin_match: null,
      regla_sin_match: null,
      evaluado_at: null,
    });
  });

  it('una diferencia de monto distinta de cero se confirma y queda en la bitácora', async () => {
    const { id } = await propuesta(A, '0.5000');

    await confirmar(id).expect(200);

    const [fila] = await bitacoraDe(id);
    expect(fila.datos.diferenciaMonto).toBe('0.5000');
  });

  it.each([
    ['contador', LUIS, FERRETERIA],
    ['revisor', JORGE, TRANSPORTES],
  ] as const)('un %s puede confirmar', async (_rol, persona, rfc) => {
    const empresa = entorno.empresa(rfc);
    const id = await conciliacion(
      empresa,
      await factura(empresa),
      await movimiento(empresa),
    );

    await confirmar(id, await entorno.token(persona, rfc)).expect(200);

    expect((await conciliacionEn(id)).estado).toBe('confirmada');
  });

  it('sin sesión da 401 y un id que no es uuid da 400', async () => {
    const { id } = await propuesta();
    await request(entorno.app.getHttpServer())
      .post(`/conciliaciones/${id}/confirmar`)
      .expect(401);
    await confirmar('no-es-uuid').expect(400);
  });
});

describe('RS-X2, RS-X3, RS-X4 al confirmar', () => {
  it('una conciliación de otra empresa y un uuid inexistente dan el mismo 404', async () => {
    const ajena = await propuesta(B);

    const deOtra = await confirmar(ajena.id).expect(404);
    const inexistente = await confirmar(randomUUID()).expect(404);

    expect(deOtra.body).toEqual(inexistente.body);
    expect((await conciliacionEn(ajena.id)).estado).toBe('propuesta');
    expect(await estadoDe('cfdi', ajena.cfdiId)).toBe('abierta');
    expect(await bitacoraDe(ajena.id)).toHaveLength(0);
  });

  it.each(['confirmada', 'rechazada'] as const)(
    'una conciliación %s da 409 y no escribe',
    async (estado) => {
      const cfdiId = await factura(A);
      const movimientoId = await movimiento(A);
      const id = await conciliacion(A, cfdiId, movimientoId, estado);

      await confirmar(id).expect(409);

      expect((await conciliacionEn(id)).estado).toBe(estado);
      expect(await estadoDe('cfdi', cfdiId)).toBe('abierta');
      expect(await bitacoraDe(id)).toHaveLength(0);
    },
  );

  it('confirmar dos veces da 409 la segunda', async () => {
    const { id } = await propuesta();
    await confirmar(id).expect(200);

    await confirmar(id).expect(409);

    expect(await bitacoraDe(id)).toHaveLength(1);
  });

  it('un CFDI que ya no está abierto da 409 y no escribe', async () => {
    const cfdiId = await factura(A, { estado: 'conciliada' });
    const movimientoId = await movimiento(A);
    const id = await conciliacion(A, cfdiId, movimientoId);

    await confirmar(id).expect(409);

    expect((await conciliacionEn(id)).estado).toBe('propuesta');
    expect(await estadoDe('movimientos', movimientoId)).toBe('abierto');
    expect(await bitacoraDe(id)).toHaveLength(0);
  });

  it('un movimiento que ya no está abierto da 409 y no escribe', async () => {
    const cfdiId = await factura(A);
    const movimientoId = await movimiento(A, { estado: 'conciliado' });
    const id = await conciliacion(A, cfdiId, movimientoId);

    await confirmar(id).expect(409);

    expect((await conciliacionEn(id)).estado).toBe('propuesta');
    expect(await estadoDe('cfdi', cfdiId)).toBe('abierta');
    expect(await bitacoraDe(id)).toHaveLength(0);
  });
});

describe('RS-X5: violación de unicidad al confirmar', () => {
  it('se traduce a 409 y revierte todo', async () => {
    // Otra confirmada sobre el mismo movimiento que el CFDI/movimiento del
    // par no reflejan: solo el índice único puede detectarla.
    const cfdiId = await factura(A);
    const movimientoId = await movimiento(A);
    const id = await conciliacion(A, cfdiId, movimientoId);
    await conciliacion(A, await factura(A), movimientoId, 'confirmada');

    await confirmar(id).expect(409);

    expect((await conciliacionEn(id)).estado).toBe('propuesta');
    expect(await estadoDe('cfdi', cfdiId)).toBe('abierta');
    expect(await bitacoraDe(id)).toHaveLength(0);
  });
});

describe('RS-X6: bitácora al confirmar', () => {
  it('escribe una fila confirmar con antes, después, CFDI, movimiento y diferencia', async () => {
    const { id, cfdiId, movimientoId } = await propuesta(A, '0.5000');

    await confirmar(id).expect(200);

    const [fila, ...resto] = await bitacoraDe(id);
    expect(resto).toHaveLength(0);
    expect(fila).toMatchObject({
      accion: 'confirmar',
      entidad: 'conciliaciones',
      userId: entorno.persona(ANA),
    });
    expect(fila.datos).toMatchObject({
      antes: { estado: 'propuesta' },
      despues: { estado: 'confirmada', confirmadaPorId: entorno.persona(ANA) },
      cfdi: { id: cfdiId, antes: 'abierta', despues: 'conciliada' },
      movimiento: { id: movimientoId, antes: 'abierto', despues: 'conciliado' },
      diferenciaMonto: '0.5000',
      regla: 'monto_unico',
      score: '0.9000',
    });
    expect(
      typeof (fila.datos.despues as { confirmadaAt: unknown }).confirmadaAt,
    ).toBe('string');
  });
});

describe('RS-S1..S3: hermanas al confirmar', () => {
  it('rechaza las propuestas del mismo movimiento o del mismo CFDI y deja las ajenas', async () => {
    const [c1, c2, c3] = [await factura(A), await factura(A), await factura(A)];
    const [m1, m2, m3] = [
      await movimiento(A),
      await movimiento(A),
      await movimiento(A),
    ];
    const p1 = await conciliacion(A, c1, m1);
    const p2 = await conciliacion(A, c2, m1);
    const p3 = await conciliacion(A, c1, m2);
    const p4 = await conciliacion(A, c3, m3);
    const vieja = await conciliacion(A, c2, m2, 'rechazada');

    const res = await confirmar(p1).expect(200);

    expect(
      [
        ...(res.body as ResolucionRespuestaDto).rechazadasAutomaticamente,
      ].sort(),
    ).toEqual([p2, p3].sort());
    for (const hermana of [p2, p3]) {
      expect(await conciliacionEn(hermana)).toEqual({
        estado: 'rechazada',
        motivo: 'cerrada al confirmar otra conciliación',
      });
      const [fila, ...resto] = await bitacoraDe(hermana);
      expect(resto).toHaveLength(0);
      expect(fila.accion).toBe('rechazar');
      expect(fila.userId).toBe(entorno.persona(ANA));
      expect(fila.datos).toMatchObject({
        antes: { estado: 'propuesta' },
        despues: {
          estado: 'rechazada',
          motivo: 'cerrada al confirmar otra conciliación',
        },
        causa: { conciliacionId: p1 },
      });
    }
    expect((await conciliacionEn(p4)).estado).toBe('propuesta');
    expect((await conciliacionEn(vieja)).motivo).toBe('Motivo de propuesta');
    expect(await bitacoraDe(p4)).toHaveLength(0);
    expect(await bitacoraDe(vieja)).toHaveLength(0);
    expect(await estadoDe('cfdi', c2)).toBe('abierta');
    expect(await estadoDe('movimientos', m2)).toBe('abierto');
  });
});

describe('RS-D1..D4: segregación de funciones (D-08)', () => {
  const ana = () => entorno.persona(ANA);
  const luis = () => entorno.persona(LUIS);

  const conCargas = async (
    cfdiPor: string | null,
    movimientoPor: string | null,
  ) => {
    const cfdiId = await factura(A, {
      cargaId: cfdiPor ? await carga(A, cfdiPor, 'cfdi') : null,
    });
    const movimientoId = await movimiento(A, {
      cargaId: movimientoPor
        ? await carga(A, movimientoPor, 'estado_cuenta')
        : null,
    });
    return {
      cfdiId,
      movimientoId,
      id: await conciliacion(A, cfdiId, movimientoId),
    };
  };

  const deniegos = () =>
    filas<{ datos: Record<string, any>; userId: string; entidadId: string }>(
      ds,
      `SELECT datos, user_id AS "userId", entidad_id AS "entidadId"
         FROM bitacora WHERE accion = 'acceso_denegado'`,
    );

  it.each([
    ['el CFDI', () => [ana(), luis()]],
    ['el estado de cuenta', () => [luis(), ana()]],
    ['ambos', () => [ana(), ana()]],
  ] as const)(
    'quien subió %s recibe 403, sin escrituras y con acceso_denegado',
    async (_lado, subieron) => {
      const [porCfdi, porMovimiento] = subieron();
      const { id, cfdiId, movimientoId } = await conCargas(
        porCfdi,
        porMovimiento,
      );

      await confirmar(id).expect(403);

      expect((await conciliacionEn(id)).estado).toBe('propuesta');
      expect(await estadoDe('cfdi', cfdiId)).toBe('abierta');
      expect(await estadoDe('movimientos', movimientoId)).toBe('abierto');
      expect(await bitacoraDe(id)).toHaveLength(0);
      const [fila, ...resto] = await deniegos();
      expect(resto).toHaveLength(0);
      expect(fila.userId).toBe(ana());
      expect(fila.entidadId).toBe(A);
      expect(fila.datos).toMatchObject({
        metodo: 'POST',
        ruta: `/conciliaciones/${id}/confirmar`,
        motivo: 'rol_insuficiente',
        rolesDelUsuario: ['admin'],
      });
    },
  );

  it.each([
    ['sin cargas en ninguno', () => [null, null]],
    ['sin carga del CFDI', () => [null, luis()]],
    ['sin carga del movimiento', () => [luis(), null]],
    ['otra persona subió las cargas', () => [luis(), luis()]],
  ] as const)('%s: Ana confirma', async (_caso, subieron) => {
    const [porCfdi, porMovimiento] = subieron();
    const { id } = await conCargas(porCfdi, porMovimiento);

    await confirmar(id).expect(200);

    expect((await conciliacionEn(id)).estado).toBe('confirmada');
    expect(await deniegos()).toHaveLength(0);
  });

  it('el 409 va antes que el 403: una no propuesta de quien subió la carga da 409', async () => {
    const cfdiId = await factura(A, { cargaId: await carga(A, ana(), 'cfdi') });
    const movimientoId = await movimiento(A);
    const id = await conciliacion(A, cfdiId, movimientoId, 'rechazada');

    await confirmar(id).expect(409);

    expect(await deniegos()).toHaveLength(0);
  });

  it('rechazar sigue permitido a quien subió la carga', async () => {
    const { id } = await conCargas(ana(), ana());
    jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });

    await rechazar(id).expect(200);
  });
});

describe('RS-K1..K3: concurrencia al confirmar', () => {
  it('dos hermanas confirmadas a la vez: una da 200 y la otra 409', async () => {
    const c1 = await factura(A);
    const c2 = await factura(A);
    const m1 = await movimiento(A);
    const p1 = await conciliacion(A, c1, m1);
    const p2 = await conciliacion(A, c2, m1);

    const resultados = await Promise.all([confirmar(p1), confirmar(p2)]);

    expect(resultados.map((r) => r.status).sort()).toEqual([200, 409]);
    const estados = [
      (await conciliacionEn(p1)).estado,
      (await conciliacionEn(p2)).estado,
    ].sort();
    expect(estados).toEqual(['confirmada', 'rechazada']);
    expect(await estadoDe('movimientos', m1)).toBe('conciliado');
    const conciliadas = await filas(
      ds,
      `SELECT id FROM cfdi WHERE id = ANY($1) AND estado = 'conciliada'`,
      [[c1, c2]],
    );
    expect(conciliadas).toHaveLength(1);
  });

  it('confirmar y rechazar la misma propuesta a la vez: gana una', async () => {
    const { id } = await propuesta();
    jest
      .spyOn(entorno.app.get(ConciliacionService), 'conciliar')
      .mockResolvedValue({ propuestas: 0 });

    const resultados = await Promise.all([confirmar(id), rechazar(id)]);

    expect(resultados.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await bitacoraDe(id)).toHaveLength(1);
  });

  it('confirmar mientras corre conciliar deja un solo par vivo', async () => {
    const { id, cfdiId, movimientoId } = await propuesta();
    const otroCfdi = await factura(A, { total: '99.00' });
    await movimiento(A, { monto: '5000.00' });

    const [res] = await Promise.all([
      confirmar(id),
      entorno.app.get(ConciliacionService).conciliar(A),
    ]);

    expect(res.status).toBe(200);
    const vivas = await filas(
      ds,
      `SELECT id, estado FROM conciliaciones
        WHERE (cfdi_id = $1 OR movimiento_id = $2 OR cfdi_id = $3)
          AND estado IN ('propuesta', 'confirmada')`,
      [cfdiId, movimientoId, otroCfdi],
    );
    expect(vivas).toEqual([{ id, estado: 'confirmada' }]);
  });

  it('RS-C4: conciliar después no toca el par confirmado', async () => {
    const { id, cfdiId, movimientoId } = await propuesta();
    await confirmar(id).expect(200);
    const antes = await conciliacionEn(id);

    await entorno.app.get(ConciliacionService).conciliar(A);

    expect(await conciliacionEn(id)).toEqual(antes);
    expect(await estadoDe('cfdi', cfdiId)).toBe('conciliada');
    expect(await estadoDe('movimientos', movimientoId)).toBe('conciliado');
    const todas = await filas(
      ds,
      `SELECT id FROM conciliaciones WHERE cfdi_id = $1 OR movimiento_id = $2`,
      [cfdiId, movimientoId],
    );
    expect(todas).toHaveLength(1);
  });
});
