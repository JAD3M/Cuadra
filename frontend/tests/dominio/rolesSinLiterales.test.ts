// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROLES } from '@/shared/dominio';
import { RAIZ_FRONTEND } from '../css/leerTokens';

// Historia 2.2 (FR-25, AD-12): menú y botones salen de las capacidades que
// entrega el servidor, no de comparar roles. Ni `app/` ni `features/` escriben
// un rol como literal. Se exceptúan solo los datos de ejemplo de la galería
// (`features/kit/**` y `app/MuestraShell.tsx`): no deciden nada, ilustran
// componentes con una sesión inventada. Las pruebas tampoco cuentan.

const RAIZ_SRC = path.join(RAIZ_FRONTEND, 'src');
const CARPETAS = ['app', 'features'] as const;
const EXCEPCIONES = [
  path.join('features', 'kit') + path.sep,
  path.join('app', 'MuestraShell.tsx'),
];

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

/** Quita los comentarios: nombrar un rol en la documentación no lo copia. */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Archivos de producción que escriben `valor` entre comillas. */
export function conLiteral(archivos: readonly string[], valor: string) {
  const literal = new RegExp(`(['"\`])${valor}\\1`);
  return archivos.filter((archivo) =>
    literal.test(sinComentarios(fs.readFileSync(archivo, 'utf8'))),
  );
}

describe('app y features no escriben roles como literales (2.2)', () => {
  const archivos = CARPETAS.flatMap((c) =>
    archivosDeProduccion(path.join(RAIZ_SRC, c)),
  ).filter(
    (archivo) =>
      !EXCEPCIONES.some((e) => path.relative(RAIZ_SRC, archivo).startsWith(e)),
  );

  it('encuentra el código de producción de ambas carpetas', () => {
    expect(archivos.length).toBeGreaterThan(100);
    expect(
      archivos.some((a) => a.includes(`${path.sep}shell${path.sep}`)),
    ).toBe(true);
  });

  it.each([...ROLES])('ningún archivo escribe el literal «%s»', (rol) => {
    expect(
      conLiteral(archivos, rol).map((a) => path.relative(RAIZ_SRC, a)),
    ).toEqual([]);
  });

  it('detecta un literal de rol en código ajeno a los comentarios', () => {
    const tmp = path.join(RAIZ_FRONTEND, 'node_modules', '.cache');
    fs.mkdirSync(tmp, { recursive: true });
    const archivo = path.join(tmp, 'rol-literal.ts');
    fs.writeFileSync(archivo, "// 'admin'\nexport const x = 'auditor';\n");
    try {
      expect(conLiteral([archivo], 'auditor')).toEqual([archivo]);
      expect(conLiteral([archivo], 'admin')).toEqual([]);
    } finally {
      fs.rmSync(archivo);
    }
  });
});
