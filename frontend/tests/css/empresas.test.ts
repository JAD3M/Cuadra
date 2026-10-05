// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

describe('contrato CSS de TarjetaEmpresa', () => {
  const css = leerModuloCss(
    'features/auth/components/TarjetaEmpresa.module.css',
  );

  it('la tarjeta y el mosaico miden al menos el objetivo táctil', () => {
    expect(bloqueCss(css, '.tarjeta')).toMatch(
      /min-block-size:\s*var\(--touch-min\)/,
    );
    const mosaico = bloqueCss(css, '.mosaico');
    expect(mosaico).toMatch(/inline-size:\s*var\(--touch-min\)/);
    expect(mosaico).toMatch(/block-size:\s*var\(--touch-min\)/);
  });

  it('declara foco visible propio', () => {
    expect(bloqueCss(css, '.tarjeta:focus-visible')).toMatch(
      /outline:\s*2px solid var\(--color-accent\)/,
    );
  });

  it('inactiva se distingue por algo más que el color', () => {
    const inactiva = bloqueCss(css, ".tarjeta[aria-disabled='true']");
    expect(inactiva).toMatch(/border-style:\s*dashed/);
    expect(inactiva).toMatch(/cursor:\s*not-allowed/);
  });

  it('el RFC va en monoespaciada y sin partirse', () => {
    const rfc = bloqueCss(css, '.rfc');
    expect(rfc).toMatch(/font-family:\s*var\(--font-mono\)/);
    expect(rfc).toMatch(/white-space:\s*nowrap/);
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});
