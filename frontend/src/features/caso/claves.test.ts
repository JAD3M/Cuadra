import { describe, expect, it } from 'vitest';
import { clavesCaso } from './claves';

describe('claves del caso', () => {
  it('llevan la época en la posición 1 y ningún token', () => {
    expect(clavesCaso.todas(3)[1]).toBe(3);
    expect(clavesCaso.detalle(3, 'm-1')[1]).toBe(3);
    expect(clavesCaso.historial(3, 'c-1')[1]).toBe(3);
    expect(JSON.stringify(clavesCaso.detalle(3, 'm-1'))).not.toMatch(
      /token|bearer/i,
    );
  });

  it('todas(e) es prefijo del detalle y del historial de esa época', () => {
    const prefijo = clavesCaso.todas(4);
    expect(clavesCaso.detalle(4, 'm-1').slice(0, 2)).toEqual(prefijo);
    expect(clavesCaso.historial(4, 'c-1').slice(0, 2)).toEqual(prefijo);
  });

  it('son estables y distintas por época e id', () => {
    expect(clavesCaso.detalle(1, 'a')).toEqual(clavesCaso.detalle(1, 'a'));
    expect(clavesCaso.detalle(2, 'a')).not.toEqual(clavesCaso.detalle(1, 'a'));
    expect(clavesCaso.detalle(1, 'b')).not.toEqual(clavesCaso.detalle(1, 'a'));
    expect(clavesCaso.historial(1, 'a')).not.toEqual(
      clavesCaso.detalle(1, 'a'),
    );
  });

  it('el prefijo de una época no alcanza las claves de otra', () => {
    expect(clavesCaso.todas(1)).not.toEqual(
      clavesCaso.detalle(2, 'a').slice(0, 2),
    );
  });
});
