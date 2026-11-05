import { randomUUID } from 'crypto';
import type { DataSource } from 'typeorm';
import {
  ANA,
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { sembrarDecision } from '../conciliacion/siembra-decisiones';
import { filas, una } from '../database/testing/base-de-pruebas';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import { cancelarCfdi, MOTIVO_CFDI_CANCELADO } from './cancelar-cfdi';

/**
 * Historia 4.6 (AC1, AC3, AC4): la transición «cancelar» de un CFDI, una sola
 * sentencia atómica, contra Postgres real con RLS. Los datos se preparan con
 * la conexión del dueño; la transición corre como cuadra_app.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;
let persona: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  persona = entorno.persona(ANA);
}, 60_000);

afterAll(async () => {
  await entorno?.cerrar();
});

beforeEach(async () => {
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, decisiones, decision_lineas, bitacora CASCADE',
  );
});

async function movimiento(
  empresa: string,
  estado = 'abierto',
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto, estado)
     VALUES ($1,$2,'2026-09-02','SPEI RECIBIDO','1160.00',$3) RETURNING id`,
    [empresa, linea++, estado],
  );
  return id;
}

async function factura(empresa: string, estado = 'abierta'): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado,
                       metodo_pago, xml_raw)
     VALUES ($1,$2,'FDB190215QK4','XAXX010101000','A','1001','2026-09-01T10:00:00','I','MXN',
             '1160.00','1160.00',$3,'PUE','{"_xml":"<x/>"}'::jsonb)
     RETURNING id`,
    [empresa, randomUUID(), estado],
  );
  return id;
}

type EstadoSembrado = 'propuesta' | 'confirmada' | 'rechazada' | 'obsoleta';

const decision = (
  empresa: string,
  cfdiIds: string[],
  movimientoId: string,
  estado: EstadoSembrado = 'propuesta',
) =>
  sembrarDecision(ds, {
    companyId: empresa,
    movimientoId,
    cfdiIds,
    estado,
    origen: 'regla',
    regla: 'monto_unico',
    score: '0.9000',
    diferenciaMonto: '0.0000',
    confirmadaPorId: estado === 'confirmada' ? persona : null,
  });

const cancelar = (
  empresa: string,
  cfdiId: string,
  quien: string | null = persona,
) =>
  entorno.app
    .get(TransaccionEmpresa)
    .ejecutar(empresa, (manager) =>
      cancelarCfdi(manager, empresa, cfdiId, quien),
    );

const estadoDe = async (tabla: 'cfdi' | 'movimientos', id: string) =>
  (
    await una<{ estado: string }>(
      ds,
      `SELECT estado FROM ${tabla} WHERE id = $1`,
      [id],
    )
  ).estado;

const decisionEn = (id: string) =>
  una<{ estado: string; motivo: string | null; requiereRevision: boolean }>(
    ds,
    `SELECT estado, motivo, requiere_revision AS "requiereRevision"
       FROM decisiones WHERE id = $1`,
    [id],
  );

const lineasDe = (id: string) =>
  filas<{ cfdiId: string; estadoDecision: string }>(
    ds,
    `SELECT cfdi_id AS "cfdiId", estado_decision AS "estadoDecision"
       FROM decision_lineas WHERE decision_id = $1 ORDER BY cfdi_id`,
    [id],
  );

const bitacoraDe = (id: string) =>
  filas<{
    accion: string;
    entidad: string;
    userId: string | null;
    datos: Record<string, any>;
  }>(
    ds,
    `SELECT accion, entidad, user_id AS "userId", datos
       FROM bitacora WHERE entidad_id = $1`,
    [id],
  );

describe('cancelarCfdi (4.6)', () => {
  it.each(['abierta', 'parcialidades', 'conciliada'])(
    'un CFDI %s pasa a cancelada',
    async (estado) => {
      const cfdi = await factura(A, estado);

      const r = await cancelar(A, cfdi);

      expect(r).toMatchObject({ resultado: 'cancelada', antes: estado });
      expect(await estadoDe('cfdi', cfdi)).toBe('cancelada');
    },
  );

  it('su propuesta viva pasa a obsoleta con motivo, y la línea la sigue', async () => {
    const cfdi = await factura(A);
    const mov = await movimiento(A);
    const propuesta = await decision(A, [cfdi], mov);

    const r = await cancelar(A, cfdi);

    expect(r).toMatchObject({ decisionesObsoletas: [propuesta] });
    expect(await decisionEn(propuesta)).toEqual({
      estado: 'obsoleta',
      motivo: MOTIVO_CFDI_CANCELADO,
      requiereRevision: false,
    });
    expect(await lineasDe(propuesta)).toEqual([
      { cfdiId: cfdi, estadoDecision: 'obsoleta' },
    ]);
    expect(await estadoDe('movimientos', mov)).toBe('abierto');
  });

  it('una propuesta de grupo se vuelve obsoleta entera; la otra factura queda abierta', async () => {
    const [c1, c2] = [await factura(A), await factura(A)];
    const mov = await movimiento(A);
    const grupo = await decision(A, [c1, c2], mov);

    await cancelar(A, c1);

    expect((await decisionEn(grupo)).estado).toBe('obsoleta');
    expect((await lineasDe(grupo)).map((l) => l.estadoDecision)).toEqual([
      'obsoleta',
      'obsoleta',
    ]);
    expect(await estadoDe('cfdi', c2)).toBe('abierta');
  });

  it('una decisión confirmada queda confirmada con requiere_revision; el movimiento no se toca', async () => {
    const cfdi = await factura(A, 'conciliada');
    const mov = await movimiento(A, 'conciliado');
    const confirmada = await decision(A, [cfdi], mov, 'confirmada');

    const r = await cancelar(A, cfdi);

    expect(r).toMatchObject({
      decisionesPorRevisar: [confirmada],
      decisionesObsoletas: [],
    });
    expect(await decisionEn(confirmada)).toMatchObject({
      estado: 'confirmada',
      requiereRevision: true,
    });
    expect(await lineasDe(confirmada)).toEqual([
      { cfdiId: cfdi, estadoDecision: 'confirmada' },
    ]);
    expect(await estadoDe('movimientos', mov)).toBe('conciliado');
    expect(await estadoDe('cfdi', cfdi)).toBe('cancelada');
  });

  it('las decisiones rechazada y obsoleta no se tocan', async () => {
    const cfdi = await factura(A);
    const [m1, m2] = [await movimiento(A), await movimiento(A)];
    const rechazada = await decision(A, [cfdi], m1, 'rechazada');
    const obsoleta = await decision(A, [cfdi], m2, 'obsoleta');

    await cancelar(A, cfdi);

    expect(await decisionEn(rechazada)).toMatchObject({
      estado: 'rechazada',
      requiereRevision: false,
    });
    expect(await decisionEn(obsoleta)).toMatchObject({
      estado: 'obsoleta',
      motivo: null,
    });
  });

  it('escribe una sola entrada de bitácora: actualizar sobre cfdi, con antes, después y decisiones', async () => {
    const cfdi = await factura(A, 'conciliada');
    const mov = await movimiento(A, 'conciliado');
    const confirmada = await decision(A, [cfdi], mov, 'confirmada');
    const propuesta = await decision(A, [cfdi], await movimiento(A));

    await cancelar(A, cfdi);

    const entradas = await bitacoraDe(cfdi);
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toMatchObject({
      accion: 'actualizar',
      entidad: 'cfdi',
      userId: persona,
    });
    expect(entradas[0].datos).toEqual({
      antes: { estado: 'conciliada' },
      despues: { estado: 'cancelada' },
      decisionesObsoletas: [propuesta],
      decisionesPorRevisar: [confirmada],
    });
  });

  it('es idempotente: una ya cancelada no cambia nada ni escribe bitácora', async () => {
    const cfdi = await factura(A);
    await decision(A, [cfdi], await movimiento(A));
    await cancelar(A, cfdi);
    const antes = await una<{ n: number }>(
      ds,
      'SELECT count(*)::int AS n FROM bitacora',
    );

    const r = await cancelar(A, cfdi);

    expect(r).toMatchObject({
      resultado: 'ya_cancelada',
      decisionesObsoletas: [],
      decisionesPorRevisar: [],
    });
    expect(
      await una<{ n: number }>(ds, 'SELECT count(*)::int AS n FROM bitacora'),
    ).toEqual(antes);
  });

  it('un CFDI de otra empresa no existe: no cambia nada', async () => {
    const ajeno = await factura(B);
    const mov = await movimiento(B);
    const propuesta = await decision(B, [ajeno], mov);

    const r = await cancelar(A, ajeno);

    expect(r).toMatchObject({ resultado: 'no_existe' });
    expect(await estadoDe('cfdi', ajeno)).toBe('abierta');
    expect((await decisionEn(propuesta)).estado).toBe('propuesta');
    expect(await bitacoraDe(ajeno)).toEqual([]);
  });
});
