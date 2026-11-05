import {
  SCORE_MONTO_UNICO,
  SCORE_REFERENCIA_MONTO_DIFERENTE,
  SCORE_REFERENCIA_MONTO_EXACTO,
  SCORE_SUMA_GRUPO,
  nivelDeConfianza,
} from './evaluar-par';

describe('nivelDeConfianza (AC6)', () => {
  it('regla 1 es alta, regla 2 media y regla 3 baja', () => {
    expect(nivelDeConfianza(SCORE_REFERENCIA_MONTO_EXACTO)).toBe('alta');
    expect(nivelDeConfianza(SCORE_REFERENCIA_MONTO_DIFERENTE)).toBe('media');
    expect(nivelDeConfianza(SCORE_MONTO_UNICO)).toBe('baja');
  });

  it('acepta el score como texto numeric de la base', () => {
    expect(nivelDeConfianza('1.0000')).toBe('alta');
    expect(nivelDeConfianza('0.5000')).toBe('media');
    expect(nivelDeConfianza('0.4000')).toBe('baja');
  });

  it('un score inválido o fuera de rango no es nunca alta', () => {
    for (const malo of [
      null,
      undefined,
      '',
      'abc',
      NaN,
      Infinity,
      -1,
      0,
      1.5,
      '1.5000',
    ]) {
      expect(nivelDeConfianza(malo)).toBeNull();
    }
  });

  it('los niveles bajan con el score', () => {
    const orden = ['alta', 'media', 'baja'];
    const niveles = [
      SCORE_REFERENCIA_MONTO_EXACTO,
      SCORE_REFERENCIA_MONTO_DIFERENTE,
      SCORE_MONTO_UNICO,
    ].map((s) => orden.indexOf(nivelDeConfianza(s) as string));
    expect(niveles).toEqual([0, 1, 2]);
  });

  it('la regla de grupo (4.5) es media y va entre la regla 1 y la 2', () => {
    expect(nivelDeConfianza(SCORE_SUMA_GRUPO)).toBe('media');
    expect(SCORE_REFERENCIA_MONTO_EXACTO).toBeGreaterThan(SCORE_SUMA_GRUPO);
    expect(SCORE_SUMA_GRUPO).toBeGreaterThan(SCORE_REFERENCIA_MONTO_DIFERENTE);
    expect(SCORE_REFERENCIA_MONTO_DIFERENTE).toBeGreaterThan(SCORE_MONTO_UNICO);
  });
});
