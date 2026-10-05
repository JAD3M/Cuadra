import { describe, expect, it } from 'vitest';
import { etiquetaCfdi } from './etiquetaCfdi';

const UUID = 'A1B2C3D4-0000-4000-8000-000000000001';

describe('etiquetaCfdi', () => {
  it('serie y folio se unen con guion', () => {
    expect(etiquetaCfdi({ uuidFiscal: UUID, serie: 'A', folio: '1042' })).toBe(
      'A-1042',
    );
  });

  it('solo folio', () => {
    expect(etiquetaCfdi({ uuidFiscal: UUID, serie: null, folio: '1042' })).toBe(
      '1042',
    );
  });

  it('solo serie', () => {
    expect(etiquetaCfdi({ uuidFiscal: UUID, serie: 'A', folio: null })).toBe(
      'A',
    );
  });

  it('sin serie ni folio usa los primeros 8 caracteres del UUID fiscal', () => {
    expect(etiquetaCfdi({ uuidFiscal: UUID, serie: null, folio: null })).toBe(
      'A1B2C3D4',
    );
  });

  it('serie y folio en blanco se tratan como ausentes', () => {
    expect(etiquetaCfdi({ uuidFiscal: UUID, serie: ' ', folio: '' })).toBe(
      'A1B2C3D4',
    );
  });

  it('sin propuesta es un guion', () => {
    expect(etiquetaCfdi(null)).toBe('—');
  });
});
