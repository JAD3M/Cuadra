import fs from 'node:fs';
import path from 'node:path';
import { RAIZ_FRONTEND } from './leerTokens';

/** Lee un módulo CSS de `src` (ruta relativa a `frontend/src`). */
export function leerModuloCss(rutaRelativa: string): string {
  return fs.readFileSync(path.join(RAIZ_FRONTEND, 'src', rutaRelativa), 'utf8');
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Devuelve el cuerpo del primer bloque cuyo selector es exactamente
 * `selector` (por ejemplo `.boton` o `.boton:focus-visible`). jsdom no calcula
 * layout, así que los contratos de CSS se verifican sobre este texto.
 */
export function bloqueCss(css: string, selector: string): string {
  const patron = new RegExp(
    `(?:^|[}\\s,])${escaparRegex(selector)}\\s*\\{([^}]*)\\}`,
  );
  const coincidencia = css.match(patron);
  if (!coincidencia?.[1]) throw new Error(`Sin bloque ${selector}`);
  return coincidencia[1];
}

export const LITERAL_DE_COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
