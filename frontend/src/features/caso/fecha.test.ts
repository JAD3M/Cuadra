import { describe, expect, it } from 'vitest';
import { formatearDiaDeInstante, formatearInstante } from './fecha';

const INSTANTE = '2026-10-05T03:30:00.000Z';

describe('formatearInstante', () => {
  it('da YYYY-MM-DD HH:mm en la zona indicada', () => {
    expect(formatearInstante(INSTANTE, 'UTC')).toBe('2026-10-05 03:30');
    expect(formatearInstante(INSTANTE, 'America/Mexico_City')).toBe(
      '2026-10-04 21:30',
    );
  });

  it('usa dos dígitos en mes, día, hora y minuto', () => {
    expect(formatearInstante('2026-01-02T03:04:00.000Z', 'UTC')).toBe(
      '2026-01-02 03:04',
    );
  });

  it('medianoche es 00:00 y no 24:00', () => {
    expect(formatearInstante('2026-01-02T00:00:00.000Z', 'UTC')).toBe(
      '2026-01-02 00:00',
    );
  });

  it('un valor que no es un instante se devuelve tal cual', () => {
    expect(formatearInstante('no es fecha', 'UTC')).toBe('no es fecha');
  });

  it('sin zona usa la del navegador y mantiene la forma', () => {
    expect(formatearInstante(INSTANTE)).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    );
  });
});

describe('formatearDiaDeInstante', () => {
  it('da solo el día de la zona indicada', () => {
    expect(formatearDiaDeInstante(INSTANTE, 'UTC')).toBe('2026-10-05');
    expect(formatearDiaDeInstante(INSTANTE, 'America/Mexico_City')).toBe(
      '2026-10-04',
    );
  });

  it('un valor inválido se devuelve tal cual', () => {
    expect(formatearDiaDeInstante('x', 'UTC')).toBe('x');
  });
});
