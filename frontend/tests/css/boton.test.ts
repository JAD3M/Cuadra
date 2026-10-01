// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

/**
 * jsdom no calcula estilos reales: el contrato de accesibilidad visual de
 * Button se verifica sobre el texto de su módulo CSS.
 */
const css = leerModuloCss('shared/ui/Button.module.css');

describe('contrato CSS de Button', () => {
  const base = bloqueCss(css, '.boton');

  it('garantiza el objetivo táctil mínimo con el token', () => {
    expect(base).toMatch(/min-block-size:\s*var\(--touch-min\)/);
    expect(base).toMatch(/min-inline-size:\s*var\(--touch-min\)/);
  });

  it('declara un estilo de foco visible propio', () => {
    const foco = bloqueCss(css, '.boton:focus-visible');
    expect(foco).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
    expect(foco).not.toMatch(/outline:\s*(none|0)/);
  });

  it('el deshabilitado no depende solo del color', () => {
    const deshabilitado = bloqueCss(css, '.boton:disabled');
    expect(deshabilitado).toMatch(/border-style:\s*dashed/);
    expect(deshabilitado).toMatch(/cursor:\s*not-allowed/);
  });

  it.each(['primario', 'secundario', 'peligro', 'fantasma'])(
    'la variante %s define su estado deshabilitado',
    (variante) => {
      expect(() => bloqueCss(css, `.${variante}:disabled`)).not.toThrow();
    },
  );

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});
