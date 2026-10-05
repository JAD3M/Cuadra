// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const css = leerModuloCss(
  'features/bandeja/components/TablaBandeja.module.css',
);
const celdaDiferencia = leerModuloCss(
  'features/bandeja/components/CeldaDiferencia.module.css',
);

describe('contrato CSS de la tabla de la bandeja', () => {
  it('el monto no se parte en dos líneas', () => {
    expect(bloqueCss(css, '.monto')).toMatch(/white-space:\s*nowrap/);
  });

  it('el monto no se recorta: sin overflow ni ancho máximo', () => {
    const monto = bloqueCss(css, '.monto');
    expect(monto).not.toMatch(
      /overflow|text-overflow|max-inline-size|max-width/,
    );
  });

  it('una descripción larga se parte en vez de ensanchar la tabla', () => {
    expect(bloqueCss(css, '.enlace')).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it('el enlace de la fila usa tokens de texto y de enlace', () => {
    expect(bloqueCss(css, '.enlace')).toContain('var(--color-text)');
    expect(bloqueCss(css, '.enlace:hover')).toContain('var(--color-link)');
  });

  it('la diferencia resaltada usa el token del estado sin match', () => {
    expect(bloqueCss(celdaDiferencia, '.resaltada')).toContain(
      'var(--estado-sin-match-text)',
    );
    expect(bloqueCss(celdaDiferencia, '.atenuada')).toContain(
      'var(--color-text-secondary)',
    );
  });

  it('las barras de carga miden al menos un objetivo táctil', () => {
    expect(bloqueCss(css, '.barra')).toContain('var(--touch-min)');
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
    expect(celdaDiferencia).not.toMatch(LITERAL_DE_COLOR);
  });
});
