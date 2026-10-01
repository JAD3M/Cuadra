// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const layout = leerModuloCss('app/shell/ShellLayout.module.css');

describe('contrato CSS del layout del shell', () => {
  it('la rejilla usa la columna lateral y una columna que puede encogerse', () => {
    expect(bloqueCss(layout, '.shell')).toMatch(
      /grid-template-columns:\s*var\(--sidebar-width\)\s+minmax\(0,\s*1fr\)/,
    );
  });

  it('la columna de contenido no desborda a la rejilla', () => {
    expect(bloqueCss(layout, '.columna')).toMatch(/min-inline-size:\s*0/);
  });

  it('el enlace de salto cumple el tamaño táctil mínimo', () => {
    expect(bloqueCss(layout, '.saltar')).toMatch(
      /min-block-size:\s*var\(--touch-min\)/,
    );
  });

  it('el enlace de salto queda fuera de pantalla y aparece con el foco', () => {
    expect(bloqueCss(layout, '.saltar')).toMatch(/translateY\(-200%\)/);
    expect(bloqueCss(layout, '.saltar:focus-visible')).toMatch(
      /translateY\(0\)/,
    );
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(layout).not.toMatch(LITERAL_DE_COLOR);
  });
});

describe('--touch-min en los módulos interactivos', () => {
  it.each([
    ['app/shell/NavItem.module.css', '.item'],
    ['app/shell/ShellLayout.module.css', '.saltar'],
    ['shared/ui/Button.module.css', '.boton'],
    ['shared/tema/SelectorTema.module.css', '.opcion'],
  ])('%s declara --touch-min en %s', (modulo, selector) => {
    expect(bloqueCss(leerModuloCss(modulo), selector)).toMatch(
      /var\(--touch-min\)/,
    );
  });
});
