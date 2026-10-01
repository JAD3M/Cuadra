import { describe, expect, it } from 'vitest';
import { ELEMENTOS_NAV, elementoActivo } from './navegacion';

describe('configuración de navegación', () => {
  it('define los cuatro elementos en orden', () => {
    expect(ELEMENTOS_NAV.map((e) => e.etiqueta)).toEqual([
      'Bandeja',
      'Cargas',
      'Bitácora',
      'Tolerancia',
    ]);
  });

  it.each([
    ['/bandeja', 'Bandeja'],
    ['/casos/abc', 'Bandeja'],
    ['/casos', 'Bandeja'],
    ['/cargas', 'Cargas'],
    ['/bitacora', 'Bitácora'],
    ['/tolerancia', 'Tolerancia'],
  ])('%s activa %s', (ruta, etiqueta) => {
    expect(elementoActivo(ruta)?.etiqueta).toBe(etiqueta);
  });

  it.each(['/', '/login', '/empresa', '/casosx', '/cargasx', '/nada'])(
    '%s no activa ningún elemento',
    (ruta) => {
      expect(elementoActivo(ruta)).toBeUndefined();
    },
  );
});
