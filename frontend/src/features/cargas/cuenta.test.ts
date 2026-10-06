import { describe, expect, it } from 'vitest';
import { pareceCuentaCompleta } from './cuenta';

describe('pareceCuentaCompleta (M5)', () => {
  it.each([
    ['012345678901234567', true],
    ['1234567890', true],
    ['abc 1234567890 xyz', true],
  ])('%s: 10 o más dígitos seguidos', (valor, esperado) => {
    expect(pareceCuentaCompleta(valor)).toBe(esperado);
  });

  it.each([
    ['0123-4567-8901', false],
    ['0123 4567 8901', false],
    ['****1234', false],
    ['123456789', false],
    ['', false],
  ])('%s: no son 10 dígitos consecutivos', (valor, esperado) => {
    expect(pareceCuentaCompleta(valor)).toBe(esperado);
  });
});
