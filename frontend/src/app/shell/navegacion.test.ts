import type { Permiso } from '@/shared/dominio';
import { describe, expect, it } from 'vitest';
import { ELEMENTOS_NAV, elementoActivo, elementosVisibles } from './navegacion';

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

  it('cada elemento declara el permiso de sección que lo muestra', () => {
    expect(ELEMENTOS_NAV.map((e) => [e.clave, e.permiso])).toEqual([
      ['bandeja', 'bandeja.ver'],
      ['cargas', 'cargas.ver'],
      ['bitacora', 'bitacora.ver'],
      ['tolerancia', 'tolerancia.ver'],
    ]);
  });

  it.each([
    [
      ['bandeja.ver', 'bitacora.ver'],
      ['Bandeja', 'Bitácora'],
    ],
    [
      ['bandeja.ver', 'cargas.ver', 'tolerancia.ver', 'bitacora.ver'],
      ['Bandeja', 'Cargas', 'Bitácora', 'Tolerancia'],
    ],
    [['cargas.cargar', 'conciliaciones.resolver'], []],
    [[], []],
  ])('con %j el menú es %j, en el orden fijo', (capacidades, etiquetas) => {
    expect(
      elementosVisibles(capacidades as Permiso[]).map((e) => e.etiqueta),
    ).toEqual(etiquetas);
  });
});
