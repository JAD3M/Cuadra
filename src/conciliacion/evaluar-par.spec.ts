// src/conciliacion/evaluar-par.spec.ts
import { CERO, dinero } from '../common/dinero';
import {
  candidatosAmbiguos,
  evaluarConMotivos,
  evaluarPar,
  seleccionarPropuestas,
  type CfdiAbierto,
  type MovimientoAbierto,
  type ParExistente,
} from './evaluar-par';
import { normalizarReferencia } from './referencia-normalizer';

function mov(
  p: Partial<MovimientoAbierto> & { id: string },
): MovimientoAbierto {
  const referencia = p.referencia ?? null;
  return {
    fecha: '2026-03-10',
    monto: '1160.00',
    moneda: 'MXN',
    referencia,
    referenciaNorm: normalizarReferencia(referencia),
    ...p,
  };
}

function cfdi(p: Partial<CfdiAbierto> & { id: string }): CfdiAbierto {
  return {
    serie: 'A',
    folio: '0001001',
    fechaEmision: '2026-03-01',
    total: '1160.00',
    moneda: 'MXN',
    ...p,
  };
}

const sinExistentes: ParExistente[] = [];

describe('evaluarPar', () => {
  const m = mov({ id: 'm1', referencia: 'A-0001001' });
  const c = cfdi({ id: 'c1' });

  it('referencia y monto exactos: referencia_monto_exacto 1.0', () => {
    const p = evaluarPar(m, c, CERO, { porReferencia: true });
    expect(p).toMatchObject({
      cfdiId: 'c1',
      movimientoId: 'm1',
      regla: 'referencia_monto_exacto',
      score: 1.0,
      diferenciaMonto: '0.0000',
    });
  });

  it('un centavo de diferencia con tolerancia 0: referencia_monto_diferente 0.5', () => {
    const p = evaluarPar(m, cfdi({ id: 'c1', total: '1159.99' }), CERO, {
      porReferencia: true,
    });
    expect(p?.regla).toBe('referencia_monto_diferente');
    expect(p?.score).toBe(0.5);
    expect(p?.diferenciaMonto).toBe('0.0100');
  });

  it('diferencia con signo monto - total', () => {
    const p = evaluarPar(mov({ id: 'm1', monto: '1000.00' }), c, CERO, {
      porReferencia: true,
    });
    expect(p?.diferenciaMonto).toBe('-160.0000');
    expect(p?.regla).toBe('referencia_monto_diferente');
  });

  it('con tolerancia 0.01 un centavo cuenta como exacto y guarda la diferencia real', () => {
    const p = evaluarPar(
      m,
      cfdi({ id: 'c1', total: '1159.99' }),
      dinero('0.01'),
      {
        porReferencia: true,
      },
    );
    expect(p?.regla).toBe('referencia_monto_exacto');
    expect(p?.score).toBe(1.0);
    expect(p?.diferenciaMonto).toBe('0.0100');
  });

  it('tolerancia 200 con diferencia -160: exacto 1.0 con la diferencia real', () => {
    const p = evaluarPar(
      mov({ id: 'm1', monto: '1000.00' }),
      c,
      dinero('200'),
      {
        porReferencia: true,
      },
    );
    expect(p?.regla).toBe('referencia_monto_exacto');
    expect(p?.score).toBe(1.0);
    expect(p?.diferenciaMonto).toBe('-160.0000');
  });

  it('aritmética decimal: 0.30 contra 0.3 es igual', () => {
    const p = evaluarPar(
      mov({ id: 'm1', monto: '0.30' }),
      cfdi({ id: 'c1', total: '0.3' }),
      CERO,
      { porReferencia: true },
    );
    expect(p?.regla).toBe('referencia_monto_exacto');
    expect(p?.diferenciaMonto).toBe('0.0000');
  });

  it('moneda distinta: sin propuesta', () => {
    expect(
      evaluarPar(mov({ id: 'm1', moneda: 'USD' }), c, CERO, {
        porReferencia: true,
      }),
    ).toBeNull();
  });

  it('fecha: mismo día sí, día anterior no', () => {
    const emitido = cfdi({ id: 'c1', fechaEmision: '2026-03-10' });
    expect(
      evaluarPar(m, emitido, CERO, { porReferencia: true }),
    ).not.toBeNull();
    expect(
      evaluarPar(mov({ id: 'm1', fecha: '2026-03-09' }), emitido, CERO, {
        porReferencia: true,
      }),
    ).toBeNull();
  });

  it('solo por monto: monto_unico 0.4; fuera de tolerancia no hay propuesta', () => {
    const sinRef = mov({ id: 'm1' });
    const p = evaluarPar(sinRef, c, CERO, { porReferencia: false });
    expect(p?.regla).toBe('monto_unico');
    expect(p?.score).toBe(0.4);
    expect(
      evaluarPar(sinRef, cfdi({ id: 'c1', total: '1159.99' }), CERO, {
        porReferencia: false,
      }),
    ).toBeNull();
  });

  describe('motivo (RM-7)', () => {
    it('referencia_monto_exacto cita referencia, serie-folio y montos', () => {
      const t = evaluarPar(m, c, CERO, { porReferencia: true })!.motivo;
      expect(t).not.toMatch(/^Regla/);
      expect(t).toContain('A-0001001');
      expect(t).toContain('1160.00');
    });

    it('referencia_monto_exacto con diferencia dentro de tolerancia la incluye', () => {
      const t = evaluarPar(
        mov({ id: 'm1', monto: '1000.00', referencia: '1001' }),
        c,
        dinero('200'),
        { porReferencia: true },
      )!.motivo;
      expect(t).toContain('-160.00');
      expect(t).toMatch(/dentro de la tolerancia/);
    });

    it('referencia_monto_exacto con diferencia cero no menciona diferencia', () => {
      const t = evaluarPar(m, c, CERO, { porReferencia: true })!.motivo;
      expect(t).not.toMatch(/diferencia/i);
    });

    it('referencia_monto_diferente cita la diferencia y pide revisión', () => {
      const t = evaluarPar(
        mov({ id: 'm1', monto: '1000.00', referencia: '1001' }),
        c,
        CERO,
        { porReferencia: true },
      )!.motivo;
      expect(t).not.toMatch(/^Regla/);
      expect(t).toContain('1001');
      expect(t).toContain('A-0001001');
      expect(t).toContain('1000.00');
      expect(t).toContain('1160.00');
      expect(t).toContain('-160.00');
      expect(t).toMatch(/sugerencia/i);
      expect(t).toMatch(/revisi/i);
    });

    it('monto_unico aclara que no hubo referencia', () => {
      const t = evaluarPar(mov({ id: 'm1' }), c, CERO, {
        porReferencia: false,
      })!.motivo;
      expect(t).not.toMatch(/^Regla/);
      expect(t).toMatch(/sin referencia/i);
      expect(t).toMatch(/única coincidencia/i);
      expect(t).toContain('1160.00');
    });

    it('nunca menciona al LLM y no está vacío', () => {
      for (const porReferencia of [true, false]) {
        const t = evaluarPar(m, c, CERO, { porReferencia })!.motivo;
        expect(t.length).toBeGreaterThan(10);
        expect(t).not.toMatch(/\bllm\b|\bmodelo de lenguaje\b|\bIA\b/i);
      }
    });
  });
});

describe('seleccionarPropuestas', () => {
  it('referencia única: exacto, nunca confirmada', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', referencia: 'A-0001001' })],
      [cfdi({ id: 'c1' })],
      CERO,
      sinExistentes,
    );
    expect(r).toHaveLength(1);
    expect(r[0].regla).toBe('referencia_monto_exacto');
    expect(r[0]).not.toHaveProperty('estado');
  });

  it('referencia con solo el folio también empata', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', referencia: '0001001' })],
      [cfdi({ id: 'c1' })],
      CERO,
      sinExistentes,
    );
    expect(r.map((p) => p.regla)).toEqual(['referencia_monto_exacto']);
  });

  it('referencia ambigua (serie A y B, folio 1001): sin fila y sin respaldo por monto', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', referencia: '1001' })],
      [cfdi({ id: 'c1', serie: 'A' }), cfdi({ id: 'c2', serie: 'B' })],
      CERO,
      sinExistentes,
    );
    expect(r).toEqual([]);
  });

  it('el mismo CFDI por las dos llaves es un solo candidato', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', referencia: '1001' })],
      [cfdi({ id: 'c1', serie: '', folio: '1001' })],
      CERO,
      sinExistentes,
    );
    expect(r).toHaveLength(1);
  });

  it('referencia corta cae a monto único', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', referencia: '12' })],
      [cfdi({ id: 'c1', folio: '12', serie: '' })],
      CERO,
      sinExistentes,
    );
    expect(r.map((p) => p.regla)).toEqual(['monto_unico']);
  });

  it('referencia que no coincide con nada cae a monto único', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', referencia: 'SPEI PAGO' })],
      [cfdi({ id: 'c1' })],
      CERO,
      sinExistentes,
    );
    expect(r.map((p) => p.regla)).toEqual(['monto_unico']);
  });

  it('referencia con monto distinto: sugerencia 0.5', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', referencia: 'A-0001001', monto: '1000.00' })],
      [cfdi({ id: 'c1' })],
      CERO,
      sinExistentes,
    );
    expect(r[0]).toMatchObject({
      regla: 'referencia_monto_diferente',
      score: 0.5,
      diferenciaMonto: '-160.0000',
    });
  });

  it('el CFDI de la referencia falla moneda o fecha: sin fila y sin respaldo', () => {
    const otro = cfdi({ id: 'c2', serie: 'Z', folio: '999' });
    expect(
      seleccionarPropuestas(
        [mov({ id: 'm1', referencia: 'A-0001001' })],
        [cfdi({ id: 'c1', moneda: 'USD' }), otro],
        CERO,
        sinExistentes,
      ),
    ).toEqual([]);
    expect(
      seleccionarPropuestas(
        [mov({ id: 'm1', referencia: 'A-0001001', fecha: '2026-02-28' })],
        [cfdi({ id: 'c1' }), otro],
        CERO,
        sinExistentes,
      ),
    ).toEqual([]);
  });

  it('monto único con un solo CFDI y un solo movimiento: fila', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', monto: '500.00' })],
      [cfdi({ id: 'c1', total: '500.00' })],
      CERO,
      sinExistentes,
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ regla: 'monto_unico', score: 0.4 });
  });

  it('dos CFDI con el mismo monto: nada', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', monto: '500.00' })],
      [
        cfdi({ id: 'c1', total: '500.00', folio: '1' }),
        cfdi({ id: 'c2', total: '500.00', folio: '2' }),
      ],
      CERO,
      sinExistentes,
    );
    expect(r).toEqual([]);
  });

  it('dos movimientos con el mismo monto y un CFDI: nada (SD5)', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', monto: '500.00' }), mov({ id: 'm2', monto: '500.00' })],
      [cfdi({ id: 'c1', total: '500.00' })],
      CERO,
      sinExistentes,
    );
    expect(r).toEqual([]);
  });

  it('un CFDI ya propuesto sigue contando como candidato (SD6)', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm2', monto: '500.00' })],
      [
        cfdi({ id: 'x', total: '500.00', folio: '1' }),
        cfdi({ id: 'y', total: '500.00', folio: '2' }),
      ],
      CERO,
      [{ cfdiId: 'x', movimientoId: 'm1', rechazada: false }],
    );
    expect(r).toEqual([]);
  });

  it('un movimiento con propuesta vigente no recibe otra', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', referencia: 'A-0001001' })],
      [cfdi({ id: 'y' })],
      CERO,
      [{ cfdiId: 'x', movimientoId: 'm1', rechazada: false }],
    );
    expect(r).toEqual([]);
  });

  it('un CFDI con propuesta vigente no recibe otra', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm2', referencia: 'A-0001001' })],
      [cfdi({ id: 'c1' })],
      CERO,
      [{ cfdiId: 'c1', movimientoId: 'm1', rechazada: false }],
    );
    expect(r).toEqual([]);
  });

  it('un par rechazado no se vuelve a proponer', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', referencia: 'A-0001001' })],
      [cfdi({ id: 'c1' })],
      CERO,
      [{ cfdiId: 'c1', movimientoId: 'm1', rechazada: true }],
    );
    expect(r).toEqual([]);
  });

  it('el rechazo libera al otro candidato: (M,Y) por monto único', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', monto: '500.00' })],
      [
        cfdi({ id: 'x', total: '500.00', folio: '1' }),
        cfdi({ id: 'y', total: '500.00', folio: '2' }),
      ],
      CERO,
      [{ cfdiId: 'x', movimientoId: 'm1', rechazada: true }],
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      movimientoId: 'm1',
      cfdiId: 'y',
      regla: 'monto_unico',
    });
  });

  it('el motivo de una fila de selección nombra el CFDI y no lleva prefijo de regla', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', referencia: 'A-0001001' })],
      [cfdi({ id: 'c1' })],
      CERO,
      sinExistentes,
    );
    expect(r[0].motivo).toContain('A-0001001');
    expect(r[0].motivo).not.toMatch(/^Regla/);
  });
});

describe('evaluarConMotivos (CU-13)', () => {
  const ev = (
    movs: MovimientoAbierto[],
    cfdis: CfdiAbierto[],
    existentes: ParExistente[] = sinExistentes,
  ) => evaluarConMotivos(movs, cfdis, CERO, existentes);

  it('referencia_ambigua: cita referencia y cantidad, sin respaldo por monto', () => {
    const r = ev(
      [mov({ id: 'm1', referencia: '1001' })],
      [cfdi({ id: 'c1' }), cfdi({ id: 'c2', serie: 'B' })],
    );
    expect(r.propuestas).toEqual([]);
    expect(r.sinMatch).toEqual([
      expect.objectContaining({
        movimientoId: 'm1',
        regla: 'referencia_ambigua',
      }),
    ]);
    expect(r.sinMatch[0].motivo).toContain('"1001"');
    expect(r.sinMatch[0].motivo).toContain('2 CFDI');
    expect(r.sinMatch[0].motivo).toMatch(/ni se intenta por monto/);
  });

  it('referencia_cfdi_ocupado: cita referencia y serie-folio', () => {
    const r = ev(
      [mov({ id: 'm1', referencia: 'A-0001001' })],
      [cfdi({ id: 'c1' })],
      [{ cfdiId: 'c1', movimientoId: 'otro', rechazada: false }],
    );
    expect(r.sinMatch[0].regla).toBe('referencia_cfdi_ocupado');
    expect(r.sinMatch[0].motivo).toContain('"A-0001001"');
    expect(r.sinMatch[0].motivo).toContain('A-0001001');
    expect(r.sinMatch[0].motivo).toMatch(/vinculado a otro movimiento/);
  });

  it('referencia_cfdi_no_compatible: dice que falló la moneda, con ambos valores', () => {
    const r = ev(
      [mov({ id: 'm1', referencia: 'A-0001001', moneda: 'USD' })],
      [cfdi({ id: 'c1' })],
    );
    expect(r.sinMatch[0].regla).toBe('referencia_cfdi_no_compatible');
    expect(r.sinMatch[0].motivo).toContain('USD');
    expect(r.sinMatch[0].motivo).toContain('MXN');
    expect(r.sinMatch[0].motivo).toMatch(/moneda/);
  });

  it('referencia_cfdi_no_compatible: dice que falló la fecha, con ambos valores', () => {
    const r = ev(
      [mov({ id: 'm1', referencia: 'A-0001001', fecha: '2026-02-01' })],
      [cfdi({ id: 'c1', fechaEmision: '2026-03-01' })],
    );
    expect(r.sinMatch[0].regla).toBe('referencia_cfdi_no_compatible');
    expect(r.sinMatch[0].motivo).toContain('2026-02-01');
    expect(r.sinMatch[0].motivo).toContain('2026-03-01');
    expect(r.sinMatch[0].motivo).toMatch(/fecha/);
  });

  it('sin_candidato_monto: cita el monto y no diagnostica tipos de CFDI', () => {
    const r = ev([mov({ id: 'm1' })], [cfdi({ id: 'c1', total: '500.00' })]);
    expect(r.sinMatch[0].regla).toBe('sin_candidato_monto');
    expect(r.sinMatch[0].motivo).toContain('1160.00');
    expect(r.sinMatch[0].motivo).not.toMatch(/PPD|cancelad/i);
  });

  it('sin_candidato_monto: un par rechazado sale del conjunto (S5)', () => {
    const r = ev(
      [mov({ id: 'm1' })],
      [cfdi({ id: 'c1' })],
      [{ cfdiId: 'c1', movimientoId: 'm1', rechazada: true }],
    );
    expect(r.propuestas).toEqual([]);
    expect(r.sinMatch[0].regla).toBe('sin_candidato_monto');
  });

  it('monto_multiples_candidatos: referencia inutilizable cae al monto (S7)', () => {
    const r = ev(
      [mov({ id: 'm1', referencia: '12' })],
      [cfdi({ id: 'c1' }), cfdi({ id: 'c2', folio: '9' })],
    );
    expect(r.sinMatch[0].regla).toBe('monto_multiples_candidatos');
    expect(r.sinMatch[0].motivo).toContain('2 CFDI');
    expect(r.sinMatch[0].motivo).toContain('1160.00');
  });

  it('referencia_ambigua por folio duplicado no cae al monto (S8)', () => {
    const r = ev(
      [mov({ id: 'm1', referencia: '1001' })],
      [cfdi({ id: 'c1', folio: '1001' }), cfdi({ id: 'c2', folio: '1001' })],
    );
    expect(r.propuestas).toEqual([]);
    expect(r.sinMatch.map((s) => s.regla)).toEqual(['referencia_ambigua']);
  });

  it('monto_candidato_ocupado: cita monto y serie-folio', () => {
    const r = ev(
      [mov({ id: 'm1' })],
      [cfdi({ id: 'c1' })],
      [{ cfdiId: 'c1', movimientoId: 'otro', rechazada: false }],
    );
    expect(r.sinMatch[0].regla).toBe('monto_candidato_ocupado');
    expect(r.sinMatch[0].motivo).toContain('A-0001001');
    expect(r.sinMatch[0].motivo).toContain('1160.00');
  });

  it('cfdi_multiples_movimientos: ambos movimientos quedan explicados', () => {
    const r = ev([mov({ id: 'm1' }), mov({ id: 'm2' })], [cfdi({ id: 'c1' })]);
    expect(r.propuestas).toEqual([]);
    expect(r.sinMatch.map((s) => s.regla)).toEqual([
      'cfdi_multiples_movimientos',
      'cfdi_multiples_movimientos',
    ]);
    expect(r.sinMatch[0].motivo).toContain('A-0001001');
    expect(r.sinMatch[0].motivo).toMatch(/otros\s+movimientos/);
  });

  describe('invariantes', () => {
    const movs = [
      mov({ id: 'ocupado' }),
      mov({ id: 'con-propuesta', referencia: 'A-0001001', monto: '1160.00' }),
      mov({ id: 'sin-nada', monto: '7.00' }),
      mov({ id: 'ambiguo', referencia: '2002' }),
    ];
    const cfdis = [
      cfdi({ id: 'c1' }),
      cfdi({ id: 'c2', folio: '2002', total: '10.00' }),
      cfdi({ id: 'c3', folio: '2002', total: '20.00' }),
    ];
    const existentes: ParExistente[] = [
      { cfdiId: 'x', movimientoId: 'ocupado', rechazada: false },
    ];

    it('cada movimiento es exactamente uno de ocupado, propuesta o sinMatch', () => {
      const r = evaluarConMotivos(movs, cfdis, CERO, existentes);
      const conPropuesta = r.propuestas.map((p) => p.movimientoId);
      const conRazon = r.sinMatch.map((s) => s.movimientoId);
      expect(conPropuesta).toEqual(['con-propuesta']);
      expect(conRazon.sort()).toEqual(['ambiguo', 'sin-nada']);
      const todos = ['ocupado', ...conPropuesta, ...conRazon].sort();
      expect(todos).toEqual(movs.map((x) => x.id).sort());
      expect(new Set(todos).size).toBe(movs.length);
    });

    it('los motivos nunca llevan prefijo de regla ni mencionan al LLM', () => {
      const { sinMatch } = evaluarConMotivos(movs, cfdis, CERO, existentes);
      for (const s of sinMatch) {
        expect(s.motivo.length).toBeGreaterThan(10);
        expect(s.motivo).not.toContain('Regla ');
        expect(s.motivo.toLowerCase()).not.toContain('llm');
      }
    });

    it('seleccionarPropuestas devuelve lo mismo que .propuestas', () => {
      expect(seleccionarPropuestas(movs, cfdis, CERO, existentes)).toEqual(
        evaluarConMotivos(movs, cfdis, CERO, existentes).propuestas,
      );
    });
  });
});

describe('tolerancia solo en MXN (CU-12)', () => {
  const tolerancia = dinero('5');

  it('MXN: la diferencia dentro de la tolerancia es exacta, con la diferencia real', () => {
    const p = evaluarPar(
      mov({ id: 'm1', monto: '1156.00' }),
      cfdi({ id: 'c1' }),
      tolerancia,
      { porReferencia: true },
    );
    expect(p).toMatchObject({
      regla: 'referencia_monto_exacto',
      score: 1.0,
      diferenciaMonto: '-4.0000',
    });
  });

  it('MXN: el borde inclusivo cuenta y un centavo más no', () => {
    const en = (monto: string) =>
      evaluarPar(mov({ id: 'm1', monto }), cfdi({ id: 'c1' }), tolerancia, {
        porReferencia: true,
      })?.regla;
    expect(en('1155.00')).toBe('referencia_monto_exacto');
    expect(en('1154.99')).toBe('referencia_monto_diferente');
  });

  it('otra moneda: la tolerancia no aplica y el monto sigue exacto', () => {
    const p = evaluarPar(
      mov({ id: 'm1', monto: '1156.00', moneda: 'USD' }),
      cfdi({ id: 'c1', moneda: 'USD' }),
      tolerancia,
      { porReferencia: true },
    );
    expect(p?.regla).toBe('referencia_monto_diferente');
    expect(p?.score).toBe(0.5);
    expect(p?.diferenciaMonto).toBe('-4.0000');
  });

  it('otra moneda: sin referencia, una diferencia pequeña no da monto_unico', () => {
    expect(
      evaluarPar(
        mov({ id: 'm1', monto: '1159.99', moneda: 'USD' }),
        cfdi({ id: 'c1', moneda: 'USD' }),
        tolerancia,
        { porReferencia: false },
      ),
    ).toBeNull();
  });

  it('seleccionarPropuestas: monto_unico dentro de tolerancia en MXN, no en USD', () => {
    const conMoneda = (moneda: string) =>
      seleccionarPropuestas(
        [mov({ id: 'm1', monto: '1156.00', moneda })],
        [cfdi({ id: 'c1', moneda })],
        tolerancia,
        sinExistentes,
      );
    expect(conMoneda('MXN')).toEqual([
      expect.objectContaining({ regla: 'monto_unico' }),
    ]);
    expect(conMoneda('USD')).toEqual([]);
  });
});

describe('candidatosAmbiguos (CU-17)', () => {
  const ids = (cs: readonly CfdiAbierto[]) => cs.map((c) => c.id);

  it('referencia_ambigua: los CFDI que empatan con la referencia, y solo esos', () => {
    const m = mov({ id: 'm1', referencia: 'A-0001001' });
    const cfdis = [
      cfdi({ id: 'c1' }),
      cfdi({ id: 'c2', serie: 'A', folio: '1001' }),
      cfdi({ id: 'c3', folio: '0002002' }),
    ];
    expect(
      ids(
        candidatosAmbiguos(m, 'referencia_ambigua', cfdis, CERO, sinExistentes),
      ),
    ).toEqual(['c1', 'c2']);
  });

  it('referencia_ambigua: un par rechazado sale del conjunto', () => {
    const m = mov({ id: 'm1', referencia: 'A-0001001' });
    const cfdis = [
      cfdi({ id: 'c1' }),
      cfdi({ id: 'c2', serie: 'A', folio: '1001' }),
    ];
    const existentes: ParExistente[] = [
      { cfdiId: 'c1', movimientoId: 'm1', rechazada: true },
    ];
    expect(
      ids(candidatosAmbiguos(m, 'referencia_ambigua', cfdis, CERO, existentes)),
    ).toEqual(['c2']);
  });

  it('referencia_ambigua sin referencia utilizable: conjunto vacío', () => {
    const m = mov({ id: 'm1', referencia: null });
    expect(
      candidatosAmbiguos(
        m,
        'referencia_ambigua',
        [cfdi({ id: 'c1' })],
        CERO,
        sinExistentes,
      ),
    ).toEqual([]);
  });

  it('monto_multiples_candidatos: los que coinciden por monto, moneda y fecha', () => {
    const m = mov({ id: 'm1' });
    const cfdis = [
      cfdi({ id: 'c1', folio: '1' }),
      cfdi({ id: 'c2', folio: '2' }),
      cfdi({ id: 'c3', folio: '3', total: '999.00' }),
      cfdi({ id: 'c4', folio: '4', moneda: 'USD' }),
      cfdi({ id: 'c5', folio: '5', fechaEmision: '2026-03-11' }),
    ];
    expect(
      ids(
        candidatosAmbiguos(
          m,
          'monto_multiples_candidatos',
          cfdis,
          CERO,
          sinExistentes,
        ),
      ),
    ).toEqual(['c1', 'c2']);
  });

  it('cfdi_multiples_movimientos: el único CFDI que coincide por monto', () => {
    const m = mov({ id: 'm1' });
    const cfdis = [cfdi({ id: 'c1' }), cfdi({ id: 'c2', total: '5.00' })];
    expect(
      ids(
        candidatosAmbiguos(
          m,
          'cfdi_multiples_movimientos',
          cfdis,
          CERO,
          sinExistentes,
        ),
      ),
    ).toEqual(['c1']);
  });

  it('por monto respeta la tolerancia y los pares rechazados', () => {
    const m = mov({ id: 'm1', monto: '1158.00' });
    const cfdis = [
      cfdi({ id: 'c1', folio: '1' }),
      cfdi({ id: 'c2', folio: '2' }),
    ];
    expect(
      ids(
        candidatosAmbiguos(
          m,
          'monto_multiples_candidatos',
          cfdis,
          dinero('5'),
          [{ cfdiId: 'c2', movimientoId: 'm1', rechazada: true }],
        ),
      ),
    ).toEqual(['c1']);
    expect(
      candidatosAmbiguos(
        m,
        'monto_multiples_candidatos',
        cfdis,
        CERO,
        sinExistentes,
      ),
    ).toEqual([]);
  });

  it('coincide con lo que evaluarConMotivos dejó sin propuesta (mismo conjunto)', () => {
    const m = mov({ id: 'm1', referencia: 'A-0001001' });
    const cfdis = [
      cfdi({ id: 'c1' }),
      cfdi({ id: 'c2', serie: 'A', folio: '1001' }),
    ];
    const { sinMatch } = evaluarConMotivos([m], cfdis, CERO, sinExistentes);
    expect(sinMatch).toEqual([
      expect.objectContaining({ regla: 'referencia_ambigua' }),
    ]);
    expect(
      ids(
        candidatosAmbiguos(m, 'referencia_ambigua', cfdis, CERO, sinExistentes),
      ),
    ).toEqual(['c1', 'c2']);
  });
});
