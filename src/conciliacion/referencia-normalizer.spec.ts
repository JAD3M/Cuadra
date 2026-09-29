// src/conciliacion/referencia-normalizer.spec.ts
import { FIXTURES_REFERENCIA } from './referencia-fixtures';
import {
  clavesDeCfdi,
  esReferenciaUsable,
  normalizarReferencia,
} from './referencia-normalizer';

describe('normalizarReferencia (RN-1)', () => {
  it.each(FIXTURES_REFERENCIA)('%j -> %j', (entrada, esperado) => {
    expect(normalizarReferencia(entrada)).toBe(esperado);
  });

  it('trata undefined como vacío', () => {
    expect(normalizarReferencia(undefined)).toBeNull();
  });
});

describe('clavesDeCfdi (RN-2)', () => {
  it('da serie+folio y folio solo', () => {
    expect(clavesDeCfdi({ serie: 'A', folio: '0001001' })).toEqual([
      'A1001',
      '1001',
    ]);
  });

  it('conserva los dígitos de una serie que termina en número', () => {
    expect(clavesDeCfdi({ serie: 'A1', folio: '0005' })).toEqual(['A15']);
  });

  it('sin serie repite la llave una sola vez', () => {
    expect(clavesDeCfdi({ serie: null, folio: '0001001' })).toEqual(['1001']);
    expect(clavesDeCfdi({ serie: '', folio: '1001' })).toEqual(['1001']);
  });

  it('sin folio no hay llaves, y el UUID nunca lo es', () => {
    expect(clavesDeCfdi({ serie: 'A', folio: null })).toEqual([]);
    expect(clavesDeCfdi({ serie: 'A', folio: '  ' })).toEqual([]);
  });
});

describe('largo mínimo (RN-3)', () => {
  it.each(['12', 'A-1', '0000012'])('%s no es usable', (texto) => {
    expect(esReferenciaUsable(normalizarReferencia(texto))).toBe(false);
  });

  it('A12 sí es usable', () => {
    expect(esReferenciaUsable(normalizarReferencia('A12'))).toBe(true);
  });

  it('descarta las llaves cortas del CFDI', () => {
    expect(clavesDeCfdi({ serie: 'A', folio: '1' })).toEqual([]);
    expect(clavesDeCfdi({ serie: 'AB', folio: '1' })).toEqual(['AB1']);
  });
});
