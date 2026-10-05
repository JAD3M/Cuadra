import { describe, expect, it } from 'vitest';
import { formatearFecha } from './fecha';

describe('formatearFecha', () => {
  it.each(['2026-09-18', '2026-01-01', '2026-12-31'])(
    'conserva el día de %s sin correrlo por zona horaria',
    (iso) => {
      expect(formatearFecha(iso)).toBe(iso);
    },
  );

  it('no usa Date: una fecha imposible para Date se separa igual', () => {
    expect(formatearFecha('2026-02-31')).toBe('2026-02-31');
  });

  it.each(['', 'ayer', '2026-9-1', '2026-09-18T00:00:00Z'])(
    'devuelve tal cual la cadena con otra forma (%j)',
    (valor) => {
      expect(formatearFecha(valor)).toBe(valor);
    },
  );
});
