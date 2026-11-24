import { describe, expect, it } from 'vitest';
import { respuestaMarca, respuestaMuestra } from './muestra';

const CASO = {
  decisionId: 'd1',
  movimientoId: 'm1',
  fecha: '2026-09-12',
  descripcion: 'SPEI MATERIALES REYES',
  referencia: 'A-1044',
  monto: '18560.4000',
  moneda: 'MXN',
  banco: 'BBVA',
  regla: 'referencia_monto_exacto',
  motivo: 'La referencia coincide.',
  cfdis: [
    {
      id: 'c1',
      uuidFiscal: 'u-1',
      serie: 'A',
      folio: '1044',
      nombreEmisor: 'Materiales Reyes',
      nombreReceptor: null,
      total: '18560.0000',
      moneda: 'MXN',
    },
  ],
  confirmadaPor: 'Marta Salas',
  confirmadaPorMi: false,
  confirmadaAt: '2026-09-12T10:00:00.000Z',
  marca: 'pendiente',
  marcadaPor: null,
  marcadaAt: null,
  marcas: [],
  reabierta: false,
  puedeMarcar: true,
};
const MUESTRA = {
  mes: '2026-09',
  meses: ['2026-09', '2026-08'],
  sinRevisor: false,
  puedeVerificar: true,
  avance: {
    total: 1,
    conformes: 0,
    desacuerdos: 0,
    pendientes: 1,
    reabiertas: 0,
  },
  casos: [CASO],
};

describe('respuestaMuestra (historia 9.4)', () => {
  it('acepta la muestra y deja los montos como texto', () => {
    const r = respuestaMuestra.parse(MUESTRA);
    expect(r).toEqual(MUESTRA);
    expect(r.casos[0]?.monto).toBe('18560.4000');
    expect(r.casos[0]?.cfdis[0]?.total).toBe('18560.0000');
  });

  it('sin muestra del mes: mes null y listas vacías', () => {
    const r = respuestaMuestra.parse({
      ...MUESTRA,
      mes: null,
      meses: [],
      casos: [],
      avance: {
        total: 0,
        conformes: 0,
        desacuerdos: 0,
        pendientes: 0,
        reabiertas: 0,
      },
    });
    expect(r.mes).toBeNull();
  });

  it('un monto numérico, una marca desconocida o un mes mal formado fallan', () => {
    const malas = [
      { casos: [{ ...CASO, monto: 18560.4 }] },
      { casos: [{ ...CASO, marca: 'quizas' }] },
      { casos: [{ ...CASO, cfdis: [{ ...CASO.cfdis[0], total: 12 }] }] },
      {
        casos: [
          {
            ...CASO,
            marcas: [{ quien: 'x', resultado: 'pendiente', cuando: 'z' }],
          },
        ],
      },
      { mes: '2026-9' },
      { avance: { ...MUESTRA.avance, total: 1.5 } },
    ];
    for (const mala of malas) {
      expect(() => respuestaMuestra.parse({ ...MUESTRA, ...mala })).toThrow();
    }
  });

  it('exige los campos que el servidor siempre manda', () => {
    for (const campo of [
      'sinRevisor',
      'puedeVerificar',
      'meses',
      'avance',
      'casos',
    ]) {
      expect(() =>
        respuestaMuestra.parse({ ...MUESTRA, [campo]: undefined }),
      ).toThrow();
    }
    for (const campo of ['puedeMarcar', 'reabierta', 'marcas', 'cfdis']) {
      expect(() =>
        respuestaMuestra.parse({
          ...MUESTRA,
          casos: [{ ...CASO, [campo]: undefined }],
        }),
      ).toThrow();
    }
  });
});

describe('respuestaMarca', () => {
  it('acepta la marca registrada', () => {
    const r = {
      decisionId: 'd1',
      marca: 'conforme',
      marcadaPor: 'Luis',
      marcadaAt: '2026-11-22T10:42:00.000Z',
    };
    expect(respuestaMarca.parse(r)).toEqual(r);
  });
  it('una marca «pendiente» no es un resultado', () => {
    expect(() =>
      respuestaMarca.parse({
        decisionId: 'd1',
        marca: 'pendiente',
        marcadaPor: 'L',
        marcadaAt: 'x',
      }),
    ).toThrow();
  });
});
