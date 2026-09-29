// src/conciliacion/evaluar-par.spec.ts
import { CERO, dinero } from '../common/dinero';
import {
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
      expect(t).toContain('referencia_monto_exacto');
      expect(t).toContain('A-0001001');
      expect(t).toContain('A-0001001'.replace('-', '-')); // referencia cruda
      expect(t).toContain('1160.00');
    });

    it('referencia_monto_diferente cita la diferencia y pide revisión', () => {
      const t = evaluarPar(
        mov({ id: 'm1', monto: '1000.00', referencia: '1001' }),
        c,
        CERO,
        { porReferencia: true },
      )!.motivo;
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

  it('el motivo de una fila de selección nombra la regla y el CFDI', () => {
    const r = seleccionarPropuestas(
      [mov({ id: 'm1', referencia: 'A-0001001' })],
      [cfdi({ id: 'c1' })],
      CERO,
      sinExistentes,
    );
    expect(r[0].motivo).toContain('A-0001001');
  });
});
