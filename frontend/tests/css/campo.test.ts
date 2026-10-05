// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

describe('contrato CSS de Campo', () => {
  const css = leerModuloCss('shared/ui/Campo.module.css');

  it('el control mide al menos el alto de control y el objetivo táctil', () => {
    const control = bloqueCss(css, '.control');
    expect(control).toMatch(/min-block-size:\s*var\(--control-height\)/);
  });

  it('declara foco visible propio', () => {
    const foco = bloqueCss(css, '.control:focus-visible');
    expect(foco).toMatch(/outline:\s*2px solid var\(--color-accent\)/);
  });

  it('el estado inválido cambia el borde', () => {
    expect(bloqueCss(css, ".control[aria-invalid='true']")).toMatch(
      /border-color:\s*var\(--color-danger\)/,
    );
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});

describe('contrato CSS de AlertaError', () => {
  const css = leerModuloCss('shared/ui/AlertaError.module.css');

  it('pinta con los roles de peligro', () => {
    const alerta = bloqueCss(css, '.alerta');
    expect(alerta).toMatch(/border:\s*1px solid var\(--color-danger-border\)/);
    expect(alerta).toMatch(/background:\s*var\(--color-danger-tint\)/);
  });

  it('declara foco visible propio', () => {
    expect(bloqueCss(css, '.alerta:focus-visible')).toMatch(
      /outline:\s*2px solid var\(--color-accent\)/,
    );
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});
