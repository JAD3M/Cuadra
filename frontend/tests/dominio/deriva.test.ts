// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as espejo from '@/shared/dominio/tipos';
import {
  EXCLUIDOS_BACKEND,
  RAZON_TIPOS,
  compararConEspejo,
  extraerExportsBackend,
} from './derivaTipos';

const RUTA_BACKEND = path.resolve(
  import.meta.dirname,
  '../../../src/common/entities/tipos.ts',
);

describe('espejo del dominio frente al backend (src/common/entities/tipos.ts)', () => {
  const texto = fs.readFileSync(RUTA_BACKEND, 'utf8');
  const backend = extraerExportsBackend(texto, RUTA_BACKEND);

  it('encuentra las once listas y la constante de la regla del LLM', () => {
    expect(Object.keys(backend.arreglos)).toHaveLength(11);
    expect(backend.constantes).toEqual({
      REGLA_LLM_SUGERENCIA: 'llm_sugerencia',
    });
  });

  it('el espejo coincide en valores y orden, sin extras ni faltantes', () => {
    expect(compararConEspejo(backend, espejo, RUTA_BACKEND)).toEqual([]);
  });

  it('las exclusiones son explícitas y tienen razón', () => {
    expect(Object.keys(EXCLUIDOS_BACKEND)).toEqual(['listaSql']);
    expect(backend.funciones).toEqual(['listaSql']);
    expect(RAZON_TIPOS).not.toBe('');
    expect(backend.tipos.length).toBeGreaterThanOrEqual(11);
  });
});

describe('compararConEspejo (detecta deriva con fuentes sintéticas)', () => {
  const ARCHIVO = 'tipos.sintetico.ts';
  const base = Array.from(
    { length: 11 },
    (_, i) => `export const L${i} = ['a', 'b'] as const;`,
  ).join('\n');
  const espejoBase: Record<string, unknown> = Object.fromEntries(
    Array.from({ length: 11 }, (_, i) => [`L${i}`, ['a', 'b']]),
  );
  const comparar = (fuente: string, copia: Record<string, unknown>) =>
    compararConEspejo(extraerExportsBackend(fuente, ARCHIVO), copia, ARCHIVO);

  it('sin cambios no reporta nada', () => {
    expect(comparar(base, espejoBase)).toEqual([]);
  });

  it('un valor agregado en el backend falla nombrando la lista y la diferencia', () => {
    const fuente = base.replace("L3 = ['a', 'b']", "L3 = ['a', 'b', 'nuevo']");
    const problemas = comparar(fuente, espejoBase);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('L3: difiere del backend');
    expect(problemas[0]).toContain('faltan en el espejo: [nuevo]');
  });

  it('un cambio solo de orden también falla', () => {
    const fuente = base.replace("L0 = ['a', 'b']", "L0 = ['b', 'a']");
    const problemas = comparar(fuente, espejoBase);
    expect(problemas[0]).toContain('L0: difiere del backend');
    expect(problemas[0]).toContain('cambió el orden');
  });

  it('una lista nueva en el backend sin espejo falla', () => {
    const fuente = `${base}\nexport const NUEVA = ['x'] as const;`;
    expect(comparar(fuente, espejoBase)).toEqual([
      `NUEVA: el backend la exporta (${ARCHIVO}) y el espejo no la tiene`,
    ]);
  });

  it('un export sin clasificar falla pidiendo espejarlo o excluirlo', () => {
    const fuente = `${base}\nexport function otraFuncion(): void {}`;
    const problemas = comparar(fuente, espejoBase);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('otraFuncion');
    expect(problemas[0]).toContain('EXCLUIDOS_BACKEND');
  });

  it('un export de otra forma (clase, const no literal) cuenta como sin clasificar', () => {
    const fuente = `${base}\nexport const RARO = Math.max(1, 2);`;
    expect(comparar(fuente, espejoBase)[0]).toContain('RARO');
  });

  it('listaSql y los tipos exportados no exigen espejo', () => {
    const fuente = `${base}
export type T = (typeof L0)[number];
export function listaSql(v: readonly string[]): string { return v.join(); }`;
    expect(comparar(fuente, espejoBase)).toEqual([]);
  });

  it('un valor que el espejo tiene y el backend no falla', () => {
    const copia = { ...espejoBase, L5: ['a', 'b', 'inventado'] };
    const problemas = comparar(base, copia);
    expect(problemas[0]).toContain('L5: difiere del backend');
    expect(problemas[0]).toContain('sobran: [inventado]');
  });

  it('un export del espejo que el backend no tiene falla', () => {
    const copia = { ...espejoBase, EXTRA: ['x'] };
    expect(comparar(base, copia)).toEqual([
      'EXTRA: el espejo lo exporta y el backend no (el frontend no inventa valores)',
    ]);
  });

  it('la constante de texto se compara por valor', () => {
    const fuente = `${base}\nexport const REGLA = 'x';`;
    expect(comparar(fuente, { ...espejoBase, REGLA: 'x' })).toEqual([]);
    expect(comparar(fuente, { ...espejoBase, REGLA: 'y' })[0]).toContain(
      'REGLA: difiere del backend',
    );
  });

  it('cero listas encontradas falla señalando el archivo', () => {
    const problemas = comparar('// archivo vacío\nexport const X = 1 + 1;', {});
    expect(problemas[0]).toContain(ARCHIVO);
    expect(problemas[0]).toContain('se encontraron 0 listas');
  });
});
