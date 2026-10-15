// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as espejo from '@/shared/dominio/permisos';
import { ROLES } from '@/shared/dominio/tipos';
import { compararPermisos, extraerMatriz } from './derivaPermisos';

const RUTA_MATRIZ = path.resolve(
  import.meta.dirname,
  '../../../src/auth/permisos/matriz.ts',
);

describe('espejo de permisos frente al backend (src/auth/permisos/matriz.ts)', () => {
  const texto = fs.readFileSync(RUTA_MATRIZ, 'utf8');
  const backend = extraerMatriz(texto, RUTA_MATRIZ);

  it('encuentra la lista, el marcador propio, los del dueño y la matriz', () => {
    expect(backend.permisos.length).toBeGreaterThanOrEqual(14);
    expect(backend.propios.length).toBeGreaterThan(0);
    expect(backend.dueno).toEqual(['plataforma.administrar']);
    expect(Object.keys(backend.matriz)).toEqual(backend.permisos);
    expect(backend.problemas).toEqual([]);
  });

  it('el espejo coincide en permisos, filas, roles y marcas', () => {
    expect(compararPermisos(backend, espejo)).toEqual([]);
  });

  it('todo rol de la matriz existe en ROLES', () => {
    for (const roles of Object.values(backend.matriz)) {
      for (const rol of roles) expect(ROLES).toContain(rol);
    }
  });

  it('las filas futuras de FR-53 están en el espejo', () => {
    for (const p of [
      'muestra.verificar',
      'conciliaciones.reabrir',
      'movimientos.descartar',
      'movimientos.deshacer_descarte',
      'conciliaciones.comentar',
    ]) {
      expect(espejo.PERMISOS).toContain(p);
    }
  });
});

describe('compararPermisos (detecta deriva con fuentes sintéticas)', () => {
  const ARCHIVO = 'matriz.sintetica.ts';
  const base = `
export const PERMISOS = ['a.ver', 'a.editar', 'dueno.todo'] as const;
export const PERMISOS_DUENO = ['dueno.todo'] as const;
export const PERMISOS_PROPIOS = ['a.editar'] as const;
export const MATRIZ_PERMISOS: Record<string, readonly string[]> = {
  'a.ver': ['admin', 'auditor'],
  'a.editar': ['admin'],
  'dueno.todo': [],
};`;
  const copia = {
    PERMISOS: ['a.ver', 'a.editar', 'dueno.todo'],
    PERMISOS_DUENO: ['dueno.todo'],
    PERMISOS_PROPIOS: ['a.editar'],
    MATRIZ_PERMISOS: {
      'a.ver': ['admin', 'auditor'],
      'a.editar': ['admin'],
      'dueno.todo': [],
    },
  };
  const comparar = (fuente: string, espejoCopia: Record<string, unknown>) =>
    compararPermisos(extraerMatriz(fuente, ARCHIVO), espejoCopia);

  it('sin cambios no reporta nada', () => {
    expect(comparar(base, copia)).toEqual([]);
  });

  it('un rol agregado a una fila en el backend falla nombrando el permiso', () => {
    const fuente = base.replace(
      "'a.editar': ['admin']",
      "'a.editar': ['admin', 'auditor']",
    );
    const r = comparar(fuente, copia);
    expect(r).toHaveLength(1);
    expect(r[0]).toContain('a.editar');
  });

  it('un cambio solo de orden de roles también falla', () => {
    const fuente = base.replace("['admin', 'auditor']", "['auditor', 'admin']");
    expect(comparar(fuente, copia)[0]).toContain('a.ver');
  });

  it('un permiso nuevo en el backend sin espejo falla', () => {
    const fuente = base
      .replace(
        "'dueno.todo'] as const;\nexport const PERMISOS_DUENO",
        "'dueno.todo', 'b.ver'] as const;\nexport const PERMISOS_DUENO",
      )
      .replace(
        "  'dueno.todo': [],",
        "  'dueno.todo': [],\n  'b.ver': ['admin'],",
      );
    const r = comparar(fuente, copia);
    expect(r.join('\n')).toContain('b.ver');
  });

  it('un permiso que solo existe en el espejo falla', () => {
    const r = comparar(base, {
      ...copia,
      PERMISOS: [...copia.PERMISOS, 'inventado.ver'],
    });
    expect(r.join('\n')).toContain('inventado.ver');
  });

  it('quitar la marca propio en el backend falla', () => {
    const fuente = base.replace(
      "['a.editar'] as const;\nexport const MATRIZ",
      '[] as const;\nexport const MATRIZ',
    );
    expect(fuente).not.toBe(base);
    expect(comparar(fuente, copia).join('\n')).toContain('PERMISOS_PROPIOS');
  });

  it('una matriz que no se puede leer falla señalando el archivo', () => {
    const r = comparar('export const X = 1;', copia);
    expect(r[0]).toContain(ARCHIVO);
  });
});
