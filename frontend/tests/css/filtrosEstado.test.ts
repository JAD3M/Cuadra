// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const css = leerModuloCss(
  'features/bandeja/components/FiltrosEstado.module.css',
);

describe('contrato CSS de los filtros de estado', () => {
  it('cada chip mide al menos un objetivo táctil', () => {
    expect(bloqueCss(css, '.chip')).toContain('var(--touch-min)');
  });

  it('el chip activo usa el acento y el fondo seleccionado', () => {
    const activo = bloqueCss(css, '.activo');
    expect(activo).toContain('var(--color-accent)');
    expect(activo).toContain('var(--color-selected)');
    expect(activo).toContain('var(--color-text)');
  });

  it('el foco visible está declarado', () => {
    expect(bloqueCss(css, '.chip:focus-visible')).toMatch(/outline/);
  });

  it('el último chip activo no cambia el cursor a normal', () => {
    expect(bloqueCss(css, ".chip[aria-disabled='true']")).toMatch(/cursor/);
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});
