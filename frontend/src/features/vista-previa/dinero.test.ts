import { describe, expect, it } from 'vitest';
import { montoConSigno, saldoVista } from './dinero';

describe('montoConSigno', () => {
  it.each([
    ['1500.0000', '+1,500.00', 'abono'],
    ['-250.0000', '-250.00', 'cargo'],
    ['-3820.40', '-3,820.40', 'cargo'],
    ['0.5', '+0.50', 'abono'],
    ['9007199254740993.12', '+9,007,199,254,740,993.12', 'abono'],
    ['-9007199254740993.12', '-9,007,199,254,740,993.12', 'cargo'],
  ])('%s -> %s (%s)', (entrada, texto, tipo) => {
    expect(montoConSigno(entrada)).toEqual({ texto, tipo });
  });

  it('el cero y lo que redondea a cero no llevan signo', () => {
    expect(montoConSigno('0.0000')).toEqual({ texto: '0.00', tipo: 'cero' });
    expect(montoConSigno('-0.001')).toEqual({ texto: '0.00', tipo: 'cero' });
  });

  it('un texto que no es decimal no se inventa: guion', () => {
    expect(montoConSigno('abc')).toEqual({ texto: '—', tipo: 'cero' });
  });
});

describe('saldoVista', () => {
  it('da miles y dos decimales sin pasar por flotante', () => {
    expect(saldoVista('10000.0000')).toBe('10,000.00');
    expect(saldoVista('9007199254740993.12')).toBe('9,007,199,254,740,993.12');
  });

  it('un saldo negativo lleva «-»', () => {
    expect(saldoVista('-1250.5')).toBe('-1,250.50');
  });

  it('null o inválido -> «—»', () => {
    expect(saldoVista(null)).toBe('—');
    expect(saldoVista('x')).toBe('—');
  });
});
