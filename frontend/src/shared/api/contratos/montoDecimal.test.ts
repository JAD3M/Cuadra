import { describe, expect, it } from 'vitest';
import { montoDecimal } from './montoDecimal';

describe('montoDecimal', () => {
  it.each(['0', '10', '0.10', '-1500.5', '1234567.80', '9007199254740993.12'])(
    'acepta la cadena decimal %s y la devuelve sin tocar',
    (valor) => {
      expect(montoDecimal.parse(valor)).toBe(valor);
    },
  );

  it.each([12.5, 0, 1e21, null, undefined, true, ['1'], {}])(
    'rechaza un valor que no es cadena (%s), en especial un número JSON',
    (valor) => {
      expect(montoDecimal.safeParse(valor).success).toBe(false);
    },
  );

  it.each([
    '',
    ' ',
    'abc',
    '1e3',
    '0x1F',
    'NaN',
    'Infinity',
    '1,234',
    '+5',
    '--1',
    '1.',
    '.5',
  ])('rechaza la cadena %j', (valor) => {
    expect(montoDecimal.safeParse(valor).success).toBe(false);
  });
});
