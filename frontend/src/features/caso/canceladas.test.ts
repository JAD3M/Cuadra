import { describe, expect, it } from 'vitest';
import { etiquetasCanceladas } from './canceladas';

const cfdi = (folio: string, estado: string) => ({
  uuidFiscal: `A1B2C3D4-0000-4000-8000-${folio.padStart(12, '0')}`,
  serie: 'A',
  folio,
  estado,
});

describe('etiquetasCanceladas', () => {
  it('sin lista de facturas usa la única factura del caso', () => {
    expect(etiquetasCanceladas({ cfdi: cfdi('1', 'cancelada') })).toEqual([
      'A-1',
    ]);
    expect(etiquetasCanceladas({ cfdi: cfdi('1', 'abierta') })).toEqual([]);
  });

  it('en un grupo nombra solo las canceladas, no la primera por defecto', () => {
    const a = cfdi('1', 'abierta');
    const b = cfdi('2', 'cancelada');
    const c = cfdi('3', 'conciliada');
    expect(etiquetasCanceladas({ cfdi: a, cfdis: [a, b, c] })).toEqual(['A-2']);
  });

  it('en un grupo con varias canceladas las nombra todas, en orden', () => {
    const a = cfdi('1', 'cancelada');
    const b = cfdi('2', 'abierta');
    const c = cfdi('3', 'cancelada');
    expect(etiquetasCanceladas({ cfdi: a, cfdis: [a, b, c] })).toEqual([
      'A-1',
      'A-3',
    ]);
  });

  it('si la lista de facturas viene vacía recurre a cfdi', () => {
    expect(
      etiquetasCanceladas({ cfdi: cfdi('7', 'cancelada'), cfdis: [] }),
    ).toEqual(['A-7']);
  });

  it('con datos incoherentes (ninguna cancelada) devuelve vacío: nunca inventa una', () => {
    const a = cfdi('1', 'abierta');
    expect(etiquetasCanceladas({ cfdi: a, cfdis: [a] })).toEqual([]);
  });
});
