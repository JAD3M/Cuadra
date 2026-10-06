// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCIONES_BITACORA,
  ESTADOS_BANDEJA,
  ESTADOS_CONCILIACION,
  ESTADOS_MOVIMIENTO,
  REGLA_LLM_SUGERENCIA,
  REGLA_REFERENCIA_MONTO_EXACTO,
  REGLAS_SIN_MATCH,
  ROLES,
} from '@/shared/dominio';
import { RAIZ_FRONTEND } from '../css/leerTokens';

// CDT-14: las reglas, los roles y el código interno de la segregación salen
// del espejo del dominio; el código de `features/caso` no los repite como
// literales. Los estados y las acciones solo se permiten en una comparación
// (`=== 'x'`, `!== 'x'`, `case 'x'`) o como `tono="x"`, un rol de color de Button
// que no es un valor del dominio contra un valor ya tipado con el espejo:
// ahí tsc falla si el backend renombra el valor. Fuera de una comparación
// (uniones escritas a mano, retornos, propiedades) el literal es una copia.

const RAIZ = path.join(RAIZ_FRONTEND, 'src', 'features', 'caso');

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

/** Quita los comentarios: nombrar una regla en la documentación no la copia. */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const PROHIBIDOS: readonly string[] = [
  REGLA_LLM_SUGERENCIA,
  REGLA_REFERENCIA_MONTO_EXACTO,
  ...REGLAS_SIN_MATCH,
  ...ROLES,
  'acceso_denegado',
];

const VALORES_TIPADOS: readonly string[] = [
  ...new Set<string>([
    ...ESTADOS_BANDEJA,
    ...ESTADOS_CONCILIACION,
    ...ESTADOS_MOVIMIENTO,
    ...ACCIONES_BITACORA,
  ]),
];

describe('el detalle del caso no repite valores del dominio como literales', () => {
  const archivos = archivosDeProduccion(RAIZ);

  it('encuentra el código de producción de la pantalla', () => {
    expect(archivos.length).toBeGreaterThan(30);
  });

  it.each(PROHIBIDOS)('ningún archivo escribe el literal «%s»', (valor) => {
    const literal = new RegExp(`(['"\`])${valor}\\1`);
    const infractores = archivos.filter((archivo) =>
      literal.test(sinComentarios(fs.readFileSync(archivo, 'utf8'))),
    );
    expect(infractores.map((a) => path.relative(RAIZ, a))).toEqual([]);
  });

  it.each(VALORES_TIPADOS)(
    'el estado o la acción «%s» solo aparece como literal en una comparación tipada',
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
});
