import { describe, expect, it } from 'vitest';
import {
  contarMonedaNoSoportada,
  etiquetaMonedaNoSoportada,
  LEYENDA_MONEDA_NO_SOPORTADA,
  notaMonedaHistorial,
} from './moneda';

describe('etiquetaMonedaNoSoportada', () => {
  it('lleva el ⚠ y el código de la moneda', () => {
    expect(etiquetaMonedaNoSoportada('USD')).toBe(
      '⚠ Moneda no soportada · USD',
    );
    expect(etiquetaMonedaNoSoportada('EUR')).toBe(
      '⚠ Moneda no soportada · EUR',
    );
  });
});

describe('LEYENDA_MONEDA_NO_SOPORTADA', () => {
  it('es el texto del mockup', () => {
    expect(LEYENDA_MONEDA_NO_SOPORTADA).toBe(
      '⚠ Se guardó, pero Cuadra no concilia monedas distintas de MXN.',
    );
  });
});

describe('contarMonedaNoSoportada', () => {
  it('cuenta solo los archivos con monedaNoSoportada', () => {
    expect(
      contarMonedaNoSoportada([
        { archivo: 'a.xml', resultado: 'nuevo' },
        {
          archivo: 'b.xml',
          resultado: 'nuevo',
          moneda: 'USD',
          monedaNoSoportada: true,
        },
        {
          archivo: 'c.xml',
          resultado: 'ya_existia',
          moneda: 'EUR',
          monedaNoSoportada: true,
        },
        { archivo: 'd.xml', resultado: 'error', motivo: 'XML mal formado' },
        { fila: 3, resultado: 'error', motivo: 'Monto inválido' },
      ]),
    ).toBe(2);
  });

  it('una lista vacía o sin marcas da 0', () => {
    expect(contarMonedaNoSoportada([])).toBe(0);
    expect(
      contarMonedaNoSoportada([{ archivo: 'a.xml', resultado: 'nuevo' }]),
    ).toBe(0);
  });
});

describe('notaMonedaHistorial', () => {
  it('lleva el ⚠, la cuenta y la misma frase en singular y plural', () => {
    expect(notaMonedaHistorial(1)).toBe('⚠ 1 con moneda no soportada');
    expect(notaMonedaHistorial(2)).toBe('⚠ 2 con moneda no soportada');
  });

  it('con 0 no hay nota', () => {
    expect(notaMonedaHistorial(0)).toBeNull();
  });
});
