import { describe, expect, it } from 'vitest';
import { puede } from './permisos';

describe('puede', () => {
  it('es verdadero solo si la lista de capacidades trae el permiso', () => {
    const capacidades = ['bandeja.ver', 'conciliaciones.resolver'] as const;
    expect(puede(capacidades, 'conciliaciones.resolver')).toBe(true);
    expect(puede(capacidades, 'cargas.cargar')).toBe(false);
  });

  it('sin capacidades no puede nada', () => {
    expect(puede([], 'bandeja.ver')).toBe(false);
  });
});
