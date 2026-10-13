import { randomUUID } from 'crypto';
import request from '../testing/supertest-con-origen';
import type { DataSource } from 'typeorm';
import {
  ANA,
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { ConciliacionService } from '../conciliacion/conciliacion.service';
import { ProveedorTolerancia } from '../conciliacion/tolerancia';
import { filas, una } from '../database/testing/base-de-pruebas';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import { PersistenciaSugerencias } from './persistencia-sugerencias';
import { ProveedorFalso } from './proveedor-falso';
import {
  ErrorProveedorSugerencia,
  ProveedorDesactivado,
  type ProveedorSugerencia,
} from './proveedor-sugerencia';
import {
  type OpcionesSugerencias,
  OPCIONES_POR_OMISION,
  SugerenciasService,
} from './sugerencias.service';

/**
 * CU-17 de punta a punta contra Postgres real con RLS, sin red: el servicio se
 * arma a mano alrededor de un `ProveedorFalso`. La ambigüedad sale del motor
 * real (`conciliar`), no de filas inventadas.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let conciliacion: ConciliacionService;
let persistencia: PersistenciaSugerencias;
let A: string;
let B: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  conciliacion = entorno.app.get(ConciliacionService);
  persistencia = new PersistenciaSugerencias(
    entorno.app.get(TransaccionEmpresa),
  );
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
}, 60_000);

afterAll(async () => {
  await entorno?.cerrar();
});

beforeEach(async () => {
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, conciliaciones, bitacora, sugerencias_ia CASCADE',
  );
});

afterEach(async () => {
  jest.restoreAllMocks();
  await ds.query(`UPDATE companies SET tolerancia_monto = 0`);
});

function servicio(
  proveedor: ProveedorSugerencia,
  opciones: Partial<OpcionesSugerencias> = {},
): SugerenciasService {
  return new SugerenciasService(
    entorno.app.get(TransaccionEmpresa),
    entorno.app.get(ProveedorTolerancia),
    proveedor,
    persistencia,
    { ...OPCIONES_POR_OMISION, ...opciones },
  );
}

const sugiere = (
  candidato = 'C1',
  confianza = 'alta',
  explicacion = 'El receptor coincide con la descripción',
) => ({ decision: 'sugerir', candidato, confianza, explicacion });

async function movimiento(
  empresa: string,
  o: {
    monto?: string;
    fecha?: string;
    referencia?: string | null;
    descripcion?: string;
    estado?: string;
    regla?: string | null;
  } = {},
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto,
                              estado, regla_sin_match, motivo_sin_match)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text, CASE WHEN $8::text IS NULL THEN NULL ELSE 'motivo de prueba' END)
     RETURNING id`,
    [
      empresa,
      linea++,
      o.fecha ?? '2026-09-10',
      o.descripcion ?? 'SPEI RECIBIDO CLIENTE',
      o.referencia ?? null,
      o.monto ?? '1160.00',
      o.estado ?? 'abierto',
      o.regla ?? null,
    ],
  );
  return id;
}

async function factura(
  empresa: string,
  o: {
    folio: string;
    serie?: string | null;
    total?: string;
    fecha?: string;
    receptor?: string;
    estado?: string;
    moneda?: string;
  },
): Promise<string> {
  const { id } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor, nombre_receptor, serie,
                       folio, fecha_emision, tipo_comprobante, moneda, subtotal, total, estado, xml_raw)
     VALUES ($1,$2,$3,'XAXX010101000',$4,$5,$6,$7,'I',$8,$9,$9,$10,'{"_xml":"<x/>"}'::jsonb)
     RETURNING id`,
    [
      empresa,
      randomUUID(),
      empresa === B ? TRANSPORTES : FERRETERIA,
      o.receptor ?? 'CLIENTE SA DE CV',
      o.serie === undefined ? 'A' : o.serie,
      o.folio,
      o.fecha ?? '2026-09-01T10:00:00',
      o.moneda ?? 'MXN',
      o.total ?? '1160.00',
      o.estado ?? 'abierta',
    ],
  );
  return id;
}

/**
 * Un movimiento con varios CFDI del mismo total: el motor real lo deja sin
 * propuesta con `monto_multiples_candidatos`. Devuelve los CFDI en el orden de
 * sus folios, que es el de las etiquetas C1..CN.
 */
async function ambiguo(
  empresa = A,
  o: { monto?: string; folios?: string[]; descripcion?: string } = {},
) {
  const monto = o.monto ?? '1160.00';
  const m = await movimiento(empresa, {
    monto,
    descripcion: o.descripcion,
  });
  const cfdis: string[] = [];
  for (const folio of o.folios ?? ['1001', '1002']) {
    cfdis.push(await factura(empresa, { folio, total: monto }));
  }
  await conciliacion.conciliar(empresa);
  const { regla } = await una<{ regla: string }>(
    ds,
    'SELECT regla_sin_match AS regla FROM movimientos WHERE id = $1',
    [m],
  );
  expect(regla).toBe('monto_multiples_candidatos');
  return { m, cfdis };
}

interface FilaLlm {
  id: string;
  company_id: string;
  cfdi_id: string;
  movimiento_id: string;
  estado: string;
  origen: string;
  regla: string;
  score: string | null;
  diferencia_monto: string;
  motivo: string;
}

const conciliacionesLlm = (empresa?: string) =>
  filas<FilaLlm>(
    ds,
    `SELECT id, company_id, cfdi_id, movimiento_id, estado, origen, regla,
            score::text AS score, diferencia_monto::text AS diferencia_monto, motivo
       FROM conciliaciones
      WHERE origen = 'llm' AND ($1::uuid IS NULL OR company_id = $1)
      ORDER BY created_at, id`,
    [empresa ?? null],
  );

const libro = (empresa?: string) =>
  filas<{ movimiento_id: string; input_hash: string; resultado: string }>(
    ds,
    `SELECT movimiento_id, input_hash, resultado FROM sugerencias_ia
      WHERE $1::uuid IS NULL OR company_id = $1 ORDER BY created_at, id`,
    [empresa ?? null],
  );

const bitacoraDe = (accion: string) =>
  filas<{
    user_id: string | null;
    entidad_id: string;
    datos: Record<string, unknown>;
  }>(
    ds,
    `SELECT user_id, entidad_id, datos FROM bitacora WHERE accion = $1 ORDER BY created_at, id`,
    [accion],
  );

const movimientoFila = (id: string) =>
  una<{
    estado: string;
    regla: string | null;
    motivo: string | null;
    evaluado_at: Date | null;
  }>(
    ds,
    `SELECT estado, regla_sin_match AS regla, motivo_sin_match AS motivo, evaluado_at
       FROM movimientos WHERE id = $1`,
    [id],
  );

describe('propuesta del modelo (IA-12 a IA-16)', () => {
  it('crea una propuesta origen llm, la audita y limpia el motivo', async () => {
    const { m, cfdis } = await ambiguo();
    const proveedor = new ProveedorFalso(
      sugiere('C1', 'alta', 'Coincide el receptor'),
    );

    const resumen = await servicio(proveedor).sugerirParaEmpresa(A);

    expect(resumen).toMatchObject({
      elegibles: 1,
      llamadas: 1,
      propuestas: 1,
      obsoletas: 0,
      interrumpida: false,
    });
    const [fila] = await conciliacionesLlm();
    expect(fila).toMatchObject({
      company_id: A,
      cfdi_id: cfdis[0],
      movimiento_id: m,
      estado: 'propuesta',
      origen: 'llm',
      regla: 'llm_sugerencia',
      score: null,
      diferencia_monto: '0.0000',
      motivo: 'Sugerencia de IA: Coincide el receptor',
    });

    const [crear] = await bitacoraDe('crear').then((f) =>
      f.filter((x) => x.entidad_id === fila.id),
    );
    const [{ input_hash: hash }] = await libro();
    expect(crear.user_id).toBeNull();
    expect(crear.datos).toMatchObject({
      despues: { estado: 'propuesta' },
      origen: 'llm',
      regla: 'llm_sugerencia',
      modelo: 'modelo-falso',
      inputHash: hash,
      confianza: 'alta',
      diferenciaMonto: '0.0000',
      cfdiId: cfdis[0],
      movimientoId: m,
    });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    // ck_movimientos_sin_match_par: los tres se limpian juntos.
    expect(await movimientoFila(m)).toEqual({
      estado: 'abierto',
      regla: null,
      motivo: null,
      evaluado_at: null,
    });
    expect(await libro()).toEqual([
      { movimiento_id: m, input_hash: hash, resultado: 'propuesta' },
    ]);
  });

  it('la diferencia de monto sale de NUMERIC/decimal.js, con signo y 4 decimales', async () => {
    await ds.query(`UPDATE companies SET tolerancia_monto = 5`);
    const m = await movimiento(A, { monto: '1158.10' });
    await factura(A, { folio: '1001', total: '1160.25' });
    await factura(A, { folio: '1002', total: '1160.25' });
    await conciliacion.conciliar(A);

    await servicio(new ProveedorFalso(sugiere())).sugerirParaEmpresa(A);

    const [fila] = await conciliacionesLlm();
    expect(fila.movimiento_id).toBe(m);
    expect(fila.diferencia_monto).toBe('-2.1500');
  });

  it('lo que recibe el proveedor trae los dos candidatos con etiquetas opacas y sin ids ni RFC', async () => {
    const { m, cfdis } = await ambiguo(A, { descripcion: 'PAGO FACTURA' });
    const proveedor = new ProveedorFalso();

    await servicio(proveedor).sugerirParaEmpresa(A);

    expect(proveedor.recibidas).toHaveLength(1);
    expect(proveedor.recibidas[0].candidatos.map((c) => c.etiqueta)).toEqual([
      'C1',
      'C2',
    ]);
    const enviado = JSON.stringify(proveedor.recibidas);
    for (const prohibido of [
      m,
      ...cfdis,
      A,
      FERRETERIA,
      'XAXX010101000',
      '<x/>',
    ]) {
      expect(enviado).not.toContain(prohibido);
    }
  });

  it('atómico: si falla la bitácora, no queda conciliación, ni libro, ni se limpia el motivo', async () => {
    const { m } = await ambiguo();
    await ds.query(`
      CREATE FUNCTION fallar_bitacora_llm() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.datos->>'origen' = 'llm' THEN
          RAISE EXCEPTION 'bitacora caida a proposito';
        END IF;
        RETURN NEW;
      END $$`);
    await ds.query(`
      CREATE TRIGGER trg_fallar_bitacora_llm BEFORE INSERT ON bitacora
      FOR EACH ROW EXECUTE FUNCTION fallar_bitacora_llm()`);
    try {
      await expect(
        servicio(new ProveedorFalso(sugiere())).sugerirParaEmpresa(A),
      ).rejects.toThrow(/bitacora caida a proposito/);
    } finally {
      await ds.query(`DROP TRIGGER trg_fallar_bitacora_llm ON bitacora`);
      await ds.query(`DROP FUNCTION fallar_bitacora_llm()`);
    }

    expect(await conciliacionesLlm()).toEqual([]);
    expect(await libro()).toEqual([]);
    expect(await bitacoraDe('crear')).toEqual([]);
    expect(await movimientoFila(m)).toMatchObject({
      regla: 'monto_multiples_candidatos',
    });
  });
});

describe('elegibilidad (IA-01 a IA-04)', () => {
  it('sin_candidato_monto no es elegible: no se llama ni se escribe', async () => {
    await movimiento(A, { monto: '777.00' });
    await conciliacion.conciliar(A);
    const proveedor = new ProveedorFalso(sugiere());

    const resumen = await servicio(proveedor).sugerirParaEmpresa(A);

    expect(proveedor.llamadas).toBe(0);
    expect(resumen).toMatchObject({ elegibles: 0, llamadas: 0 });
    expect(await libro()).toEqual([]);
    expect(await conciliacionesLlm()).toEqual([]);
  });

  it.each(['conciliado', 'descartado'])(
    'un movimiento %s con un motivo viejo se omite',
    async (estado) => {
      await movimiento(A, {
        estado,
        regla: 'monto_multiples_candidatos',
      });
      await factura(A, { folio: '1001' });
      await factura(A, { folio: '1002' });
      const proveedor = new ProveedorFalso(sugiere());

      await servicio(proveedor).sugerirParaEmpresa(A);

      expect(proveedor.llamadas).toBe(0);
    },
  );

  it('un movimiento con propuesta vigente, de cualquier origen, no se pregunta', async () => {
    const { m, cfdis } = await ambiguo();
    await ds.query(
      `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen)
       VALUES ($1,$2,$3,'propuesta','manual')`,
      [A, cfdis[1], m],
    );
    const proveedor = new ProveedorFalso(sugiere());

    await servicio(proveedor).sugerirParaEmpresa(A);

    expect(proveedor.llamadas).toBe(0);
  });

  it('un par que una persona rechazó sale de los candidatos; sin candidatos no se llama', async () => {
    const { m, cfdis } = await ambiguo(A, { folios: ['1001', '1002', '1003'] });
    await ds.query(
      `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen, motivo)
       VALUES ($1,$2,$3,'rechazada','llm','no era')`,
      [A, cfdis[0], m],
    );
    const proveedor = new ProveedorFalso();
    await servicio(proveedor).sugerirParaEmpresa(A);
    expect(proveedor.recibidas[0].candidatos.map((c) => c.serieFolio)).toEqual([
      'A-1002',
      'A-1003',
    ]);

    // Con todos los pares rechazados no queda nada que preguntar.
    await ds.query(
      `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen, motivo)
       VALUES ($1,$2,$3,'rechazada','llm','no era'), ($1,$4,$3,'rechazada','llm','no era')`,
      [A, cfdis[1], m, cfdis[2]],
    );
    const otro = new ProveedorFalso();
    const resumen = await servicio(otro).sugerirParaEmpresa(A);
    expect(otro.llamadas).toBe(0);
    expect(resumen.omitidos).toBe(1);
  });

  it('función apagada: ni llama al proveedor, ni lee la base, ni escribe', async () => {
    await ambiguo();
    const transaccion = entorno.app.get(TransaccionEmpresa);
    const espia = jest.spyOn(transaccion, 'ejecutar');
    const desactivado = new ProveedorDesactivado();
    const sugerir = jest.spyOn(desactivado, 'sugerir');

    const resumen = await servicio(desactivado).sugerirParaEmpresa(A);

    expect(sugerir).not.toHaveBeenCalled();
    expect(espia).not.toHaveBeenCalled();
    expect(resumen).toMatchObject({ llamadas: 0, propuestas: 0 });
    expect(await libro()).toEqual([]);
    expect(await conciliacionesLlm()).toEqual([]);
  });
});

describe('idempotencia y respuestas sin sugerencia (IA-09, IA-15, IA-17)', () => {
  it('una segunda corrida con la misma entrada no llama al proveedor', async () => {
    await ambiguo();
    const proveedor = new ProveedorFalso({ decision: 'ninguno' });
    const svc = servicio(proveedor);

    await svc.sugerirParaEmpresa(A);
    const segunda = await svc.sugerirParaEmpresa(A);

    expect(proveedor.llamadas).toBe(1);
    expect(segunda).toMatchObject({ llamadas: 0, omitidos: 1 });
    expect(await libro()).toHaveLength(1);
  });

  it('si cambian los candidatos, la huella cambia y se vuelve a preguntar', async () => {
    const { m } = await ambiguo();
    const proveedor = new ProveedorFalso({ decision: 'ninguno' });
    const svc = servicio(proveedor);
    await svc.sugerirParaEmpresa(A);

    await factura(A, { folio: '1003' });
    await conciliacion.conciliar(A);
    await svc.sugerirParaEmpresa(A);

    expect(proveedor.llamadas).toBe(2);
    expect(proveedor.recibidas[1].candidatos).toHaveLength(3);
    const huellas = (await libro()).map((f) => f.input_hash);
    expect(new Set(huellas).size).toBe(2);
    expect((await libro()).every((f) => f.movimiento_id === m)).toBe(true);
  });

  it.each([
    ['ninguno', { decision: 'ninguno' }],
    ['confianza baja', sugiere('C1', 'baja')],
    ['etiqueta fuera del conjunto', sugiere('C9')],
    ['sin respuesta (refusal o max_tokens)', { decision: 'sin_respuesta' }],
  ])(
    '%s: queda en el libro como sin_sugerencia y no hay conciliación',
    async (_nombre, respuesta) => {
      const { m } = await ambiguo();
      const proveedor = new ProveedorFalso(respuesta);
      const svc = servicio(proveedor);

      const resumen = await svc.sugerirParaEmpresa(A);

      expect(resumen).toMatchObject({ propuestas: 0, sinSugerencia: 1 });
      expect(await conciliacionesLlm()).toEqual([]);
      expect(await libro()).toEqual([
        expect.objectContaining({
          movimiento_id: m,
          resultado: 'sin_sugerencia',
        }),
      ]);
      // El motivo del motor sigue ahí: el movimiento queda en revisión.
      expect(await movimientoFila(m)).toMatchObject({
        regla: 'monto_multiples_candidatos',
      });
      await svc.sugerirParaEmpresa(A);
      expect(proveedor.llamadas).toBe(1);
    },
  );
});

describe('fallos del proveedor (IA-18 a IA-21)', () => {
  it('un error del proveedor no escribe nada y corta la corrida en el primero', async () => {
    const a = await ambiguo(A, { monto: '100.00' });
    await ambiguo(A, { monto: '200.00' });
    const proveedor = new ProveedorFalso(
      new ErrorProveedorSugerencia('tiempo agotado'),
    );

    const resumen = await servicio(proveedor).sugerirParaEmpresa(A);

    expect(proveedor.llamadas).toBe(1);
    expect(resumen).toMatchObject({
      llamadas: 1,
      propuestas: 0,
      interrumpida: true,
    });
    expect(await libro()).toEqual([]);
    expect(await conciliacionesLlm()).toEqual([]);
    expect((await movimientoFila(a.m)).regla).toBe(
      'monto_multiples_candidatos',
    );
  });

  it('se reintenta en la siguiente corrida', async () => {
    await ambiguo();
    await servicio(
      new ProveedorFalso(new ErrorProveedorSugerencia('caído')),
    ).sugerirParaEmpresa(A);

    const resumen = await servicio(
      new ProveedorFalso(sugiere()),
    ).sugerirParaEmpresa(A);

    expect(resumen.propuestas).toBe(1);
  });

  it('una respuesta fuera de contrato es fallo del proveedor: se corta y no se anota', async () => {
    await ambiguo(A, { monto: '100.00' });
    await ambiguo(A, { monto: '200.00' });
    const proveedor = new ProveedorFalso({ decision: 'quizá', candidato: 7 });

    const resumen = await servicio(proveedor).sugerirParaEmpresa(A);

    expect(proveedor.llamadas).toBe(1);
    expect(resumen.interrumpida).toBe(true);
    expect(await libro()).toEqual([]);
  });

  it('respeta el tope de llamadas y lo omitido no cuenta', async () => {
    for (const monto of ['100.00', '200.00', '300.00']) {
      await ambiguo(A, { monto });
    }
    const proveedor = new ProveedorFalso({ decision: 'ninguno' });
    const svc = servicio(proveedor, { maxLlamadas: 2 });

    const primera = await svc.sugerirParaEmpresa(A);
    expect(primera).toMatchObject({ elegibles: 3, llamadas: 2 });
    expect(proveedor.llamadas).toBe(2);

    // Dos ya están en el libro: no cuentan para el tope; queda uno.
    const segunda = await svc.sugerirParaEmpresa(A);
    expect(segunda).toMatchObject({ llamadas: 1, omitidos: 2 });
    expect(proveedor.llamadas).toBe(3);
  });

  it('más candidatos que LLM_CANDIDATOS_MAX: no se pregunta ni se anota', async () => {
    await ambiguo(A, { folios: ['1001', '1002', '1003'] });
    const proveedor = new ProveedorFalso(sugiere());

    const resumen = await servicio(proveedor, {
      maxCandidatos: 2,
    }).sugerirParaEmpresa(A);

    expect(proveedor.llamadas).toBe(0);
    expect(resumen.omitidos).toBe(1);
    expect(await libro()).toEqual([]);
  });
});

describe('revalidación bajo el candado (IA-12)', () => {
  /**
   * El proveedor cambia la base mientras "piensa": exactamente la ventana
   * entre la lectura y la escritura.
   */
  const cambios: [string, (m: string, cfdis: string[]) => Promise<unknown>][] =
    [
      [
        'apareció una conciliación del movimiento',
        (m, cfdis) =>
          ds.query(
            `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen)
           VALUES ($1,$2,$3,'propuesta','manual')`,
            [A, cfdis[1], m],
          ),
      ],
      [
        'el CFDI elegido se ocupó con otro movimiento',
        async (_m, cfdis) => {
          const otro = await movimiento(A, { monto: '1160.00' });
          await ds.query(
            `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen)
           VALUES ($1,$2,$3,'propuesta','regla')`,
            [A, cfdis[0], otro],
          );
        },
      ],
      [
        'el movimiento se concilió',
        (m) =>
          ds.query(
            `UPDATE movimientos SET estado = 'conciliado' WHERE id = $1`,
            [m],
          ),
      ],
      [
        'cambió la regla del motor',
        (m) =>
          ds.query(
            `UPDATE movimientos SET regla_sin_match = 'cfdi_multiples_movimientos' WHERE id = $1`,
            [m],
          ),
      ],
      [
        'cambió el motivo del motor',
        (m) =>
          ds.query(
            `UPDATE movimientos SET motivo_sin_match = 'otro motivo' WHERE id = $1`,
            [m],
          ),
      ],
      [
        'el CFDI ya no está abierto',
        (_m, cfdis) =>
          ds.query(`UPDATE cfdi SET estado = 'conciliada' WHERE id = $1`, [
            cfdis[0],
          ]),
      ],
      [
        'el par quedó rechazado',
        (m, cfdis) =>
          ds.query(
            `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen, motivo)
           VALUES ($1,$2,$3,'rechazada','manual','no')`,
            [A, cfdis[0], m],
          ),
      ],
    ];

  it.each(cambios)(
    '%s: no se inserta nada y no queda fila en el libro',
    async (_nombre, cambio) => {
      const { m, cfdis } = await ambiguo();
      const llamadasAntes = (await conciliacionesLlm()).length;
      const proveedor = new ProveedorFalso(async () => {
        await cambio(m, cfdis);
        return sugiere('C1');
      });

      const resumen = await servicio(proveedor).sugerirParaEmpresa(A);

      expect(resumen).toMatchObject({ propuestas: 0, obsoletas: 1 });
      expect(await conciliacionesLlm()).toHaveLength(llamadasAntes);
      expect(await libro()).toEqual([]);
      expect(await bitacoraDe('crear')).toEqual([]);
    },
  );

  it('no sostiene el candado ni una transacción durante la llamada al proveedor', async () => {
    await ambiguo();
    let conciliarDuranteLaLlamada: Promise<unknown> | undefined;
    const proveedor = new ProveedorFalso(() => {
      // Si el servicio tuviera el candado de la empresa tomado, esto esperaría
      // a que el servicio terminara, y el servicio espera a esta llamada.
      conciliarDuranteLaLlamada = Promise.race([
        conciliacion.conciliar(A),
        new Promise((_, rechazar) =>
          setTimeout(
            () => rechazar(new Error('conciliar quedó esperando el candado')),
            5_000,
          ),
        ),
      ]);
      return conciliarDuranteLaLlamada.then(() => sugiere());
    });

    const resumen = await servicio(proveedor).sugerirParaEmpresa(A);

    await expect(conciliarDuranteLaLlamada).resolves.toBeDefined();
    expect(resumen.propuestas).toBe(1);
  });

  it('conciliar() concurrente con la escritura: sin deadlock y una sola propuesta', async () => {
    await ambiguo();
    let concurrente: Promise<unknown> = Promise.resolve();
    const proveedor = new ProveedorFalso(() => {
      // Sin esperarla: corre a la vez que la transacción de escritura.
      concurrente = conciliacion.conciliar(A);
      return sugiere();
    });

    const resumen = await servicio(proveedor).sugerirParaEmpresa(A);
    await concurrente;

    expect(resumen.propuestas + resumen.obsoletas).toBe(1);
    expect((await conciliacionesLlm()).length).toBe(resumen.propuestas);
    const vivas = await una<{ n: number }>(
      ds,
      `SELECT count(*)::int AS n FROM conciliaciones WHERE estado <> 'rechazada'`,
    );
    expect(vivas.n).toBe(resumen.propuestas);
  });
});

describe('aislamiento entre empresas (IA-25)', () => {
  it('la corrida de A no lee ni escribe nada de B', async () => {
    await ambiguo(A, { descripcion: 'PAGO DE FERRETERIA' });
    const deB = await ambiguo(B, { descripcion: 'PAGO DE TRANSPORTES' });
    const proveedor = new ProveedorFalso(sugiere());

    await servicio(proveedor).sugerirParaEmpresa(A);

    expect(proveedor.llamadas).toBe(1);
    expect(JSON.stringify(proveedor.recibidas)).toContain('FERRETERIA');
    expect(JSON.stringify(proveedor.recibidas)).not.toContain('TRANSPORTES');
    expect(await conciliacionesLlm(B)).toEqual([]);
    expect(await libro(B)).toEqual([]);
    expect((await movimientoFila(deB.m)).regla).toBe(
      'monto_multiples_candidatos',
    );
    expect(await conciliacionesLlm(A)).toHaveLength(1);
    expect(await libro(A)).toHaveLength(1);
  });

  it('la corrida de B tampoco toca a A', async () => {
    const deA = await ambiguo(A);
    await ambiguo(B);

    await servicio(new ProveedorFalso(sugiere())).sugerirParaEmpresa(B);

    expect(await conciliacionesLlm(A)).toEqual([]);
    expect((await movimientoFila(deA.m)).regla).toBe(
      'monto_multiples_candidatos',
    );
  });
});

describe('el modelo nunca cierra un caso (IA-23)', () => {
  it('tras una corrida, movimiento y CFDI siguen abiertos y la conciliación es propuesta', async () => {
    const { m, cfdis } = await ambiguo();

    await servicio(
      new ProveedorFalso(sugiere('C1', 'alta')),
    ).sugerirParaEmpresa(A);

    const [fila] = await conciliacionesLlm();
    expect(fila.estado).toBe('propuesta');
    expect((await movimientoFila(m)).estado).toBe('abierto');
    const { estado } = await una<{ estado: string }>(
      ds,
      'SELECT estado FROM cfdi WHERE id = $1',
      [cfdis[0]],
    );
    expect(estado).toBe('abierta');
    const { persona } = await una<{ persona: string | null }>(
      ds,
      'SELECT confirmada_por_id AS persona FROM conciliaciones WHERE id = $1',
      [fila.id],
    );
    expect(persona).toBeNull();
  });

  it('el esquema existente rechaza una fila llm confirmada sin persona; no hay CHECK nuevo sobre origen', async () => {
    const { m, cfdis } = await ambiguo();

    await expect(
      ds.query(
        `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen)
         VALUES ($1,$2,$3,'confirmada','llm')`,
        [A, cfdis[0], m],
      ),
    ).rejects.toThrow(/ck_conciliaciones_confirmada_requiere_persona/);

    // Solo los CHECK de siempre: ninguno liga 'llm' con un estado.
    const checks = await filas<{ conname: string }>(
      ds,
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'conciliaciones'::regclass AND contype = 'c'
        ORDER BY conname`,
    );
    expect(checks.map((c) => c.conname)).toEqual([
      'ck_conciliaciones_confirmada_requiere_persona',
      'ck_conciliaciones_estado',
      'ck_conciliaciones_origen',
      'ck_conciliaciones_score_rango',
    ]);
  });
});

describe('integración con CU-14, CU-15 y CU-16 (IA-26 a IA-28)', () => {
  let token: string;
  let ana: string;

  beforeEach(async () => {
    token = await entorno.token(ANA, FERRETERIA);
    ana = entorno.persona(ANA);
  });

  const http = () => request(entorno.app.getHttpServer());
  const conToken = (r: request.Test) => r.set('Cookie', token);

  it('IA-26: la bandeja lista la propuesta llm con score NULL, sin exponer el origen', async () => {
    const { m } = await ambiguo();
    await servicio(new ProveedorFalso(sugiere())).sugerirParaEmpresa(A);
    const [llm] = await conciliacionesLlm();

    // Otro movimiento con una propuesta del motor (0.9) y una llm (NULL): gana la del motor.
    const m2 = await movimiento(A, { monto: '500.00' });
    const c2 = await factura(A, { folio: '2001', total: '500.00' });
    const c3 = await factura(A, { folio: '2002', total: '500.00' });
    await ds.query(
      `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado, origen, regla, score)
       VALUES ($1,$2,$3,'propuesta','regla','monto_unico','0.9000'),
              ($1,$4,$3,'propuesta','llm','llm_sugerencia',NULL)`,
      [A, c2, m2, c3],
    );

    const res = await conToken(http().get('/bandeja')).expect(200);
    const datos = (
      res.body as {
        datos: {
          movimientoId: string;
          estado: string;
          regla: string;
          propuestasCount: number;
          mejorPropuesta: { conciliacionId: string; score: string | null };
        }[];
      }
    ).datos;

    const fila = datos.find((d) => d.movimientoId === m);
    expect(fila).toMatchObject({
      estado: 'sugerencia',
      regla: 'llm_sugerencia',
      propuestasCount: 1,
    });
    expect(fila?.mejorPropuesta.conciliacionId).toBe(llm.id);
    expect(fila?.mejorPropuesta.score).toBeNull();

    const mixta = datos.find((d) => d.movimientoId === m2);
    expect(mixta).toMatchObject({ propuestasCount: 2, regla: 'monto_unico' });
    expect(mixta?.mejorPropuesta.score).toBe('0.9000');

    expect(JSON.stringify(res.body)).not.toContain('origen');
    expect(JSON.stringify(res.body)).not.toContain('"llm"');
  });

  it('IA-27: una persona confirma una propuesta llm y queda confirmada con su nombre en la bitácora', async () => {
    const { m, cfdis } = await ambiguo();
    await servicio(new ProveedorFalso(sugiere())).sugerirParaEmpresa(A);
    const [llm] = await conciliacionesLlm();

    const res = await conToken(
      http().post(`/conciliaciones/${llm.id}/confirmar`),
    )
      .send()
      .expect(200);

    expect(res.body).toMatchObject({ id: llm.id, estado: 'confirmada' });
    const fila = await una<{ estado: string; persona: string; origen: string }>(
      ds,
      `SELECT estado, confirmada_por_id AS persona, origen FROM conciliaciones WHERE id = $1`,
      [llm.id],
    );
    expect(fila).toEqual({ estado: 'confirmada', persona: ana, origen: 'llm' });
    expect((await movimientoFila(m)).estado).toBe('conciliado');
    const { estado } = await una<{ estado: string }>(
      ds,
      'SELECT estado FROM cfdi WHERE id = $1',
      [cfdis[0]],
    );
    expect(estado).toBe('conciliada');
    const confirmar = (await bitacoraDe('confirmar')).filter(
      (b) => b.entidad_id === llm.id,
    );
    expect(confirmar).toEqual([expect.objectContaining({ user_id: ana })]);
  });

  it('IA-27: al rechazarla, el par no vuelve a salir entre los candidatos', async () => {
    const { cfdis } = await ambiguo(A, { folios: ['1001', '1002', '1003'] });
    await servicio(new ProveedorFalso(sugiere('C1'))).sugerirParaEmpresa(A);
    const [llm] = await conciliacionesLlm();
    expect(llm.cfdi_id).toBe(cfdis[0]);

    // conciliar() corre solo tras el rechazo; aquí se controla a mano.
    jest
      .spyOn(conciliacion, 'conciliar')
      .mockResolvedValueOnce({ propuestas: 0 });
    await conToken(http().post(`/conciliaciones/${llm.id}/rechazar`))
      .send({ motivo: 'No es ese cliente' })
      .expect(200);
    jest.restoreAllMocks();
    await conciliacion.conciliar(A);

    const proveedor = new ProveedorFalso({ decision: 'ninguno' });
    await servicio(proveedor).sugerirParaEmpresa(A);

    expect(proveedor.llamadas).toBe(1);
    expect(proveedor.recibidas[0].candidatos.map((c) => c.serieFolio)).toEqual([
      'A-1002',
      'A-1003',
    ]);
  });

  it('IA-28: el historial y el listado de la bitácora muestran el crear sin usuario y con origen llm', async () => {
    await ambiguo();
    await servicio(new ProveedorFalso(sugiere())).sugerirParaEmpresa(A);
    const [llm] = await conciliacionesLlm();

    const historial = await conToken(
      http().get(`/conciliaciones/${llm.id}/historial`),
    ).expect(200);
    const eventos = (
      historial.body as {
        datos: {
          accion: string;
          usuario: unknown;
          datos: Record<string, unknown>;
        }[];
      }
    ).datos;
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      accion: 'crear',
      usuario: null,
      datos: { origen: 'llm', modelo: 'modelo-falso' },
    });

    const listado = await conToken(
      http().get('/bitacora?entidad=conciliaciones&accion=crear'),
    ).expect(200);
    const crear = (
      listado.body as {
        datos: {
          entidadId: string;
          usuario: unknown;
          datos: { origen: string };
        }[];
      }
    ).datos.find((e) => e.entidadId === llm.id);
    expect(crear).toMatchObject({ usuario: null, datos: { origen: 'llm' } });
  });
});
