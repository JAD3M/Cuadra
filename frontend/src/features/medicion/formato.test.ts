import { describe, expect, it } from 'vitest';
import { formatearPuntos, formatearTasa } from './formato';

describe('formatearTasa (historia 9.1)', () => {
  it.each([
    ['0.0400', '4.00 %'],
    ['0.5000', '50.00 %'],
    ['0.6667', '66.67 %'],
    ['0.0000', '0.00 %'],
    ['0.0005', '0.05 %'],
    ['1.0000', '100.00 %'],
  ])('%s se muestra como %s, sin pasar por flotante', (tasa, texto) => {
    expect(formatearTasa(tasa)).toBe(texto);
  });

  it('un texto que no es una tasa decimal da null', () => {
    for (const malo of ['', 'abc', '0,04', '-0.1000', '1.5000', '0.04']) {
      expect(formatearTasa(malo)).toBeNull();
    }
  });
});

describe('formatearPuntos (historia 9.5)', () => {
  it.each([
    ['0.0445', '4.45 puntos'],
    ['0.0000', '0.00 puntos'],
    ['0.9950', '99.50 puntos'],
  ])('%s se muestra como %s, sin pasar por flotante', (exceso, texto) => {
    expect(formatearPuntos(exceso)).toBe(texto);
  });

  it('un texto que no es una tasa decimal da null', () => {
    for (const malo of ['', 'abc', '0,04', '-0.1000', '1.5000', '0.04']) {
      expect(formatearPuntos(malo)).toBeNull();
    }
  });
});
