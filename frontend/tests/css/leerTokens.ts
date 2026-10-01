import fs from 'node:fs';
import path from 'node:path';

export type Tema = 'dark' | 'light';
export type TokensTema = Record<string, string>;

export const RAIZ_FRONTEND = path.resolve(import.meta.dirname, '../..');
export const RUTA_COLORES = path.join(
  RAIZ_FRONTEND,
  'src/shared/styles/tokens/colors.css',
);

/**
 * Lee un archivo de tokens y devuelve las declaraciones `--nombre: valor` de
 * cada tema. El bloque cuyo selector menciona data-theme='light' es el claro;
 * el bloque `:root, :root[data-theme='dark']` es el oscuro.
 */
export function leerTokensPorTema(css: string): Record<Tema, TokensTema> {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens: Record<Tema, TokensTema> = { dark: {}, light: {} };
  for (const [, selector, cuerpo] of sinComentarios.matchAll(
    /([^{}]+)\{([^{}]*)\}/g,
  )) {
    const tema: Tema = /data-theme=['"]light['"]/.test(selector ?? '')
      ? 'light'
      : 'dark';
    for (const [, nombre, valor] of (cuerpo ?? '').matchAll(
      /(--[\w-]+)\s*:\s*([^;]+);/g,
    )) {
      if (nombre && valor) tokens[tema][nombre] = valor.trim();
    }
  }
  return tokens;
}

export function leerColores(): Record<Tema, TokensTema> {
  return leerTokensPorTema(fs.readFileSync(RUTA_COLORES, 'utf8'));
}
