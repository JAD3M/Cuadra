// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const css = leerModuloCss('features/bandeja/components/KpiBandeja.module.css');

describe('contrato CSS de los indicadores de la bandeja', () => {
  it('cada estado usa sus tokens de tile (fondo, borde y acento)', () => {
    const tokens = {
      sugerencia: 'sugerencia',
      sin_match: 'sin-match',
      conciliado: 'conciliado',
    };
    for (const [clase, estado] of Object.entries(tokens)) {
      const bloque = bloqueCss(css, `.${clase}`);
      expect(bloque).toContain(`var(--estado-${estado}-tile-bg)`);
      expect(bloque).toContain(`var(--estado-${estado}-tile-border)`);
      expect(bloque).toContain(`var(--estado-${estado}-accent)`);
    }
  });

  it('el tile de monto usa la superficie elevada', () => {
    expect(bloqueCss(css, '.tileMonto')).toContain(
      'var(--color-surface-raised)',
    );
  });

  it('los números y los montos no se parten', () => {
    expect(bloqueCss(css, '.numero')).toMatch(/white-space:\s*nowrap/);
    expect(bloqueCss(css, '.lineaMonto')).toMatch(/white-space:\s*nowrap/);
  });

  it('el tile de monto crece con el contenido y no recorta', () => {
    expect(bloqueCss(css, '.cuadricula')).toContain('max-content');
    const monto = bloqueCss(css, '.tileMonto');
    expect(monto).not.toMatch(
      /overflow|text-overflow|max-inline-size|max-width/,
    );
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});
