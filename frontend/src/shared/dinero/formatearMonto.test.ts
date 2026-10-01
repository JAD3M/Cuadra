import { describe, expect, it } from 'vitest';
import { formatearMonto } from './formatearMonto';
import { PATRON_DECIMAL, parsearMonto } from './parsearMonto';

const texto = (valor: string, moneda?: boolean) =>
  formatearMonto(valor, { moneda })?.texto ?? null;

describe('formatearMonto', () => {
  it.each([
    ['1234567.8', '$1,234,567.80'],
    ['1234567.5', '$1,234,567.50'],
    ['0.10', '$0.10'],
    ['9007199254740993.12', '$9,007,199,254,740,993.12'],
    ['0', '$0.00'],
    ['18560.40', '$18,560.40'],
    ['100', '$100.00'],
    ['999', '$999.00'],
    ['1000', '$1,000.00'],
    ['1234567890123456789012345', '$1,234,567,890,123,456,789,012,345.00'],
  ])('%s -> %s', (entrada, esperado) => {
    expect(texto(entrada)).toBe(esperado);
  });

  it('redondea half up a dos decimales (modo documentado)', () => {
    expect(texto('10.005')).toBe('$10.01');
    expect(texto('0.005')).toBe('$0.01');
    expect(texto('0.004')).toBe('$0.00');
    expect(texto('2.675')).toBe('$2.68');
    expect(texto('1.99999999999999999999')).toBe('$2.00');
    expect(texto('1234.123456789')).toBe('$1,234.12');
  });

  it('el redondeo half up también aplica al valor absoluto en negativos', () => {
    expect(texto('-10.005')).toBe('−$10.01');
  });

  it('antepone el signo menos U+2212 antes del peso en negativos', () => {
    expect(texto('-1234.5')).toBe('−$1,234.50');
    expect(texto('-1500.5')).toBe('−$1,500.50');
    expect(formatearMonto('-1500.5')?.negativo).toBe(true);
    expect(texto('-1500.5')).not.toContain('-');
  });

  it('nunca produce cero negativo', () => {
    for (const cero of ['-0.001', '-0', '-0.00', '-0.004']) {
      expect(formatearMonto(cero)).toEqual({ texto: '$0.00', negativo: false });
    }
  });

  it('un negativo que redondea a un centavo conserva el signo', () => {
    expect(texto('-0.005')).toBe('−$0.01');
  });

  it('moneda:false omite el signo de peso y conserva el menos', () => {
    expect(texto('1234.5', false)).toBe('1,234.50');
    expect(texto('-1234.5', false)).toBe('−1,234.50');
    expect(texto('0.001', false)).toBe('0.00');
  });

  it('no usa notación exponencial con magnitudes extremas', () => {
    const grande = `1${'0'.repeat(30)}`;
    expect(texto(grande)).toBe(`$1,${'000,'.repeat(9)}000.00`);
    expect(texto('0.0000000000000000000001')).toBe('$0.00');
  });

  it.each([
    '',
    ' ',
    'abc',
    '1e3',
    '1E3',
    '0x1F',
    'NaN',
    'Infinity',
    '-Infinity',
    '1,234',
    '1,234.50',
    '+5',
    '--1',
    '1.',
    '.5',
    '1.2.3',
    ' 12.5',
    '12.5 ',
    '12.5\n',
    '$12.50',
    '1_000',
    '١٢٣',
  ])('rechaza %j devolviendo null', (invalido) => {
    expect(formatearMonto(invalido)).toBeNull();
  });

  it('rechaza valores que no son cadena aunque se fuerce el tipo', () => {
    expect(formatearMonto(12.5 as unknown as string)).toBeNull();
    expect(formatearMonto(null as unknown as string)).toBeNull();
    expect(formatearMonto(undefined as unknown as string)).toBeNull();
  });
});

describe('parsearMonto', () => {
  it('devuelve un Decimal que conserva toda la precisión', () => {
    expect(parsearMonto('9007199254740993.12')?.toFixed()).toBe(
      '9007199254740993.12',
    );
  });

  it('devuelve null para lo que decimal.js aceptaría pero no es un monto', () => {
    for (const raro of ['0x1F', '1e3', 'NaN', 'Infinity']) {
      expect(parsearMonto(raro)).toBeNull();
    }
  });
});

describe('PATRON_DECIMAL', () => {
  it('acepta decimales planos con signo opcional', () => {
    for (const ok of ['0', '-0', '12', '-12.5', '0.10', '123456789.123456']) {
      expect(PATRON_DECIMAL.test(ok)).toBe(true);
    }
  });

  it('rechaza exponentes, separadores, prefijos y vacíos', () => {
    for (const mal of ['', '1e3', '1,2', '+1', '.5', '5.', 'a']) {
      expect(PATRON_DECIMAL.test(mal)).toBe(false);
    }
  });

  it('no es global: test() repetido no depende del estado', () => {
    expect(PATRON_DECIMAL.global).toBe(false);
    expect(PATRON_DECIMAL.test('1')).toBe(true);
    expect(PATRON_DECIMAL.test('1')).toBe(true);
  });
});
