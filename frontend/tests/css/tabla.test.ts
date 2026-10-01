// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

/**
 * Contrato de la celda numérica de montos (UI-2). jsdom no mide layout: el
 * comportamiento real se revisa a mano en la galería (slice 11).
 */
const css = leerModuloCss('shared/ui/Tabla.module.css');

describe('contrato CSS de Tabla', () => {
  const numerica = bloqueCss(css, '.numerica');

  it.each([
    ['alinea al final', /text-align:\s*end/],
    ['no parte el monto', /white-space:\s*nowrap/],
    ['ocupa solo lo que pide su contenido', /inline-size:\s*1%/],
  ])('la celda numérica %s', (_nombre, patron) => {
    expect(numerica).toMatch(patron);
  });

  it('la celda numérica no recorta ni oculta el monto', () => {
    expect(numerica).not.toMatch(/overflow/);
    expect(numerica).not.toMatch(/text-overflow/);
    expect(numerica).not.toMatch(/max-inline-size|max-width/);
  });

  it('el envoltorio hace scroll horizontal en vez de recortar', () => {
    expect(bloqueCss(css, '.envoltorio')).toMatch(/overflow-x:\s*auto/);
  });

  it('el encabezado y las celdas usan los tokens de borde y divisor', () => {
    expect(bloqueCss(css, '.th')).toMatch(/var\(--color-border\)/);
    expect(bloqueCss(css, '.td')).toMatch(/var\(--color-row-divider\)/);
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});
