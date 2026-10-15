import { describe, expect, it } from 'vitest';
import { ESTADOS_BANDEJA } from './bandeja';
import {
  DESCRIPCIONES_ROL,
  ETIQUETAS_ESTADO_BANDEJA,
  ETIQUETAS_ROL,
  ordenarRoles,
} from './etiquetas';
import { ROLES, type Rol } from './tipos';

describe('ETIQUETAS_ROL', () => {
  it('etiqueta cada rol del espejo y nada más', () => {
    expect(Object.keys(ETIQUETAS_ROL).sort()).toEqual([...ROLES].sort());
    for (const rol of ROLES) expect(ETIQUETAS_ROL[rol]).not.toBe('');
  });
});

describe('DESCRIPCIONES_ROL', () => {
  it('describe cada rol del espejo y nada más', () => {
    expect(Object.keys(DESCRIPCIONES_ROL).sort()).toEqual([...ROLES].sort());
    for (const rol of ROLES) expect(DESCRIPCIONES_ROL[rol]).not.toBe('');
  });

  it('usa las descripciones del mockup aprobado de Usuarios', () => {
    expect(DESCRIPCIONES_ROL).toEqual({
      admin:
        'Todo: cargas, confirmar y rechazar, tolerancia, bitácora y usuarios.',
      contador:
        'Sube cargas, confirma y rechaza casos; ve la tolerancia sin cambiarla.',
      revisor:
        'Confirma y rechaza casos y consulta la bitácora; no sube cargas.',
      auditor: 'Solo lectura de la bandeja y la bitácora.',
    });
  });
});

describe('ETIQUETAS_ESTADO_BANDEJA', () => {
  it('etiqueta cada estado del espejo y nada más', () => {
    expect(Object.keys(ETIQUETAS_ESTADO_BANDEJA).sort()).toEqual(
      [...ESTADOS_BANDEJA].sort(),
    );
  });

  it('usa los textos de la bandeja aprobada', () => {
    expect(ETIQUETAS_ESTADO_BANDEJA).toEqual({
      sugerencia: 'Sugerencia',
      sin_match: 'Sin match',
      conciliado: 'Conciliado',
    });
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
