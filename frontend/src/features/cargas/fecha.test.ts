import { describe, expect, it } from 'vitest';
import { formatearInstante } from '@/features/caso/fecha';
import { itemCarga } from '@/test/fixturesCargas';

// M6: la fecha de la tabla de cargas es `YYYY-MM-DD HH:mm` en la zona del
// navegador y sale de `formatearInstante` (la del detalle del caso), sin
// aritmética de coma flotante.

describe('fecha de una carga (M6)', () => {
  it('con una zona dada da YYYY-MM-DD HH:mm', () => {
    expect(
      formatearInstante('2026-10-05T10:00:00.000Z', 'America/Mexico_City'),
    ).toBe('2026-10-05 04:00');
    expect(formatearInstante('2026-10-05T10:00:00.000Z', 'UTC')).toBe(
      '2026-10-05 10:00',
    );
  });

  it('sin zona usa la del navegador', () => {
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { createdAt } = itemCarga(7);
    expect(formatearInstante(createdAt)).toBe(
      formatearInstante(createdAt, zona),
    );
    expect(formatearInstante(createdAt)).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    );
  });
});
