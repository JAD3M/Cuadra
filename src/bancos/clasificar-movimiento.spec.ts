import { clasificarMovimiento } from './clasificar-movimiento';

describe('clasificarMovimiento (6.3, S2)', () => {
  it('un cargo con «comisión» en la descripción es comisión', () => {
    expect(
      clasificarMovimiento('COMISION POR MANEJO DE CUENTA', '-250.0000'),
    ).toBe('comision');
  });

  it('ignora acentos y mayúsculas', () => {
    expect(clasificarMovimiento('Comisión SPEI', '-5.80')).toBe('comision');
  });

  it('un abono con «comisión» no es comisión (no es un cobro del banco)', () => {
    expect(clasificarMovimiento('DEVOLUCION COMISION', '250.00')).toBeNull();
  });

  it.each([
    'PAGO PARCIALIDAD 2/6',
    'Pago parcial factura A1001',
    'ABONO PARCIAL CLIENTE',
  ])('un abono con «%s» es parcialidad', (descripcion) => {
    expect(clasificarMovimiento(descripcion, '1160.00')).toBe('parcialidad');
  });

  it('un cargo con «parcialidad» no es parcialidad (es dinero que sale)', () => {
    expect(clasificarMovimiento('PARCIALIDAD CREDITO', '-1160.00')).toBeNull();
  });

  it('cualquier otro movimiento queda sin clase', () => {
    expect(clasificarMovimiento('SPEI RECIBIDO A1001', '1160.00')).toBeNull();
    expect(clasificarMovimiento('PAGO PROVEEDOR', '-500.00')).toBeNull();
  });

  it('el monto se lee como texto con signo, sin pasar por flotante', () => {
    expect(clasificarMovimiento('COMISION', '-0.0001')).toBe('comision');
    expect(clasificarMovimiento('COMISION', '0.0001')).toBeNull();
  });
});
