// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORMATO_RFC, RFC_GENERICOS } from '@/shared/dominio';

// Deriva del espejo de RFC (historia 1.4) contra `src/common/rfc.ts`. El
// frontend solo da una pista: si el patrón o la lista de genéricos cambian en
// el backend y aquí no, esta prueba falla nombrando la constante.

const RAIZ = path.resolve(import.meta.dirname, '../../../src');
const fuente = fs.readFileSync(path.join(RAIZ, 'common/rfc.ts'), 'utf8');

/** El cuerpo del literal `/.../` asignado a `FORMATO_RFC`. */
function patronDelBackend(texto: string): string | undefined {
  return /export const FORMATO_RFC\s*=\s*\/(.+)\/;/s.exec(texto)?.[1];
}

/** Las cadenas del arreglo `RFC_GENERICOS`. */
function genericosDelBackend(texto: string): string[] | undefined {
  const bloque = /export const RFC_GENERICOS[^=]*=\s*\[([^\]]*)\]/s.exec(
    texto,
  )?.[1];
  if (bloque === undefined) return undefined;
  return [...bloque.matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');
}

describe('RFC (src/common/rfc.ts)', () => {
  it('FORMATO_RFC es el mismo patrón que el del backend', () => {
    expect(patronDelBackend(fuente)).toBeDefined();
    expect(FORMATO_RFC.source).toBe(patronDelBackend(fuente));
    expect(FORMATO_RFC.flags).toBe('');
  });

  it('RFC_GENERICOS son los mismos que los del backend', () => {
    expect(genericosDelBackend(fuente)).toEqual([...RFC_GENERICOS]);
  });
});
