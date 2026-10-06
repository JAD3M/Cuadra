// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ESTADOS_CARGA,
  RESULTADOS_ARCHIVO,
  ROLES,
  TIPOS_CARGA,
} from '@/shared/dominio';
import { RAIZ_FRONTEND } from '../css/leerTokens';

// CRG-13.2 / C-17: el código de `features/cargas` no repite como literales los
// valores que el espejo del dominio ya trae. Los tipos de carga, los
// resultados de un archivo y los roles no se escriben nunca. Los estados solo
// se permiten en una comparación (`=== 'x'`, `!== 'x'`, `case 'x'`) o como
// `tono="x"`: ahí tsc falla si el backend renombra el valor. Fuera de una
// comparación (uniones escritas a mano, retornos) el literal es una copia.
//
// Los rótulos de color del chip (`'sugerencia'`, `'conciliado'`, `'sin_match'`
// en `tonos.ts`) no se excluyen del recorrido: no son valores de este
// conjunto, son los roles de color de `EstadoChip`, un tipo de `shared/ui`
// (`TonoEstadoChip`) que tsc ya vigila, y por eso no están en ninguna de las
// dos listas de abajo.
//
// Solo el código de producción: ni las pruebas ni los valores de ejemplo del
// mockup (C-12) entran en el recorrido.

const RAIZ = path.join(RAIZ_FRONTEND, 'src', 'features', 'cargas');

function archivosDeProduccion(carpeta: string): string[] {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) {
      return entrada.name === 'node_modules' ? [] : archivosDeProduccion(ruta);
    }
    const esCodigo = /\.(ts|tsx)$/.test(entrada.name);
    return esCodigo && !/\.test\.(ts|tsx)$/.test(entrada.name) ? [ruta] : [];
  });
}

/** Quita los comentarios: nombrar un valor en la documentación no lo copia. */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const PROHIBIDOS: readonly string[] = [
  ...TIPOS_CARGA,
  ...RESULTADOS_ARCHIVO,
  ...ROLES,
];

describe('la pantalla de cargas no repite valores del dominio como literales', () => {
  const archivos = archivosDeProduccion(RAIZ);

  it('encuentra el código de producción de la pantalla', () => {
    expect(archivos.length).toBeGreaterThan(40);
    expect(archivos.some((a) => a.endsWith('CargasContenedor.tsx'))).toBe(true);
    expect(archivos.some((a) => a.endsWith('tonos.ts'))).toBe(true);
    expect(archivos.some((a) => /\.test\./.test(a))).toBe(false);
  });

  it.each(PROHIBIDOS)('ningún archivo escribe el literal «%s»', (valor) => {
    const literal = new RegExp(`(['"\`])${valor}\\1`);
    const infractores = archivos.filter((archivo) =>
      literal.test(sinComentarios(fs.readFileSync(archivo, 'utf8'))),
    );
    expect(infractores.map((a) => path.relative(RAIZ, a))).toEqual([]);
  });

  it.each(ESTADOS_CARGA)(
    'el estado «%s» solo aparece como literal en una comparación tipada',
    (valor) => {
      const copia = new RegExp(
        `(?<!(?:===|!==|\\bcase|\\btono=)\\s*)(['"\`])${valor}\\1`,
      );
      const infractores = archivos.filter((archivo) =>
        copia.test(sinComentarios(fs.readFileSync(archivo, 'utf8'))),
      );
      expect(infractores.map((a) => path.relative(RAIZ, a))).toEqual([]);
    },
  );

  it('el recorrido detecta una copia (control positivo)', () => {
    const copia = new RegExp(
      `(?<!(?:===|!==|\\bcase|\\btono=)\\s*)(['"\`])pendiente\\1`,
    );
    expect(copia.test("const x = 'pendiente';")).toBe(true);
    expect(copia.test("if (e === 'pendiente') return;")).toBe(false);
    expect(copia.test("case 'pendiente':")).toBe(false);
    expect(
      new RegExp('([\'"`])cfdi\\1').test(
        sinComentarios("// 'cfdi'\nx('cfdi')"),
      ),
    ).toBe(true);
    expect(
      new RegExp('([\'"`])cfdi\\1').test(sinComentarios("// 'cfdi'\nx(1)")),
    ).toBe(false);
  });
});
