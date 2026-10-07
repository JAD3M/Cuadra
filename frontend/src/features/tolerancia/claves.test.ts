import { describe, expect, it } from 'vitest';
import { clavesTolerancia, useEpoca } from './claves';

describe('claves de la tolerancia', () => {
  it('la época va en la posición 1 y no hay token en ninguna clave', () => {
    expect(clavesTolerancia.todas(3)).toEqual(['tolerancia', 3]);
    expect(clavesTolerancia.valor(3)).toEqual(['tolerancia', 3, 'valor']);
    expect(clavesTolerancia.cambios(3)).toEqual(['tolerancia', 3, 'cambios']);
  });

  it('todas(e) es prefijo de valor y cambios de esa época', () => {
    const prefijo = clavesTolerancia.todas(4);
    expect(clavesTolerancia.valor(4).slice(0, 2)).toEqual(prefijo);
    expect(clavesTolerancia.cambios(4).slice(0, 2)).toEqual(prefijo);
  });

  it('son estables y distintas entre sí', () => {
    expect(clavesTolerancia.valor(1)).toEqual(clavesTolerancia.valor(1));
    expect(clavesTolerancia.valor(1)).not.toEqual(clavesTolerancia.cambios(1));
  });

  it('otra época cambia toda clave: nada se comparte entre épocas', () => {
    expect(clavesTolerancia.valor(2)).not.toEqual(clavesTolerancia.valor(1));
    expect(clavesTolerancia.cambios(2)).not.toEqual(
      clavesTolerancia.cambios(1),
    );
  });

  it('sin sesión lista la época es null y la clave lo conserva', () => {
    expect(clavesTolerancia.valor(null)).toEqual(['tolerancia', null, 'valor']);
  });

  it('reexporta el hook de época de la bandeja', () => {
    expect(typeof useEpoca).toBe('function');
  });
});
