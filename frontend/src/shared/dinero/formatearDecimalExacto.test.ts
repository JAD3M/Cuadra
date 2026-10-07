import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { formatearDecimalExacto } from './formatearDecimalExacto';

describe('formatearDecimalExacto', () => {
  it.each([
    ['0.5000', '0.50'],
    ['0.0050', '0.005'],
    ['1.2340', '1.234'],
    ['100.0000', '100.00'],
    ['0.0000', '0.00'],
    ['12.3456', '12.3456'],
    ['12', '12.00'],
    ['0.1000', '0.10'],
    ['0.3000', '0.30'],
    ['99.9999', '99.9999'],
  ])(
    '%s -> %s (recorta ceros hasta el mínimo de 2 decimales)',
    (entrada, esperado) => {
      expect(formatearDecimalExacto(entrada)).toBe(esperado);
    },
  );

  it('no redondea por encima de 4 decimales', () => {
    expect(formatearDecimalExacto('0.12345')).toBe('0.12345');
  });

  it('un cero negativo no sale con signo', () => {
    expect(formatearDecimalExacto('-0.0000')).toBe('0.00');
  });

  it.each(['abc', '1e3', '', '0x1F', ' 1', '1,5', 'NaN', 'Infinity'])(
    'devuelve null para %j',
    (entrada) => {
      expect(formatearDecimalExacto(entrada)).toBeNull();
    },
  );

  it('minimoDecimales cambia el relleno mínimo', () => {
    expect(formatearDecimalExacto('0.5000', { minimoDecimales: 0 })).toBe(
      '0.5',
    );
    expect(formatearDecimalExacto('12', { minimoDecimales: 0 })).toBe('12');
    expect(formatearDecimalExacto('0.5', { minimoDecimales: 4 })).toBe(
      '0.5000',
    );
    expect(formatearDecimalExacto('1.2340', { minimoDecimales: 3 })).toBe(
      '1.234',
    );
  });

  it('barrido enumerado: el valor de salida es igual al de entrada', () => {
    const entradas = [
      '0.0001',
      '0.00010',
      '0.00015',
      '0.12345',
      '0.99995',
      '12.34560',
      '99.99999',
      '100.00000',
      '3.14159',
      '0.10000',
      '0.30000',
      '7.00001',
    ];
    for (const entrada of entradas) {
      const salida = formatearDecimalExacto(entrada);
      expect(salida, entrada).not.toBeNull();
      expect(new Decimal(salida!).eq(new Decimal(entrada)), entrada).toBe(true);
    }
  });

  it('Decimal#toFixed() sin argumentos no usa notación exponencial entre 0 y 100 (R8)', () => {
    const muestras = [
      '0.0001',
      '0.00001',
      '0.000001',
      '0.0000001',
      '0.00000001',
      '1e-7',
      '1e-9',
      '99.9999',
      '100',
      '100.0000',
      '1e2',
      '0',
    ];
    for (const muestra of muestras) {
      expect(new Decimal(muestra).toFixed(), muestra).not.toMatch(/e/i);
    }
    // Contraste: toString sí usa exponente donde toFixed() no.
    expect(new Decimal('1e-7').toString()).toMatch(/e/i);
    expect(new Decimal('1e-7').toFixed()).toBe('0.0000001');
  });
});
