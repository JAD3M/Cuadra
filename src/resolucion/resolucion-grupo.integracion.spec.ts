import { randomUUID } from 'crypto';
import request from '../testing/supertest-con-origen';
import type { DataSource } from 'typeorm';
import {
  ANA,
  type AppDeCargas,
  CARMEN,
  FERRETERIA,
  levantarAppDeCargas,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { sembrarDecision } from '../conciliacion/siembra-decisiones';
import { filas, una } from '../database/testing/base-de-pruebas';
import type { ResolucionRespuestaDto } from './dto/resolucion.dto';

/**
 * Historia 4.5 (T3): una propuesta de grupo (un depósito, varias facturas) se
 * resuelve entera o no se resuelve (AD-4), y los lectores que asumían una
 * factura por propuesta la muestran una sola vez con todas sus líneas.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;
let tokenAna: string;
let tokenCarmen: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  tokenAna = await entorno.token(ANA, FERRETERIA);
  tokenCarmen = await entorno.token(CARMEN, TRANSPORTES);
}, 60_000);

afterAll(async () => {
  await entorno?.cerrar();
});

beforeEach(async () => {
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, decisiones, decision_lineas, bitacora CASCADE',
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function movimiento(
  empresa: string,
  o: { monto?: string; estado?: string } = {},
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto, estado,
                              regla_sin_match, motivo_sin_match)
     VALUES ($1,$2,'2026-09-02','SPEI RECIBIDO',$3,$4,
             'combinaciones_multiples','Motivo previo')
     RETURNING id`,
    [empresa, linea++, o.monto ?? '600.00', o.estado ?? 'abierto'],
  );
  return id;
}

async function factura(
  empresa: string,
  o: { total?: string; estado?: string } = {},
): Promise<string> {
  const total = o.total ?? '100.00';
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado,
                       metodo_pago, xml_raw)
     VALUES ($1,$2,$3,'XAXX010101000','A',$4,'2026-09-01T10:00:00','I','MXN',
             $5,$5,$6,'PUE','{"_xml":"<x/>"}'::jsonb)
     RETURNING id`,
    [
      empresa,
      randomUUID(),
      FERRETERIA,
      String(linea++),
      total,
      o.estado ?? 'abierta',
    ],
  );
  return id;
}

/** Un grupo de tres facturas (100 + 200 + 300) que suman el depósito de 600. */
async function grupo(empresa = A) {
  const movimientoId = await movimiento(empresa, { monto: '600.00' });
  const cfdiIds = [
    await factura(empresa, { total: '100.00' }),
    await factura(empresa, { total: '200.00' }),
    await factura(empresa, { total: '300.00' }),
  ];
  const id = await sembrarDecision(ds, {
    companyId: empresa,
    movimientoId,
    cfdiIds,
    estado: 'propuesta',
    origen: 'regla',
    regla: 'suma_grupo',
    score: '0.6000',
    diferenciaMonto: '0.0000',
    motivo: 'Suma de 3 facturas',
  });
  await ds.query(
    `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
     VALUES ($1, NULL, 'decisiones', $2, 'crear', $3::jsonb)`,
    [empresa, id, JSON.stringify({ cfdiIds: [...cfdiIds].sort() })],
  );
  return { id, movimientoId, cfdiIds, ordenados: [...cfdiIds].sort() };
}

const confirmar = (id: string, token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .post(`/conciliaciones/${id}/confirmar`)
    .set('Cookie', token)
    .send();

const rechazar = (id: string, token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .post(`/conciliaciones/${id}/rechazar`)
    .set('Cookie', token)
    .send({});

const leer = (ruta: string, token = tokenAna) =>
  request(entorno.app.getHttpServer()).get(ruta).set('Cookie', token);

interface CfdiApi {
  id: string;
  total: string;
}
interface PropuestaApi {
  conciliacionId: string;
  estado: string;
  regla: string;
  score: string;
  confianza: string | null;
  diferenciaMonto: string;
  cfdi: CfdiApi;
  cfdis: CfdiApi[];
}
interface CasoApi {
  estado: string;
  propuestas: PropuestaApi[];
}
interface BandejaApi {
  total: number;
  datos: {
    movimientoId: string;
    estado: string;
    propuestasCount: number;
    regla: string;
    mejorPropuesta: { conciliacionId: string; cfdi: CfdiApi; cfdis: CfdiApi[] };
  }[];
}
interface ResumenApi {
  conteos: Record<string, number>;
}
interface EventosApi {
  total: number;
  datos: { accion: string }[];
}

const obtener = async <T>(ruta: string, token = tokenAna): Promise<T> =>
  (await leer(ruta, token).expect(200)).body as T;

const decision = (id: string) =>
  una<{
    estado: string;
    loteId: string | null;
    por: string | null;
    motivo: string | null;
  }>(
    ds,
    `SELECT estado, lote_id AS "loteId", confirmada_por_id AS por, motivo
       FROM decisiones WHERE id = $1`,
    [id],
  );

const lineasDe = async (id: string) =>
  (
    await filas<{ estado: string }>(
      ds,
      'SELECT estado_decision AS estado FROM decision_lineas WHERE decision_id = $1',
      [id],
    )
  ).map((l) => l.estado);

const estadoDe = async (tabla: 'cfdi' | 'movimientos', id: string) =>
  (
    await una<{ estado: string }>(
      ds,
      `SELECT estado FROM ${tabla} WHERE id = $1`,
      [id],
    )
  ).estado;

const bitacoraDe = (id: string) =>
  filas<{ accion: string; datos: Record<string, unknown> }>(
    ds,
    'SELECT accion, datos FROM bitacora WHERE entidad_id = $1 ORDER BY created_at, id',
    [id],
  );

const totalBitacora = async () =>
  (await una<{ n: number }>(ds, 'SELECT count(*)::int AS n FROM bitacora')).n;

describe('4.5 (a): confirmar un grupo de 3 facturas', () => {
  it('confirma las 3 líneas, marca los 3 CFDI, concilia el movimiento y audita una vez', async () => {
    const g = await grupo();
    const hermanaCfdi = await sembrarDecision(ds, {
      companyId: A,
      movimientoId: await movimiento(A, { monto: '200.00' }),
      cfdiId: g.ordenados[1],
      estado: 'propuesta',
      origen: 'regla',
      regla: 'monto_unico',
      score: '0.9000',
    });
    const hermanaMov = await sembrarDecision(ds, {
      companyId: A,
      movimientoId: g.movimientoId,
      cfdiId: await factura(A, { total: '600.00' }),
      estado: 'propuesta',
      origen: 'regla',
      regla: 'monto_unico',
      score: '0.9000',
    });

    const res = await confirmar(g.id).expect(200);

    const cuerpo = res.body as ResolucionRespuestaDto;
    expect(cuerpo.estado).toBe('confirmada');
    expect(cuerpo.cfdiIds).toEqual(g.ordenados);
    expect(cuerpo.cfdiId).toBe(g.ordenados[0]);
    expect(cuerpo.rechazadasAutomaticamente.sort()).toEqual(
      [hermanaCfdi, hermanaMov].sort(),
    );

    expect(await lineasDe(g.id)).toEqual([
      'confirmada',
      'confirmada',
      'confirmada',
    ]);
    for (const c of g.cfdiIds)
      expect(await estadoDe('cfdi', c)).toBe('conciliada');
    expect(await estadoDe('movimientos', g.movimientoId)).toBe('conciliado');
    expect((await decision(g.id)).por).toBe(entorno.persona(ANA));
    expect((await decision(hermanaCfdi)).estado).toBe('obsoleta');
    expect((await decision(hermanaMov)).estado).toBe('obsoleta');

    const confirmaciones = (await bitacoraDe(g.id)).filter(
      (e) => e.accion === 'confirmar',
    );
    expect(confirmaciones).toHaveLength(1);
    expect(confirmaciones[0].datos.cfdiIds).toEqual(g.ordenados);
    expect(confirmaciones[0].datos.cfdi).toMatchObject({
      id: g.ordenados[0],
      antes: 'abierta',
      despues: 'conciliada',
    });
    const [obsoleta] = await bitacoraDe(hermanaCfdi);
    expect(obsoleta.datos.cfdiIds).toEqual([g.ordenados[1]]);
    expect(obsoleta.datos.cfdiId).toBe(g.ordenados[1]);
  });
});

describe('4.5 (b): todo o nada al confirmar', () => {
  it('una factura del grupo ya conciliada da 409 y no cambia nada', async () => {
    const g = await grupo();
    await ds.query(`UPDATE cfdi SET estado = 'conciliada' WHERE id = $1`, [
      g.ordenados[2],
    ]);
    const antes = await totalBitacora();

    await confirmar(g.id).expect(409);

    expect((await decision(g.id)).estado).toBe('propuesta');
    expect(await lineasDe(g.id)).toEqual([
      'propuesta',
      'propuesta',
      'propuesta',
    ]);
    expect(await estadoDe('cfdi', g.ordenados[0])).toBe('abierta');
    expect(await estadoDe('cfdi', g.ordenados[1])).toBe('abierta');
    expect(await estadoDe('movimientos', g.movimientoId)).toBe('abierto');
    expect(await totalBitacora()).toBe(antes);
  });

  it('una factura que desapareció da 409 y no cambia nada', async () => {
    const g = await grupo();
    await ds.query(`UPDATE cfdi SET estado = 'cancelada' WHERE id = $1`, [
      g.ordenados[0],
    ]);
    const antes = await totalBitacora();

    await confirmar(g.id).expect(409);

    expect(await lineasDe(g.id)).toEqual([
      'propuesta',
      'propuesta',
      'propuesta',
    ]);
    expect(await estadoDe('cfdi', g.ordenados[1])).toBe('abierta');
    expect(await totalBitacora()).toBe(antes);
  });
});

describe('4.5 (d): una factura confirmada en otra decisión no se confirma de nuevo', () => {
  it('el índice único de líneas vigentes se traduce a 409, nunca 500, y revierte todo', async () => {
    const g = await grupo();
    // La factura sigue 'abierta' a propósito: solo el índice único puede
    // detectar que otra decisión confirmada ya la tiene.
    await sembrarDecision(ds, {
      companyId: A,
      movimientoId: await movimiento(A, { monto: '300.00' }),
      cfdiId: g.ordenados[2],
      estado: 'confirmada',
      origen: 'manual',
      confirmadaPorId: entorno.persona(ANA),
    });
    const antes = await totalBitacora();

    await confirmar(g.id).expect(409);

    expect((await decision(g.id)).estado).toBe('propuesta');
    expect(await lineasDe(g.id)).toEqual([
      'propuesta',
      'propuesta',
      'propuesta',
    ]);
    expect(await estadoDe('cfdi', g.ordenados[0])).toBe('abierta');
    expect(await estadoDe('movimientos', g.movimientoId)).toBe('abierto');
    expect(await totalBitacora()).toBe(antes);
  });
});

describe('4.5 (c): rechazar un grupo', () => {
  it('rechaza la decisión y sus líneas, audita todas las facturas y no se vuelve a proponer', async () => {
    const m = await movimiento(A, { monto: '600.00' });
    const ids = [
      await factura(A, { total: '100.00' }),
      await factura(A, { total: '200.00' }),
      await factura(A, { total: '300.00' }),
    ];
    const servicio = entorno.app.get(ConciliacionService);
    expect(await servicio.conciliar(A)).toEqual({ propuestas: 1 });
    const { id } = await una<{ id: string }>(
      ds,
      `SELECT id FROM decisiones WHERE movimiento_id = $1`,
      [m],
    );
    expect(await lineasDe(id)).toHaveLength(3);

    const res = await rechazar(id).expect(200);

    const cuerpo = res.body as ResolucionRespuestaDto;
    expect(cuerpo.cfdiIds).toEqual([...ids].sort());
    expect(cuerpo.cfdiId).toBe([...ids].sort()[0]);
    expect((await decision(id)).estado).toBe('rechazada');
    expect(await lineasDe(id)).toEqual(['rechazada', 'rechazada', 'rechazada']);
    for (const c of ids) expect(await estadoDe('cfdi', c)).toBe('abierta');
    const rechazo = (await bitacoraDe(id)).find((e) => e.accion === 'rechazar');
    expect(rechazo?.datos.cfdiIds).toEqual([...ids].sort());
    expect(rechazo?.datos.cfdiId).toBe([...ids].sort()[0]);

    expect(await servicio.conciliar(A)).toEqual({ propuestas: 0 });
    expect(
      await una<{ n: number }>(
        ds,
        `SELECT count(*)::int AS n FROM decisiones WHERE movimiento_id = $1`,
        [m],
      ),
    ).toEqual({ n: 1 });
  });
});

describe('4.5 (e): lectura de un grupo', () => {
  it('el detalle del caso muestra la propuesta de grupo una vez, con sus líneas', async () => {
    const g = await grupo();
    await sembrarDecision(ds, {
      companyId: A,
      movimientoId: g.movimientoId,
      cfdiId: await factura(A, { total: '599.80' }),
      estado: 'propuesta',
      origen: 'regla',
      regla: 'monto_tolerancia',
      score: '0.9000',
      diferenciaMonto: '0.2000',
    });

    const caso = await obtener<CasoApi>(`/casos/${g.movimientoId}`);

    const propuestas = caso.propuestas;
    expect(propuestas).toHaveLength(2);
    expect(propuestas[0].cfdis).toHaveLength(1);
    const delGrupo = propuestas[1];
    expect(delGrupo).toMatchObject({
      conciliacionId: g.id,
      estado: 'propuesta',
      regla: 'suma_grupo',
      score: '0.6000',
      confianza: 'media',
      diferenciaMonto: '0.0000',
    });
    expect(delGrupo.cfdis.map((c) => c.id)).toEqual(g.ordenados);
    expect(delGrupo.cfdis.map((c) => c.total).sort()).toEqual([
      '100.0000',
      '200.0000',
      '300.0000',
    ]);
    expect(delGrupo.cfdi.id).toBe(g.ordenados[0]);
  });

  it('el detalle de un grupo confirmado conserva sus líneas', async () => {
    const g = await grupo();
    await confirmar(g.id).expect(200);

    const caso = await obtener<CasoApi>(`/casos/${g.movimientoId}`);

    expect(caso.estado).toBe('conciliado');
    expect(caso.propuestas).toHaveLength(1);
    expect(caso.propuestas[0].cfdis.map((c) => c.id)).toEqual(g.ordenados);
  });

  it('la bandeja cuenta el grupo como un solo caso y como una sola propuesta', async () => {
    const g = await grupo();

    const lista = await obtener<BandejaApi>('/bandeja');
    expect(lista.total).toBe(1);
    expect(lista.datos).toHaveLength(1);
    expect(lista.datos[0]).toMatchObject({
      movimientoId: g.movimientoId,
      estado: 'sugerencia',
      propuestasCount: 1,
      regla: 'suma_grupo',
    });
    expect(lista.datos[0].mejorPropuesta.conciliacionId).toBe(g.id);
    expect(lista.datos[0].mejorPropuesta.cfdis.map((c) => c.id)).toEqual(
      g.ordenados,
    );
    expect(lista.datos[0].mejorPropuesta.cfdi.id).toBe(g.ordenados[0]);

    const resumen = await obtener<ResumenApi>('/bandeja/resumen');
    expect(resumen.conteos).toEqual({
      conciliado: 0,
      sugerencia: 1,
      sin_match: 0,
    });
  });
});

describe('4.5 (f): historial', () => {
  it('el historial de cualquier factura del grupo muestra sus eventos', async () => {
    const g = await grupo();
    await confirmar(g.id).expect(200);

    for (const c of g.cfdiIds) {
      const eventos = await obtener<EventosApi>(
        `/bitacora?entidad=cfdi&entidadId=${c}`,
      );
      const acciones = eventos.datos.map((e) => e.accion);
      expect(acciones.sort()).toEqual(['confirmar', 'crear']);
    }
    const propio = await obtener<EventosApi>(
      `/conciliaciones/${g.id}/historial`,
    );
    expect(propio.datos.map((e) => e.accion)).toEqual(['crear', 'confirmar']);
  });
});

describe('4.5 (g): aislamiento entre empresas', () => {
  it('otra empresa no ve el grupo ni lo resuelve', async () => {
    const g = await grupo();
    await movimiento(B);

    await leer(`/casos/${g.movimientoId}`, tokenCarmen).expect(404);
    const lista = await obtener<BandejaApi>('/bandeja', tokenCarmen);
    expect(lista.datos.some((f) => f.movimientoId === g.movimientoId)).toBe(
      false,
    );
    const hist = await obtener<EventosApi>(
      `/bitacora?entidad=cfdi&entidadId=${g.ordenados[0]}`,
      tokenCarmen,
    );
    expect(hist.total).toBe(0);
    await confirmar(g.id, tokenCarmen).expect(404);
    await rechazar(g.id, tokenCarmen).expect(404);
    expect((await decision(g.id)).estado).toBe('propuesta');
  });
});

describe('4.5: un grupo nunca va a lote ni se cierra solo', () => {
  // No existe función de lote en src (solo la columna `lote_id`): se prueba
  // sobre la fila persistida, el endpoint y el CHECK de la base.
  it('la propuesta persiste sin lote y sin quien confirme; sin sesión no se confirma', async () => {
    const g = await grupo();

    expect(await decision(g.id)).toMatchObject({ loteId: null, por: null });
    await request(entorno.app.getHttpServer())
      .post(`/conciliaciones/${g.id}/confirmar`)
      .send()
      .expect(401);
    expect((await decision(g.id)).estado).toBe('propuesta');
  });

  it('conciliar() no confirma ni cierra un grupo', async () => {
    const g = await grupo();
    await entorno.app.get(ConciliacionService).conciliar(A);
    expect((await decision(g.id)).estado).toBe('propuesta');
    expect(await estadoDe('movimientos', g.movimientoId)).toBe('abierto');
  });

  it('la base rechaza una confirmada sin persona ni fecha', async () => {
    const g = await grupo();
    await expect(
      ds.query(`UPDATE decisiones SET estado = 'confirmada' WHERE id = $1`, [
        g.id,
      ]),
    ).rejects.toThrow();
    expect((await decision(g.id)).estado).toBe('propuesta');
  });

  it('confirmar deja lote_id nulo', async () => {
    const g = await grupo();
    await confirmar(g.id).expect(200);
    expect((await decision(g.id)).loteId).toBeNull();
  });
});
