// src/bancos/cuadre-saldos.spec.ts
import { cuadrarSaldos } from './cuadre-saldos';

describe('cuadrarSaldos', () => {
  it('cuadra cuando inicial + movimientos es igual al final', () => {
    const r = cuadrarSaldos({
      saldoInicial: '1000.00',
      saldoFinal: '1500.50',
      montos: ['500.50'],
    });
    expect(r).toEqual({ cuadra: true });
  });

  it('no cuadra por un centavo y reporta esperado y diferencia', () => {
    const r = cuadrarSaldos({
      saldoInicial: '1000.00',
      saldoFinal: '1500.51',
      montos: ['500.50'],
    });
    expect(r).toEqual({
      cuadra: false,
      saldoEsperado: '1500.5',
      diferencia: '0.01',
    });
  });

  it('diferencia negativa cuando el final declarado es menor al esperado', () => {
    const r = cuadrarSaldos({
      saldoInicial: '1000.00',
      saldoFinal: '1500.49',
      montos: ['500.50'],
    });
    expect(r).toEqual({
      cuadra: false,
      saldoEsperado: '1500.5',
      diferencia: '-0.01',
    });
  });

  it('cuadra con abonos y cargos mezclados', () => {
    const r = cuadrarSaldos({
      saldoInicial: '2500.00',
      saldoFinal: '1349.75',
      montos: ['1000.00', '-250.25', '-900.00', '-1000.00', '0.00'],
    });
    expect(r.cuadra).toBe(true);
  });

  it('sin movimientos exige inicial igual a final', () => {
    expect(
      cuadrarSaldos({ saldoInicial: '10.00', saldoFinal: '10', montos: [] })
        .cuadra,
    ).toBe(true);
    expect(
      cuadrarSaldos({ saldoInicial: '10.00', saldoFinal: '10.01', montos: [] }),
    ).toEqual({ cuadra: false, saldoEsperado: '10', diferencia: '0.01' });
  });

  it('no sufre errores de flotante (0.1 + 0.2 = 0.3)', () => {
    const r = cuadrarSaldos({
      saldoInicial: '0.1',
      saldoFinal: '0.3',
      montos: ['0.2'],
    });
    expect(r.cuadra).toBe(true);
  });

  it('maneja montos enormes y muchos decimales sin perder precisión', () => {
    const r = cuadrarSaldos({
      saldoInicial: '123456789012345678.123456789',
      saldoFinal: '123456789012345679.223456789',
      montos: ['1.1'],
    });
    expect(r.cuadra).toBe(true);

    const mal = cuadrarSaldos({
      saldoInicial: '123456789012345678.123456789',
      saldoFinal: '123456789012345679.223456790',
      montos: ['1.1'],
    });
    expect(mal).toEqual({
      cuadra: false,
      saldoEsperado: '123456789012345679.223456789',
      diferencia: '0.000000001',
    });
  });

  it('acepta saldos negativos', () => {
    const r = cuadrarSaldos({
      saldoInicial: '-100.00',
      saldoFinal: '-350.00',
      montos: ['-300.00', '50.00'],
    });
    expect(r.cuadra).toBe(true);
  });

  it('rechaza texto decimal inválido en cualquier campo en lugar de dar cuadra', () => {
    expect(() =>
      cuadrarSaldos({ saldoInicial: 'abc', saldoFinal: '1', montos: [] }),
    ).toThrow('no es un monto decimal válido');
    expect(() =>
      cuadrarSaldos({ saldoInicial: '1', saldoFinal: '1e3', montos: [] }),
    ).toThrow('no es un monto decimal válido');
    expect(() =>
      cuadrarSaldos({ saldoInicial: '1', saldoFinal: '1', montos: ['1,5'] }),
    ).toThrow('no es un monto decimal válido');
  });
});
