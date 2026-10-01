import { describe, expect, it } from 'vitest';
import {
  aplicarTema,
  guardarPreferencia,
  leerPreferencia,
  sistemaPrefiereOscuro,
} from './almacenamiento';
import { resolverTema } from './resolverTema';
import { CLAVE_TEMA, type Preferencia } from './tipos';
import { crearAlmacenFalso, crearMatchMediaFalso } from '@/test/fixturesTema';

describe('resolverTema', () => {
  it.each<[Preferencia, boolean, 'light' | 'dark']>([
    ['light', true, 'light'],
    ['light', false, 'light'],
    ['dark', true, 'dark'],
    ['dark', false, 'dark'],
    ['system', true, 'dark'],
    ['system', false, 'light'],
  ])('%s con sistema oscuro=%s resuelve %s', (pref, oscuro, esperado) => {
    expect(resolverTema(pref, oscuro)).toBe(esperado);
  });
});

describe('leerPreferencia', () => {
  it.each(['light', 'dark', 'system'] as const)('lee %s', (valor) => {
    expect(leerPreferencia(crearAlmacenFalso({ [CLAVE_TEMA]: valor }))).toBe(
      valor,
    );
  });

  it.each([['purple'], [''], ['LIGHT'], ['null']])(
    'un valor inválido (%j) se lee como system',
    (valor) => {
      expect(leerPreferencia(crearAlmacenFalso({ [CLAVE_TEMA]: valor }))).toBe(
        'system',
      );
    },
  );

  it('sin valor guardado es system', () => {
    expect(leerPreferencia(crearAlmacenFalso())).toBe('system');
  });

  it('si getItem lanza, es system', () => {
    expect(leerPreferencia(crearAlmacenFalso({}, { lanza: true }))).toBe(
      'system',
    );
  });

  it('sin almacenamiento disponible, es system', () => {
    expect(leerPreferencia(undefined)).toBe('system');
  });
});

describe('guardarPreferencia', () => {
  it('guarda bajo la clave del tema', () => {
    const almacen = crearAlmacenFalso();
    guardarPreferencia('dark', almacen);
    expect(almacen.valores.get(CLAVE_TEMA)).toBe('dark');
  });

  it('no lanza si el almacenamiento falla', () => {
    expect(() =>
      guardarPreferencia('dark', crearAlmacenFalso({}, { lanza: true })),
    ).not.toThrow();
  });
});

describe('sistemaPrefiereOscuro', () => {
  it('refleja matchMedia', () => {
    expect(sistemaPrefiereOscuro(crearMatchMediaFalso(true))).toBe(true);
    expect(sistemaPrefiereOscuro(crearMatchMediaFalso(false))).toBe(false);
  });

  it('sin matchMedia asume oscuro', () => {
    expect(sistemaPrefiereOscuro({} as Pick<Window, 'matchMedia'>)).toBe(true);
  });

  it('si matchMedia lanza, asume oscuro', () => {
    const ventana = {
      matchMedia: () => {
        throw new Error('no disponible');
      },
    };
    expect(sistemaPrefiereOscuro(ventana)).toBe(true);
  });
});

describe('aplicarTema', () => {
  it('escribe solo data-theme', () => {
    const raiz = document.createElement('html');
    aplicarTema('light', raiz);
    expect(raiz.getAttribute('data-theme')).toBe('light');
    expect(raiz.attributes).toHaveLength(1);
  });
});
