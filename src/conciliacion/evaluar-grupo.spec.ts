// src/conciliacion/evaluar-grupo.spec.ts
import { CERO, dinero } from '../common/dinero';
import {
  evaluarGrupo,
  MAX_CANDIDATOS_POR_RFC,
  MAX_FACTURAS_POR_SUBCONJUNTO,
} from './evaluar-grupo';
import type { CfdiAbierto, MovimientoAbierto } from './evaluar-par';

function mov(monto: string): MovimientoAbierto {
  return {
    id: 'm1',
    fecha: '2026-03-10',
    monto,
    moneda: 'MXN',
    referencia: null,
    referenciaNorm: null,
  };
}

function cfdi(
  id: string,
  total: string,
  rfcReceptor: string | null = 'AAA010101AAA',
): CfdiAbierto {
  return {
    id,
    serie: 'A',
    folio: id,
    fechaEmision: '2026-03-01',
    total,
    moneda: 'MXN',
    rfcReceptor,
  };
}

/** `c01`, `c02`... para que el orden por texto coincida con el numérico. */
const id = (n: number): string => `c${String(n).padStart(2, '0')}`;

describe('evaluarGrupo', () => {
  it('las cotas son las acordadas', () => {
    expect(MAX_FACTURAS_POR_SUBCONJUNTO).toBe(5);
    expect(MAX_CANDIDATOS_POR_RFC).toBe(20);
  });

  it('un subconjunto único de 2 facturas da una propuesta con ids ordenados', () => {
    const r = evaluarGrupo(
      mov('300.00'),
      [cfdi('c2', '200.00'), cfdi('c1', '100.00'), cfdi('c3', '777.00')],
      CERO,
    );
    expect(r).toMatchObject({
      tipo: 'propuesta',
      cfdiIds: ['c1', 'c2'],
      diferenciaMonto: '0.0000',
      regla: 'suma_grupo',
      score: 0.6,
    });
    if (r?.tipo === 'propuesta') {
      expect(r.motivo).toContain('300.00');
      expect(r.motivo).not.toMatch(/correct|erróne|equivocad/i);
    }
  });

  it('un subconjunto único de 3 facturas', () => {
    const r = evaluarGrupo(
      mov('600.00'),
      [
        cfdi('c3', '300.00'),
        cfdi('c1', '100.00'),
        cfdi('c2', '200.00'),
        cfdi('c4', '5000.00'),
      ],
      CERO,
    );
    expect(r).toMatchObject({
      tipo: 'propuesta',
      cfdiIds: ['c1', 'c2', 'c3'],
    });
  });

  it('la diferencia del grupo lleva signo y está dentro de la tolerancia', () => {
    const tol = dinero('1.00');
    const falta = evaluarGrupo(
      mov('299.50'),
      [cfdi('c1', '100.00'), cfdi('c2', '200.00')],
      tol,
    );
    expect(falta).toMatchObject({
      tipo: 'propuesta',
      diferenciaMonto: '-0.5000',
    });
    const sobra = evaluarGrupo(
      mov('300.75'),
      [cfdi('c1', '100.00'), cfdi('c2', '200.00')],
      tol,
    );
    expect(sobra).toMatchObject({
      tipo: 'propuesta',
      diferenciaMonto: '0.7500',
    });
  });

  it('la diferencia igual a la tolerancia se acepta, como en una sola factura', () => {
    const r = evaluarGrupo(
      mov('301.00'),
      [cfdi('c1', '100.00'), cfdi('c2', '200.00')],
      dinero('1.00'),
    );
    expect(r).toMatchObject({ tipo: 'propuesta', diferenciaMonto: '1.0000' });
  });

  it('suma fuera de tolerancia: nada', () => {
    expect(
      evaluarGrupo(
        mov('301.01'),
        [cfdi('c1', '100.00'), cfdi('c2', '200.00')],
        dinero('1.00'),
      ),
    ).toBeNull();
    expect(
      evaluarGrupo(
        mov('300.01'),
        [cfdi('c1', '100.00'), cfdi('c2', '200.00')],
        CERO,
      ),
    ).toBeNull();
  });

  it('dos subconjuntos con la misma suma: sin propuesta y con explicación', () => {
    const r = evaluarGrupo(
      mov('300.00'),
      [
        cfdi('c1', '100.00'),
        cfdi('c2', '200.00'),
        cfdi('c3', '150.00'),
        cfdi('c4', '150.00'),
      ],
      CERO,
    );
    expect(r).toMatchObject({
      tipo: 'sin_match',
      regla: 'combinaciones_multiples',
      cfdiIds: ['c1', 'c2', 'c3', 'c4'],
    });
    expect(r).not.toHaveProperty('score');
    if (r?.tipo === 'sin_match') {
      expect(r.motivo).toMatch(/combinaciones/i);
    }
  });

  it('facturas de RFC distintos que solo suman entre RFC: nada', () => {
    expect(
      evaluarGrupo(
        mov('300.00'),
        [
          cfdi('c1', '100.00', 'AAA010101AAA'),
          cfdi('c2', '200.00', 'BBB010101BBB'),
        ],
        CERO,
      ),
    ).toBeNull();
  });

  it('un rfcReceptor nulo o vacío nunca forma grupo', () => {
    expect(
      evaluarGrupo(
        mov('300.00'),
        [cfdi('c1', '100.00', null), cfdi('c2', '200.00', null)],
        CERO,
      ),
    ).toBeNull();
    expect(
      evaluarGrupo(
        mov('300.00'),
        [cfdi('c1', '100.00', ''), cfdi('c2', '200.00', '')],
        CERO,
      ),
    ).toBeNull();
  });

  it('un subconjunto en el RFC A y otro en el B: ambigüedad', () => {
    const r = evaluarGrupo(
      mov('300.00'),
      [
        cfdi('c1', '100.00', 'AAA010101AAA'),
        cfdi('c2', '200.00', 'AAA010101AAA'),
        cfdi('c3', '120.00', 'BBB010101BBB'),
        cfdi('c4', '180.00', 'BBB010101BBB'),
      ],
      CERO,
    );
    expect(r).toMatchObject({
      tipo: 'sin_match',
      regla: 'combinaciones_multiples',
      cfdiIds: ['c1', 'c2', 'c3', 'c4'],
    });
  });

  it('nunca propone una sola factura', () => {
    expect(
      evaluarGrupo(
        mov('100.00'),
        [cfdi('c1', '100.00'), cfdi('c2', '900.00')],
        CERO,
      ),
    ).toBeNull();
  });

  it('acepta subconjuntos de 5 y no encuentra los de 6', () => {
    const cinco = [1, 2, 3, 4, 5].map((n) => cfdi(id(n), '100.00'));
    expect(evaluarGrupo(mov('500.00'), cinco, CERO)).toMatchObject({
      tipo: 'propuesta',
      cfdiIds: cinco.map((c) => c.id),
    });
    const seis = [1, 2, 3, 4, 5, 6].map((n) => cfdi(id(n), '100.00'));
    expect(evaluarGrupo(mov('600.00'), seis, CERO)).toBeNull();
  });

  it('más de 20 candidatos de un RFC: no se busca y se explica', () => {
    const muchos = Array.from({ length: 21 }, (_, i) =>
      cfdi(id(i + 1), '100.00'),
    );
    const r = evaluarGrupo(mov('200.00'), muchos, CERO);
    expect(r).toMatchObject({
      tipo: 'sin_match',
      regla: 'candidatos_excedidos',
    });
    expect(r).not.toHaveProperty('score');
  });

  it('exactamente 20 candidatos sí se busca', () => {
    const veinte = Array.from({ length: 20 }, (_, i) =>
      cfdi(id(i + 1), String(i + 1) + '000.00'),
    );
    const r = evaluarGrupo(mov('3000.00'), veinte, CERO);
    expect(r).toMatchObject({ tipo: 'propuesta', cfdiIds: ['c01', 'c02'] });
  });

  it('si un RFC excede la cota no se propone ni en el otro RFC', () => {
    const muchos = Array.from({ length: 21 }, (_, i) =>
      cfdi(id(i + 1), '1.00', 'AAA010101AAA'),
    );
    const otro = [
      cfdi('d1', '100.00', 'BBB010101BBB'),
      cfdi('d2', '200.00', 'BBB010101BBB'),
    ];
    const r = evaluarGrupo(mov('300.00'), [...muchos, ...otro], CERO);
    expect(r).toMatchObject({
      tipo: 'sin_match',
      regla: 'candidatos_excedidos',
    });
  });

  it('el orden de entrada no cambia el resultado', () => {
    const base = [
      cfdi('c1', '100.00'),
      cfdi('c2', '200.00'),
      cfdi('c3', '150.00'),
      cfdi('c4', '150.00'),
      cfdi('c5', '50.00'),
      cfdi('c6', '250.00'),
    ];
    const esperado = evaluarGrupo(mov('300.00'), base, CERO);
    const baraja = (xs: CfdiAbierto[], paso: number): CfdiAbierto[] =>
      xs.map((_, i) => xs[(i * paso) % xs.length]);
    for (const paso of [5, 1]) {
      const r = evaluarGrupo(mov('300.00'), baraja(base, paso), CERO);
      expect(r).toEqual(esperado);
    }
    expect(evaluarGrupo(mov('300.00'), [...base].reverse(), CERO)).toEqual(
      esperado,
    );
  });

  it('el dinero nunca pasa por flotante (0.1 + 0.2 suma 0.3 exacto)', () => {
    const r = evaluarGrupo(
      mov('0.30'),
      [cfdi('c1', '0.10'), cfdi('c2', '0.20')],
      CERO,
    );
    expect(r).toMatchObject({ tipo: 'propuesta', diferenciaMonto: '0.0000' });
  });
});
