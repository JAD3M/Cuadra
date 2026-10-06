// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as espejoBandeja from '@/shared/dominio/bandeja';
import * as espejoResolucion from '@/shared/dominio/resolucion';
import * as espejo from '@/shared/dominio/tipos';
import {
  EXCLUIDOS_BACKEND,
  RAZON_CLASES,
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

describe('extensiones del extractor (arreglos planos, números, clases)', () => {
  const ARCHIVO = 'dto.sintetico.ts';
  const extraer = (fuente: string) => extraerExportsBackend(fuente, ARCHIVO);

  it('detecta un arreglo plano con tipo declarado igual que un `as const`', () => {
    const backend = extraer(`
export const A = ['x', 'y'] as const;
export const B: string[] = ['x', 'y'];
export const C = ['z'];`);
    expect(backend.arreglos).toEqual({
      A: ['x', 'y'],
      B: ['x', 'y'],
      C: ['z'],
    });
    expect(backend.desconocidos).toEqual([]);
  });

  it('un arreglo con elementos que no son texto sigue sin clasificar', () => {
    const backend = extraer('export const D = [1, 2];');
    expect(backend.arreglos).toEqual({});
    expect(backend.desconocidos).toEqual(['D']);
  });

  it('guarda las constantes numéricas y reporta su deriva', () => {
    const backend = extraer("export const N = 50;\nexport const T = 'texto';");
    expect(backend.constantes).toEqual({ N: 50, T: 'texto' });
    const comparar = (copia: Record<string, unknown>) =>
      compararConEspejo(backend, copia, ARCHIVO, {}, 0);
    expect(comparar({ N: 50, T: 'texto' })).toEqual([]);
    expect(comparar({ N: 51, T: 'texto' })[0]).toContain(
      'N: difiere del backend. backend=50 espejo=51',
    );
    expect(comparar({ N: '50', T: 'texto' })[0]).toContain('N: difiere');
    expect(comparar({ T: 'texto' })[0]).toContain('N: el backend la exporta');
  });

  it('las clases se excluyen solas y no exigen espejo', () => {
    const backend = extraer(`
export const A = ['x'] as const;
export class ConsultaDto { estado?: string }
export class OtroDto {}`);
    expect(backend.clases).toEqual(['ConsultaDto', 'OtroDto']);
    expect(backend.desconocidos).toEqual([]);
    expect(RAZON_CLASES).not.toBe('');
    expect(compararConEspejo(backend, { A: ['x'] }, ARCHIVO, {}, 1)).toEqual(
      [],
    );
  });

  it('`minimoArreglos` sustituye el mínimo por defecto de once', () => {
    const backend = extraer("export const A = ['x'];");
    expect(compararConEspejo(backend, { A: ['x'] }, ARCHIVO)[0]).toContain(
      'se encontraron 1 listas y se esperaban al menos 11',
    );
    expect(compararConEspejo(backend, { A: ['x'] }, ARCHIVO, {}, 1)).toEqual(
      [],
    );
    expect(
      compararConEspejo(backend, { A: ['x'] }, ARCHIVO, {}, 2)[0],
    ).toContain('al menos 2');
  });
});

describe('espejo de la bandeja frente al backend (src/bandeja/dto/bandeja.dto.ts)', () => {
  const RUTA_DTO = path.resolve(
    import.meta.dirname,
    '../../../src/bandeja/dto/bandeja.dto.ts',
  );
  const texto = fs.readFileSync(RUTA_DTO, 'utf8');
  const backend = extraerExportsBackend(texto, RUTA_DTO);
  const comparar = (
    fuente: string,
    copia: Record<string, unknown> = espejoBandeja,
  ) =>
    compararConEspejo(
      extraerExportsBackend(fuente, RUTA_DTO),
      copia,
      RUTA_DTO,
      {},
      2,
    );

  it('encuentra las dos listas, las dos constantes y los DTO', () => {
    expect(Object.keys(backend.arreglos)).toEqual([
      'ESTADOS_BANDEJA',
      'ESTADOS_POR_DEFECTO',
    ]);
    expect(backend.constantes).toEqual({
      LIMITE_POR_DEFECTO: 50,
      LIMITE_MAXIMO: 200,
    });
    expect(backend.clases).toContain('ResumenBandejaDto');
    expect(backend.desconocidos).toEqual([]);
  });

  it('el espejo coincide en valores, orden y constantes', () => {
    expect(comparar(texto)).toEqual([]);
  });

  it('cambiar el estado por defecto en el backend falla', () => {
    const fuente = texto.replace(
      "ESTADOS_POR_DEFECTO: EstadoBandeja[] = ['sugerencia', 'sin_match']",
      "ESTADOS_POR_DEFECTO: EstadoBandeja[] = ['sugerencia']",
    );
    expect(fuente).not.toBe(texto);
    expect(comparar(fuente)[0]).toContain('ESTADOS_POR_DEFECTO: difiere');
  });

  it('cambiar un límite en el backend falla', () => {
    const fuente = texto.replace('LIMITE_MAXIMO = 200', 'LIMITE_MAXIMO = 500');
    expect(fuente).not.toBe(texto);
    expect(comparar(fuente)[0]).toContain('LIMITE_MAXIMO: difiere');
  });

  it('si la extracción no encuentra nada falla apuntando al archivo', () => {
    const problemas = comparar('// vacío');
    expect(problemas[0]).toContain('bandeja.dto.ts');
    expect(problemas[0]).toContain('se encontraron 0 listas');
  });
});

describe('espejo de la resolución frente al backend (src/resolucion/dto/resolucion.dto.ts)', () => {
  const RUTA_DTO = path.resolve(
    import.meta.dirname,
    '../../../src/resolucion/dto/resolucion.dto.ts',
  );
  const texto = fs.readFileSync(RUTA_DTO, 'utf8');
  const comparar = (
    fuente: string,
    copia: Record<string, unknown> = espejoResolucion,
  ) =>
    compararConEspejo(
      extraerExportsBackend(fuente, RUTA_DTO),
      copia,
      RUTA_DTO,
      {},
      0,
    );

  it('encuentra el límite del motivo y no deja nada sin clasificar', () => {
    const backend = extraerExportsBackend(texto, RUTA_DTO);
    expect(backend.constantes).toEqual({ MOTIVO_MAXIMO: 500 });
    expect(backend.desconocidos).toEqual([]);
  });

  it('el espejo coincide con el backend', () => {
    expect(comparar(texto)).toEqual([]);
  });

  it('cambiar el límite en el backend falla', () => {
    const fuente = texto.replace('MOTIVO_MAXIMO = 500', 'MOTIVO_MAXIMO = 300');
    expect(fuente).not.toBe(texto);
    expect(comparar(fuente)[0]).toContain('MOTIVO_MAXIMO: difiere');
  });

  it('si la extracción no encuentra la constante, el espejo falla nombrándola', () => {
    const problemas = comparar('// vacío');
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('MOTIVO_MAXIMO: el espejo lo exporta');
  });
});
