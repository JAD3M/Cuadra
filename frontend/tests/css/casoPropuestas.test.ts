// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';
import { RAIZ_FRONTEND } from './leerTokens';

const RAIZ_CASO = path.join(RAIZ_FRONTEND, 'src', 'features', 'caso');

/** Todos los `.module.css` de `features/caso`, recursivamente. */
function modulosCss(carpeta: string): string[] {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(carpeta, e.name);
    if (e.isDirectory()) return modulosCss(ruta);
    return e.name.endsWith('.module.css') ? [ruta] : [];
  });
}

const MODULOS = modulosCss(RAIZ_CASO).map((ruta) => ({
  nombre: path.relative(RAIZ_CASO, ruta),
  css: fs.readFileSync(ruta, 'utf8'),
}));

const bloques = leerModuloCss('features/caso/components/bloques.module.css');
const detalle = leerModuloCss(
  'features/caso/components/DetallePropuesta.module.css',
);

describe('contrato CSS de las propuestas del caso', () => {
  it('encuentra módulos CSS que revisar', () => {
    expect(MODULOS.length).toBeGreaterThanOrEqual(8);
  });

  it.each(MODULOS)(
    '$nombre solo usa tokens: sin literales de color',
    ({ css }) => {
      expect(css).not.toMatch(LITERAL_DE_COLOR);
    },
  );

  it('el monto no se parte en dos líneas', () => {
    expect(bloqueCss(bloques, '.monto')).toMatch(/white-space:\s*nowrap/);
  });

  it('las cuadrículas miden al menos su contenido (min-content), no 0', () => {
    expect(bloqueCss(bloques, '.kv')).toContain('minmax(min-content, 1fr)');
    expect(bloqueCss(detalle, '.par')).toContain('minmax(min-content, 1fr)');
    for (const { css } of MODULOS) {
      expect(css).not.toMatch(/minmax\(\s*0\s*,/);
    }
  });

  it('las tarjetas no recortan ni limitan el ancho: crecen con el número', () => {
    for (const { nombre, css } of MODULOS) {
      // El `max-width` de una consulta de medios no limita ninguna tarjeta.
      const sinMedios = css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/@media[^{]*/g, '');
      expect(sinMedios, nombre).not.toMatch(
        /overflow\s*:\s*(hidden|clip|auto|scroll)|text-overflow|max-inline-size\s*:\s*\d+(px|rem)|max-width\s*:\s*\d+(px|rem)/,
      );
    }
    expect(bloqueCss(bloques, '.tarjeta')).not.toMatch(/overflow|max-/);
  });

  it('el desborde de palabras solo se permite en textos libres', () => {
    expect(bloqueCss(bloques, '.texto')).toMatch(/overflow-wrap:\s*anywhere/);
    expect(bloqueCss(bloques, '.monto')).not.toMatch(/overflow-wrap/);
  });

  it('a 900 px o menos la pareja de tarjetas pasa a una columna', () => {
    expect(detalle).toMatch(/@media \(max-width: 900px\)/);
    expect(detalle).toMatch(/grid-template-columns:\s*1fr;/);
  });

  it('los objetivos interactivos miden al menos 44 px', () => {
    const volver = leerModuloCss(
      'features/caso/components/EncabezadoCaso.module.css',
    );
    expect(bloqueCss(volver, '.volver')).toContain('var(--touch-min)');
    const fila = leerModuloCss(
      'features/caso/components/FilaPropuesta.module.css',
    );
    expect(bloqueCss(fila, '.ver')).toContain('var(--touch-min)');
  });
});
