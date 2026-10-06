import { describe, expect, it } from 'vitest';
import { formatearPeso } from './peso';
import fuente from './peso.ts?raw';

const KB = 1024;
const MB = 1024 * 1024;

describe('formatearPeso', () => {
  it.each([
    [0, '0 B'],
    [1, '1 B'],
    [1023, '1023 B'],
  ])('%i bytes se muestran en bytes: %s', (bytes, esperado) => {
    expect(formatearPeso(bytes)).toBe(esperado);
  });

  it.each([
    [KB, '1 KB'],
    [14 * KB, '14 KB'],
    [14 * KB + 511, '14 KB'],
    [14 * KB + 512, '15 KB'],
    [186 * KB, '186 KB'],
  ])('%i bytes se redondean a KB enteros: %s', (bytes, esperado) => {
    expect(formatearPeso(bytes)).toBe(esperado);
  });

  it.each([
    [MB, '1.0 MB'],
    [3565158, '3.4 MB'], // 3.4 MB del mockup (3.4 * 1048576 = 3565158.4)
    [2 * MB, '2.0 MB'],
    [10.4 * MB, '10.4 MB'],
    [50 * MB, '50.0 MB'],
  ])('%d bytes llevan décimas enteras en MB: %s', (bytes, esperado) => {
    expect(formatearPeso(Math.round(bytes))).toBe(esperado);
  });

  it('redondea las décimas al más cercano, sin pasar por flotante', () => {
    // 0.05 MB exactos (52428.8 bytes): 1 MB + 52429 bytes sube a 1.1 MB.
    expect(formatearPeso(MB + 52_428)).toBe('1.0 MB');
    expect(formatearPeso(MB + 52_429)).toBe('1.1 MB');
  });

  it('un tamaño que redondea a 1024 KB pasa a MB en vez de mostrar 1024 KB', () => {
    expect(formatearPeso(MB - 1)).toBe('1.0 MB');
  });

  it('rechaza lo que no es un entero no negativo', () => {
    expect(() => formatearPeso(-1)).toThrow(RangeError);
    expect(() => formatearPeso(1.5)).toThrow(RangeError);
    expect(() => formatearPeso(Number.NaN)).toThrow(RangeError);
  });

  it('el código no usa Date ni aritmética de coma flotante', () => {
    const codigo = fuente
      .split('\n')
      .filter((linea) => !linea.trim().startsWith('//'))
      .join('\n');
    expect(codigo).not.toMatch(/\bDate\b/);
    expect(codigo).not.toMatch(/\bIntl\b|toFixed|parseFloat|toLocaleString/);
    expect(codigo).not.toMatch(/Math\.(round|floor|ceil|trunc)/);
  });
});
