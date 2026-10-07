// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const css = leerModuloCss('shared/ui/Paginacion.module.css');

describe('contrato CSS de la paginación', () => {
  it('cada control mide al menos un objetivo táctil', () => {
    const pagina = bloqueCss(css, '.pagina');
    expect(pagina).toContain('min-inline-size: var(--touch-min)');
    expect(pagina).toContain('min-block-size: var(--touch-min)');
  });

  it('la página actual se distingue por borde de acento', () => {
    expect(bloqueCss(css, '.actual')).toContain('var(--color-accent)');
  });

  it('el rango visible usa el texto secundario', () => {
    expect(bloqueCss(css, '.rango')).toContain('var(--color-text-secondary)');
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});
