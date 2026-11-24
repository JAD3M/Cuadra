import { describe, expect, it } from 'vitest';
import { diaCorto, etiquetaMes, instanteCorto, porcentaje } from './formato';

describe('formato de la muestra', () => {
  it.each([
    ['2026-09', 'septiembre 2026'],
    ['2026-01', 'enero 2026'],
    ['2025-12', 'diciembre 2025'],
  ])('etiquetaMes(%s) = %s', (mes, texto) => {
    expect(etiquetaMes(mes)).toBe(texto);
  });

  it('etiquetaMes devuelve tal cual lo que no es AAAA-MM', () => {
    expect(etiquetaMes('2026-13')).toBe('2026-13');
    expect(etiquetaMes('x')).toBe('x');
  });

  it('diaCorto separa el texto sin pasar por Date', () => {
    expect(diaCorto('2026-09-12')).toBe('12 sep 2026');
    expect(diaCorto('2026-01-01')).toBe('1 ene 2026');
    expect(diaCorto('no es fecha')).toBe('no es fecha');
  });

  it('instanteCorto muestra día, mes, año y hora en la zona dada', () => {
    expect(
      instanteCorto('2026-11-22T16:42:00.000Z', 'America/Mexico_City'),
    ).toBe('22 nov 2026, 10:42');
    expect(instanteCorto('basura')).toBe('basura');
  });

  it('porcentaje redondea enteros y no pasa de 100', () => {
    expect(porcentaje(12, 40)).toBe(30);
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(0, 0)).toBe(0);
    expect(porcentaje(5, 3)).toBe(100);
  });
});
