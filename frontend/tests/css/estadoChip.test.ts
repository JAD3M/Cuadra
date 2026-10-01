// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const css = leerModuloCss('shared/ui/EstadoChip.module.css');

const ESPERADO: Record<string, [string, string]> = {
  sugerencia: ['--estado-sugerencia-tint', '--estado-sugerencia-text'],
  sin_match: ['--estado-sin-match-tint', '--estado-sin-match-text'],
  conciliado: ['--estado-conciliado-tint', '--estado-conciliado-text'],
  neutral: ['--color-chip-neutral', '--color-text-secondary'],
  ia: ['--color-ia-tint', '--color-ia'],
  peligro: ['--color-danger-tint', '--color-danger-text'],
};

describe('contrato CSS de EstadoChip', () => {
  it.each(Object.entries(ESPERADO))(
    'el tono %s usa sus tokens de fondo y texto',
    (tono, [fondo, texto]) => {
      const bloque = bloqueCss(css, `.${tono}`);
      expect(bloque).toContain(`background: var(${fondo})`);
      expect(bloque).toContain(`color: var(${texto})`);
    },
  );

  it('no se parte en líneas', () => {
    expect(bloqueCss(css, '.chip')).toMatch(/white-space:\s*nowrap/);
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});
