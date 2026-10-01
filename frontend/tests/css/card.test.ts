// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const css = leerModuloCss('shared/ui/Card.module.css');

describe('contrato CSS de Card', () => {
  it('usa la superficie y el borde por rol', () => {
    const base = bloqueCss(css, '.card');
    expect(base).toMatch(/background:\s*var\(--color-surface\)/);
    expect(base).toMatch(/border:\s*1px solid var\(--color-border\)/);
  });

  it('puede encogerse dentro de un grid o flex', () => {
    expect(bloqueCss(css, '.card')).toMatch(/min-inline-size:\s*0/);
  });

  it('la variante elevada usa la superficie elevada', () => {
    expect(bloqueCss(css, '.elevada')).toMatch(
      /background:\s*var\(--color-surface-raised\)/,
    );
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});
