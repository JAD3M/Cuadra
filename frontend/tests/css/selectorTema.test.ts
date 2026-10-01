// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

/**
 * jsdom no calcula estilos reales: el contrato visual del selector de tema
 * (zona táctil, foco, estados) se verifica sobre el texto de su módulo CSS.
 */
const css = leerModuloCss('shared/tema/SelectorTema.module.css');

describe('contrato CSS de SelectorTema', () => {
  it('la zona de clic de cada opción llega al objetivo táctil mínimo', () => {
    expect(bloqueCss(css, '.opcion')).toMatch(
      /min-block-size:\s*var\(--touch-min\)/,
    );
  });

  it('el radio nativo cubre la opción y sigue siendo focalizable', () => {
    const entrada = bloqueCss(css, '.entrada');
    expect(entrada).toMatch(/position:\s*absolute/);
    expect(entrada).toMatch(/inset:\s*0/);
    expect(entrada).toMatch(/opacity:\s*0/);
    expect(entrada).not.toMatch(/display:\s*none|visibility:\s*hidden/);
  });

  it('el segmento visual mide 36 px como en la maqueta', () => {
    expect(bloqueCss(css, '.segmento')).toMatch(/min-block-size:\s*36px/);
  });

  it('declara un foco visible sobre el segmento', () => {
    const foco = bloqueCss(css, '.entrada:focus-visible + .segmento');
    expect(foco).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
    expect(foco).not.toMatch(/outline:\s*(none|0)/);
  });

  it('la opción marcada usa el fondo seleccionado y el texto principal', () => {
    const marcada = bloqueCss(css, '.entrada:checked + .segmento');
    expect(marcada).toMatch(/background:\s*var\(--color-selected\)/);
    expect(marcada).toMatch(/color:\s*var\(--color-text\)/);
  });

  it('las opciones inactivas son transparentes con texto secundario', () => {
    const segmento = bloqueCss(css, '.segmento');
    expect(segmento).toMatch(/background:\s*transparent/);
    expect(segmento).toMatch(/color:\s*var\(--color-text-secondary\)/);
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});
