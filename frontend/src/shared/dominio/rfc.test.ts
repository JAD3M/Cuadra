import { describe, expect, it } from 'vitest';
import { FORMATO_RFC, normalizarRfc, validarRfc } from './rfc';

describe('normalizarRfc', () => {
  it('pasa a mayúsculas y quita todo espacio en blanco', () => {
    expect(normalizarRfc('  fau 210215\tqk4 \n')).toBe('FAU210215QK4');
  });

  it('conserva la Ñ y el &', () => {
    expect(normalizarRfc('ñu&210215ab3')).toBe('ÑU&210215AB3');
  });
});

describe('validarRfc', () => {
  it('acepta una persona moral y una física con homoclave', () => {
    expect(validarRfc('FAU210215QK4')).toEqual({ valido: true });
    expect(validarRfc('PEGJ800101AB3')).toEqual({ valido: true });
  });

  it('rechaza un formato incompleto con motivo `formato`', () => {
    expect(validarRfc('FAU2102')).toMatchObject({
      valido: false,
      motivo: 'formato',
    });
  });

  it('rechaza una fecha imposible', () => {
    expect(validarRfc('FAU211315QK4')).toMatchObject({ motivo: 'formato' });
    expect(validarRfc('FAU210232QK4')).toMatchObject({ motivo: 'formato' });
  });

  it('rechaza los dos RFC genéricos con motivo `generico`', () => {
    expect(validarRfc('XAXX010101000')).toMatchObject({
      valido: false,
      motivo: 'generico',
    });
    expect(validarRfc('XEXX010101000')).toMatchObject({
      valido: false,
      motivo: 'generico',
    });
  });

  it('el formato exige mayúsculas: la normalización va antes', () => {
    expect(FORMATO_RFC.test('fau210215qk4')).toBe(false);
  });
});
