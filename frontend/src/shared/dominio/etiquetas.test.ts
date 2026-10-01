import { describe, expect, it } from 'vitest';
import { ETIQUETAS_ROL, ordenarRoles } from './etiquetas';
import { ROLES, type Rol } from './tipos';

describe('ETIQUETAS_ROL', () => {
  it('etiqueta cada rol del espejo y nada más', () => {
    expect(Object.keys(ETIQUETAS_ROL).sort()).toEqual([...ROLES].sort());
    for (const rol of ROLES) expect(ETIQUETAS_ROL[rol]).not.toBe('');
  });
});

describe('ordenarRoles', () => {
  it('pone admin antes que revisor sin importar el orden de entrada', () => {
    expect(ordenarRoles(['revisor', 'admin'])).toEqual(['admin', 'revisor']);
  });

  it('conserva un único rol', () => {
    expect(ordenarRoles(['contador'])).toEqual(['contador']);
  });

  it('ordena el conjunto completo desde cualquier permutación', () => {
    const permutaciones: Rol[][] = [
      ['revisor', 'contador', 'admin'],
      ['contador', 'revisor', 'admin'],
      ['admin', 'revisor', 'contador'],
      ['revisor', 'admin', 'contador'],
    ];
    for (const p of permutaciones) {
      expect(ordenarRoles(p)).toEqual(['admin', 'contador', 'revisor']);
    }
  });

  it('devuelve vacío para una lista vacía', () => {
    expect(ordenarRoles([])).toEqual([]);
  });

  it('no modifica el arreglo recibido', () => {
    const entrada: Rol[] = ['revisor', 'admin'];
    ordenarRoles(entrada);
    expect(entrada).toEqual(['revisor', 'admin']);
  });
});
