import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { MOTIVOS_INVALIDO } from './textos';
import fuente from './validarTolerancia.ts?raw';
import {
  esMismoValor,
  validarTolerancia,
  type MotivoInvalido,
} from './validarTolerancia';

const motivoDe = (texto: string): MotivoInvalido | null => {
  const resultado = validarTolerancia(texto);
  return resultado.ok ? null : resultado.motivo;
};

describe('validarTolerancia', () => {
  it.each(['', '   ', '\t\n'])('%j -> vacio (TOL-4.1)', (texto) => {
    expect(motivoDe(texto)).toBe('vacio');
  });

  it.each([
    '0,5',
    'abc',
    '1e1',
    '.5',
    '5.',
    '1 2',
    '0x1',
    '١٢',
    '+1',
    '1.',
    '0.5.1',
  ])('%j -> formato (TOL-4.2)', (texto) => {
    expect(motivoDe(texto)).toBe('formato');
  });

  it.each(['-1', '-0', '-0.5', '-100', '-0.12345'])(
    '%j -> rango: un negativo es de rango, no de formato (Q9)',
    (texto) => {
      expect(motivoDe(texto)).toBe('rango');
    },
  );

  it('"0.12345" -> decimales (TOL-4.3)', () => {
    expect(motivoDe('0.12345')).toBe('decimales');
  });

  it.each(['100.5', '100.0001', '1000', '101', '99999999999999999999'])(
    '%j -> rango (TOL-4.4)',
    (texto) => {
      expect(motivoDe(texto)).toBe('rango');
    },
  );

  it.each(['100.00001', '0.00001', '0.50000', '100.00000'])(
    '%j -> decimales: se cuentan los dígitos antes que el rango (TOL-4.5)',
    (texto) => {
      expect(motivoDe(texto)).toBe('decimales');
    },
  );

  it.each([
    ['0', '0'],
    ['0.0', '0.0'],
    ['0.0001', '0.0001'],
    ['99.9999', '99.9999'],
    ['100', '100'],
    ['100.0000', '100.0000'],
    [' 0.75 ', '0.75'],
    ['007', '007'],
  ])(
    '%j es válido y devuelve %j sin tocar los dígitos (TOL-4.6)',
    (texto, valor) => {
      const resultado = validarTolerancia(texto);
      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.valor).toBe(valor);
        expect(resultado.decimal.eq(new Decimal(valor))).toBe(true);
      }
    },
  );

  it('el motivo se decide en orden: vacio, formato, rango negativo, decimales, rango', () => {
    expect(motivoDe('-')).toBe('formato');
    expect(motivoDe('-1.23456')).toBe('rango');
    expect(motivoDe('1000.12345')).toBe('decimales');
  });

  it('el texto de cada motivo es el de la especificación (literales)', () => {
    expect(MOTIVOS_INVALIDO).toEqual({
      vacio: 'Escribe un valor.',
      formato: 'Escribe un número con punto decimal, por ejemplo 0.50.',
      rango: 'El valor debe estar entre 0 y 100.',
      decimales: 'Usa hasta 4 decimales.',
    });
  });
});

describe('esMismoValor', () => {
  const igual = (actual: string, escrito: string) => {
    const resultado = validarTolerancia(escrito);
    if (!resultado.ok) throw new Error(`${escrito} debía ser válido`);
    return esMismoValor(actual, resultado.decimal);
  };

  it.each([
    ['0.5000', '0.5'],
    ['0.5000', '0.50'],
    ['1.0000', '1'],
    ['0.0050', '0.005'],
    ['0.0000', '0'],
  ])('%s y %s son el mismo valor (TOL-5)', (actual, escrito) => {
    expect(igual(actual, escrito)).toBe(true);
  });

  it.each([
    ['0.5000', '0.51'],
    ['0.0050', '0.0051'],
    ['1.0000', '10'],
  ])('%s y %s son distintos', (actual, escrito) => {
    expect(igual(actual, escrito)).toBe(false);
  });

  it('TOL-5.2: "0.00500" es un error de decimales y no el mismo valor', () => {
    expect(igual('0.0050', '0.005')).toBe(true);
    expect(motivoDe('0.00500')).toBe('decimales');
  });

  it('un valor actual inválido nunca es igual', () => {
    expect(esMismoValor('abc', new Decimal(0))).toBe(false);
    expect(esMismoValor('', new Decimal(0))).toBe(false);
  });
});

describe('validarTolerancia: ningún monto pasa por flotante (TOL-12.1)', () => {
  it.each([
    ['Number', /\bNumber\b/],
    ['parseFloat', /\bparseFloat\b/],
    ['valueAsNumber', /\bvalueAsNumber\b/],
    ['toFixed', /\btoFixed\b/],
    ['+ unario', /(^|[=(,:?&|!])\s*\+\s*[\w(]/m],
  ])('el archivo no contiene %s', (_nombre, patron) => {
    expect(fuente).not.toMatch(patron);
  });
});
