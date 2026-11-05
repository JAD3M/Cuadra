import { describe, expect, it } from 'vitest';
import { etiquetasPorCfdi } from './canceladas';

const factura = (id: string, folio: string) => ({
  id,
  serie: 'A',
  folio,
  uuidFiscal: `uuid-${id}`,
});

describe('etiquetasPorCfdi', () => {
  it('sin propuesta a la vista no inventa etiquetas', () => {
    expect(etiquetasPorCfdi(null)).toEqual({});
  });

  it('una factura: su etiqueta por id', () => {
    expect(etiquetasPorCfdi({ cfdi: factura('1', '1044') })).toEqual({
      '1': 'A-1044',
    });
  });

  it('un grupo: cada factura con su etiqueta, no solo la primera', () => {
    const a = factura('1', '1044');
    const b = factura('2', '1045');
    expect(etiquetasPorCfdi({ cfdi: a, cfdis: [a, b] })).toEqual({
      '1': 'A-1044',
      '2': 'A-1045',
    });
  });
});
