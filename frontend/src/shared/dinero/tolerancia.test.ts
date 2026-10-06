import { describe, expect, it } from 'vitest';
import { dentroDeTolerancia, proporcionTolerancia } from './tolerancia';

describe('dentroDeTolerancia', () => {
  it('el límite exacto está dentro y un décimo de milésimo más, fuera', () => {
    expect(dentroDeTolerancia('0.5000', '0.5000')).toBe(true);
    expect(dentroDeTolerancia('0.5001', '0.5000')).toBe(false);
  });

  it('usa el valor absoluto de la diferencia', () => {
    expect(dentroDeTolerancia('-0.3000', '0.5000')).toBe(true);
    expect(dentroDeTolerancia('-0.5001', '0.5000')).toBe(false);
    expect(dentroDeTolerancia('40.0000', '0.5000')).toBe(false);
  });

  it('con tolerancia cero solo la diferencia exacta cero está dentro', () => {
    expect(dentroDeTolerancia('0.0000', '0.0000')).toBe(true);
    expect(dentroDeTolerancia('0.0001', '0.0000')).toBe(false);
  });

  it('compara debajo del centavo sin redondear', () => {
    expect(dentroDeTolerancia('0.0040', '0.0030')).toBe(false);
    expect(dentroDeTolerancia('0.0040', '0.0040')).toBe(true);
  });

  it('es exacta con diez dígitos enteros', () => {
    expect(dentroDeTolerancia('9999999999.0000', '9999999999.0000')).toBe(true);
    expect(dentroDeTolerancia('9999999999.0001', '9999999999.0000')).toBe(
      false,
    );
  });

  it('una diferencia ausente o inválida nunca está dentro', () => {
    expect(dentroDeTolerancia(null, '0.5000')).toBe(false);
    expect(dentroDeTolerancia(undefined, '0.5000')).toBe(false);
    expect(dentroDeTolerancia('abc', '0.5000')).toBe(false);
    expect(dentroDeTolerancia('0.1000', 'abc')).toBe(false);
  });
});

describe('proporcionTolerancia', () => {
  it('es el porcentaje entero de la diferencia sobre la tolerancia', () => {
    expect(proporcionTolerancia('0.4000', '0.5000')).toBe('80');
    expect(proporcionTolerancia('-0.2500', '0.5000')).toBe('50');
    expect(proporcionTolerancia('0.0000', '0.5000')).toBe('0');
    expect(proporcionTolerancia('0.5000', '0.5000')).toBe('100');
  });

  it('redondea medio hacia arriba', () => {
    expect(proporcionTolerancia('0.0025', '0.5000')).toBe('1');
    expect(proporcionTolerancia('0.0024', '0.5000')).toBe('0');
  });

  it('nunca pasa de 100', () => {
    expect(proporcionTolerancia('40.0000', '0.5000')).toBe('100');
  });

  it('con tolerancia cero es 0 si no hay diferencia y 100 si la hay', () => {
    expect(proporcionTolerancia('0.0000', '0.0000')).toBe('0');
    expect(proporcionTolerancia('0.0100', '0.0000')).toBe('100');
  });

  it('un valor ausente o inválido es 0', () => {
    expect(proporcionTolerancia(null, '0.5000')).toBe('0');
    expect(proporcionTolerancia('abc', '0.5000')).toBe('0');
    expect(proporcionTolerancia('0.4000', 'abc')).toBe('0');
  });
});
