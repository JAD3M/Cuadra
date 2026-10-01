// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const nav = leerModuloCss('app/shell/NavItem.module.css');
const barra = leerModuloCss('app/shell/Sidebar.module.css');
const usuario = leerModuloCss('app/shell/UserBlock.module.css');

describe('contrato CSS de la barra lateral', () => {
  it('el elemento de navegación mide al menos --touch-min', () => {
    expect(bloqueCss(nav, '.item')).toMatch(
      /min-block-size:\s*var\(--touch-min\)/,
    );
  });

  it('el enlace tiene foco visible propio', () => {
    expect(bloqueCss(nav, '.item:focus-visible')).toMatch(
      /outline:\s*2px solid/,
    );
  });

  it('el activo usa el rol seleccionado', () => {
    expect(bloqueCss(nav, '.activo')).toMatch(
      /background:\s*var\(--color-selected\)/,
    );
  });

  it('el contador usa la fuente mono', () => {
    expect(bloqueCss(nav, '.contador')).toMatch(/var\(--font-mono\)/);
  });

  it('la barra usa el ancho del layout, no uno propio', () => {
    expect(barra).not.toMatch(/(?<!min-)inline-size:/);
    expect(bloqueCss(barra, '.barra')).toMatch(
      /background:\s*var\(--color-sidebar\)/,
    );
  });

  it('el pie queda al fondo de la barra', () => {
    expect(bloqueCss(barra, '.pie')).toMatch(/margin-block-start:\s*auto/);
  });

  it('solo usa tokens: sin literales de color', () => {
    for (const css of [nav, barra, usuario]) {
      expect(css).not.toMatch(LITERAL_DE_COLOR);
    }
  });
});
