import { createHash } from 'crypto';
import { CERO, dinero } from '../common/dinero';
import type { ParExistente } from '../conciliacion/evaluar-par';
import { normalizarReferencia } from '../conciliacion/referencia-normalizer';
import {
  type CfdiSugerible,
  construirSolicitud,
  type MovimientoSugerible,
  type ParametrosSolicitud,
  PROMPT_VERSION,
  type SolicitudSugerencia,
} from './candidatos';
import { ProveedorFalso } from './proveedor-falso';

const RFC = 'FDB190215QK4';
const UUID_FISCAL = '3f9c1c52-7a43-4c1e-9d0a-2b6c8d7e5a10';
const XML = '<cfdi:Comprobante Total="1160.00"/>';

function mov(p: Partial<MovimientoSugerible> = {}): MovimientoSugerible {
  const referencia = p.referencia ?? null;
  return {
    id: 'm1',
    fecha: '2026-09-10',
    monto: '1160.0000',
    moneda: 'MXN',
    descripcion: 'SPEI RECIBIDO CLIENTE',
    referencia,
    referenciaNorm: normalizarReferencia(referencia),
    regla: 'monto_multiples_candidatos',
    motivo: 'varios CFDI coinciden',
    ...p,
  };
}

function cfdi(p: Partial<CfdiSugerible> & { id: string }): CfdiSugerible {
  return {
    serie: 'A',
    folio: '1',
    fechaEmision: '2026-09-01',
    total: '1160.0000',
    moneda: 'MXN',
    receptor: 'CLIENTE SA DE CV',
    ...p,
  };
}

function armar(
  p: Partial<ParametrosSolicitud> & Pick<ParametrosSolicitud, 'cfdis'>,
) {
  return construirSolicitud({
    movimiento: mov(),
    existentes: [],
    tolerancia: CERO,
    modelo: 'modelo-x',
    maxCandidatos: 10,
    ...p,
  });
}

function solicitud(
  p: Partial<ParametrosSolicitud> & Pick<ParametrosSolicitud, 'cfdis'>,
): SolicitudSugerencia {
  const r = armar(p);
  if (r.tipo !== 'solicitud') throw new Error(`omitida: ${r.motivo}`);
  return r.solicitud;
}

const DOS = [cfdi({ id: 'c1', folio: '1' }), cfdi({ id: 'c2', folio: '2' })];

describe('conjunto de candidatos por regla (D-B)', () => {
  it('monto_multiples_candidatos: los CFDI que coinciden por monto', () => {
    const s = solicitud({
      cfdis: [...DOS, cfdi({ id: 'c3', folio: '3', total: '5.0000' })],
    });
    expect(s.candidatos.map((c) => c.cfdi.id)).toEqual(['c1', 'c2']);
  });

  it('referencia_ambigua: los CFDI que empatan con la referencia', () => {
    const s = solicitud({
      movimiento: mov({
        regla: 'referencia_ambigua',
        referencia: 'A-1001',
        monto: '900.0000',
      }),
      cfdis: [
        cfdi({ id: 'c1', folio: '1001', total: '1160.0000' }),
        cfdi({ id: 'c2', serie: 'B', folio: '1001', total: '500.0000' }),
        cfdi({ id: 'c3', folio: '9' }),
        cfdi({ id: 'c4', folio: '1001', total: '700.0000' }),
      ],
    });
    // c1 y c4 son A1001; c2 es B1001 y c3 no empata. Aquí el monto no filtra.
    expect(s.candidatos.map((c) => c.cfdi.id).sort()).toEqual(['c1', 'c4']);
  });

  it('cfdi_multiples_movimientos: el único CFDI por monto', () => {
    const s = solicitud({
      movimiento: mov({ regla: 'cfdi_multiples_movimientos' }),
      cfdis: [cfdi({ id: 'c1' })],
    });
    expect(s.candidatos).toHaveLength(1);
  });

  it('excluye los CFDI con una conciliación vigente (propuesta o confirmada)', () => {
    const existentes: ParExistente[] = [
      { cfdiId: 'c1', movimientoId: 'otro', rechazada: false },
    ];
    const s = solicitud({ cfdis: DOS, existentes });
    expect(s.candidatos.map((c) => c.cfdi.id)).toEqual(['c2']);
  });

  it('excluye un par rechazado por una persona', () => {
    const existentes: ParExistente[] = [
      { cfdiId: 'c1', movimientoId: 'm1', rechazada: true },
    ];
    const s = solicitud({ cfdis: DOS, existentes });
    expect(s.candidatos.map((c) => c.cfdi.id)).toEqual(['c2']);
  });

  it('un CFDI rechazado para otro movimiento no cuenta como ocupado', () => {
    const existentes: ParExistente[] = [
      { cfdiId: 'c1', movimientoId: 'otro', rechazada: true },
    ];
    expect(
      solicitud({ cfdis: DOS, existentes }).candidatos.map((c) => c.cfdi.id),
    ).toEqual(['c1', 'c2']);
  });

  it('excluye otra moneda y una emisión posterior a la fecha del movimiento', () => {
    const s = solicitud({
      cfdis: [
        ...DOS,
        cfdi({ id: 'c3', folio: '3', moneda: 'USD' }),
        cfdi({ id: 'c4', folio: '4', fechaEmision: '2026-09-11' }),
      ],
    });
    expect(s.candidatos.map((c) => c.cfdi.id)).toEqual(['c1', 'c2']);
  });

  it('sin candidatos no se pregunta', () => {
    expect(
      armar({
        cfdis: [],
      }),
    ).toEqual({ tipo: 'omitida', motivo: 'sin_candidatos' });
    expect(
      armar({
        cfdis: DOS,
        existentes: [
          { cfdiId: 'c1', movimientoId: 'o', rechazada: false },
          { cfdiId: 'c2', movimientoId: 'o2', rechazada: false },
        ],
      }),
    ).toEqual({ tipo: 'omitida', motivo: 'sin_candidatos' });
  });

  it('más candidatos que el máximo se omite completo, no se trunca', () => {
    const cfdis = [1, 2, 3].map((n) => cfdi({ id: `c${n}`, folio: `${n}` }));
    expect(armar({ cfdis, maxCandidatos: 2 })).toEqual({
      tipo: 'omitida',
      motivo: 'demasiados_candidatos',
    });
    expect(armar({ cfdis, maxCandidatos: 3 }).tipo).toBe('solicitud');
  });

  it('la tolerancia de la empresa amplía el conjunto por monto', () => {
    const cfdis = [
      cfdi({ id: 'c1', folio: '1', total: '1158.0000' }),
      cfdi({ id: 'c2', folio: '2' }),
    ];
    expect(solicitud({ cfdis }).candidatos).toHaveLength(1);
    expect(
      solicitud({ cfdis, tolerancia: dinero('5') }).candidatos,
    ).toHaveLength(2);
  });
});

describe('etiquetas opacas (D-C)', () => {
  const desordenados = [
    cfdi({ id: 'z', serie: 'B', folio: '7', total: '1160.0000' }),
    cfdi({ id: 'y', serie: 'A', folio: '9', total: '1160.0000' }),
    cfdi({ id: 'x', serie: 'A', folio: '2', total: '1160.0000' }),
  ];

  it('C1..CN tras ordenar, sin depender del orden de la base', () => {
    const a = solicitud({ cfdis: desordenados });
    const b = solicitud({ cfdis: [...desordenados].reverse() });
    expect(a.candidatos.map((c) => [c.etiqueta, c.cfdi.id])).toEqual([
      ['C1', 'x'],
      ['C2', 'y'],
      ['C3', 'z'],
    ]);
    expect(b.candidatos).toEqual(a.candidatos);
    expect(b.entrada).toEqual(a.entrada);
  });

  it('desempata por fecha, receptor e id (no por el orden de entrada)', () => {
    const s = solicitud({
      cfdis: [
        cfdi({ id: 'd', receptor: 'B' }),
        cfdi({ id: 'c', receptor: 'A' }),
        cfdi({ id: 'b', fechaEmision: '2026-09-02' }),
        cfdi({ id: 'a' }),
      ],
      tolerancia: dinero('0'),
    });
    expect(s.candidatos.map((c) => c.cfdi.id)).toEqual(['c', 'd', 'a', 'b']);
  });
});

describe('payload mínimo (IA-07)', () => {
  const cfdiConSecretos = {
    ...cfdi({ id: 'c1', folio: '1' }),
    rfcEmisor: RFC,
    rfcReceptor: 'XAXX010101000',
    uuidFiscal: UUID_FISCAL,
    xmlRaw: { _xml: XML },
    companyId: 'company-secreta',
  } as CfdiSugerible;

  it('lleva solo movimiento y candidatos con los campos permitidos', () => {
    const s = solicitud({
      movimiento: mov({ referencia: 'A-1' }),
      cfdis: [cfdiConSecretos, cfdi({ id: 'c2', folio: '2' })],
    });
    expect(s.entrada).toEqual({
      movimiento: {
        fecha: '2026-09-10',
        monto: '1160.0000',
        moneda: 'MXN',
        descripcion: 'SPEI RECIBIDO CLIENTE',
        referencia: 'A-1',
      },
      candidatos: [
        {
          etiqueta: 'C1',
          serieFolio: 'A-1',
          total: '1160.0000',
          fecha: '2026-09-01',
          receptor: 'CLIENTE SA DE CV',
        },
        {
          etiqueta: 'C2',
          serieFolio: 'A-2',
          total: '1160.0000',
          fecha: '2026-09-01',
          receptor: 'CLIENTE SA DE CV',
        },
      ],
    });
  });

  it('el JSON serializado no contiene RFC, UUID, XML ni ids', () => {
    const s = solicitud({
      cfdis: [cfdiConSecretos, cfdi({ id: 'c2', folio: '2' })],
    });
    const json = JSON.stringify(s.entrada);
    for (const prohibido of [
      RFC,
      'XAXX010101000',
      UUID_FISCAL,
      XML,
      'Comprobante',
      'company-secreta',
      'm1',
      '"c1"',
      '"c2"',
      'rfc',
      'uuid',
      'xml',
    ]) {
      expect(json).not.toContain(prohibido);
    }
  });

  it('lo que recibe el proveedor es exactamente ese payload', async () => {
    const falso = new ProveedorFalso();
    const s = solicitud({ cfdis: [cfdiConSecretos, DOS[1]] });
    await falso.sugerir(s.entrada);
    const enviado = JSON.stringify(falso.recibidas);
    expect(enviado).not.toContain(UUID_FISCAL);
    expect(enviado).not.toContain(RFC);
    expect(falso.recibidas[0]).toBe(s.entrada);
  });

  it('un receptor sin nombre viaja como cadena vacía y la serie ausente usa solo el folio', () => {
    const s = solicitud({
      cfdis: [
        cfdi({ id: 'c1', receptor: null, serie: null, folio: '55' }),
        DOS[1],
      ],
    });
    expect(s.entrada.candidatos[0]).toMatchObject({
      serieFolio: '55',
      receptor: '',
    });
  });

  it('normaliza los montos a 4 decimales sin pasar por number', () => {
    const s = solicitud({
      movimiento: mov({ monto: '1160' }),
      cfdis: [cfdi({ id: 'c1', total: '1160.00' }), DOS[1]],
    });
    expect(s.entrada.movimiento.monto).toBe('1160.0000');
    expect(s.entrada.candidatos[0].total).toBe('1160.0000');
  });
});

describe('input_hash (D-D)', () => {
  const base = () => solicitud({ cfdis: DOS });

  it('es sha256 en hex de 64 caracteres y estable', () => {
    expect(base().inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(base().inputHash).toBe(base().inputHash);
  });

  it('no depende del orden de los candidatos', () => {
    expect(solicitud({ cfdis: [...DOS].reverse() }).inputHash).toBe(
      base().inputHash,
    );
  });

  it('no contiene ids: otros ids con la misma pregunta dan la misma huella', () => {
    const otros = [
      cfdi({ id: 'zz1', folio: '1' }),
      cfdi({ id: 'zz2', folio: '2' }),
    ];
    expect(solicitud({ cfdis: otros }).inputHash).toBe(base().inputHash);
  });

  it('cambia si cambia el conjunto de candidatos', () => {
    expect(
      solicitud({ cfdis: [...DOS, cfdi({ id: 'c3', folio: '3' })] }).inputHash,
    ).not.toBe(base().inputHash);
    expect(
      solicitud({
        cfdis: DOS,
        existentes: [{ cfdiId: 'c1', movimientoId: 'm1', rechazada: true }],
      }).inputHash,
    ).not.toBe(base().inputHash);
  });

  it('cambia con el modelo', () => {
    expect(solicitud({ cfdis: DOS, modelo: 'otro' }).inputHash).not.toBe(
      base().inputHash,
    );
  });

  it('cambia con la regla y con los datos del movimiento', () => {
    expect(
      solicitud({
        cfdis: DOS,
        movimiento: mov({ regla: 'cfdi_multiples_movimientos' }),
      }).inputHash,
    ).not.toBe(base().inputHash);
    expect(
      solicitud({ cfdis: DOS, movimiento: mov({ descripcion: 'OTRA' }) })
        .inputHash,
    ).not.toBe(base().inputHash);
  });

  it('la versión del prompt forma parte de la huella', () => {
    expect(PROMPT_VERSION).toBe('v1');
    const s = base();
    const conVersion = (v: string) =>
      createHash('sha256')
        .update(
          JSON.stringify({
            v,
            modelo: 'modelo-x',
            regla: 'monto_multiples_candidatos',
            movimiento: s.entrada.movimiento,
            candidatos: s.entrada.candidatos.map((c) => ({
              serieFolio: c.serieFolio,
              total: c.total,
              fecha: c.fecha,
              receptor: c.receptor,
            })),
          }),
        )
        .digest('hex');
    expect(conVersion(PROMPT_VERSION)).toBe(s.inputHash);
    expect(conVersion('v2')).not.toBe(s.inputHash);
  });
});
