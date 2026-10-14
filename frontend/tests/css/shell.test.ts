// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const layout = leerModuloCss('app/shell/ShellLayout.module.css');
const barra = leerModuloCss('app/shell/Sidebar.module.css');

describe('contrato CSS del layout del shell', () => {
  it('la rejilla usa la columna lateral y una columna que puede encogerse', () => {
    expect(bloqueCss(layout, '.shell')).toMatch(
      /grid-template-columns:\s*var\(--sidebar-width\)\s+minmax\(0,\s*1fr\)/,
    );
  });

  it('la columna de contenido no desborda a la rejilla', () => {
    expect(bloqueCss(layout, '.columna')).toMatch(/min-inline-size:\s*0/);
  });

  it('en pantallas anchas la barra lateral queda fija a la altura de la ventana y desplaza solo su propio contenido', () => {
    const anchas = barra.match(
      /@media\s*\(width\s*>=\s*900px\)\s*\{\s*\.barra\s*\{([^}]*)\}/,
    );
    expect(anchas).not.toBeNull();
    const reglas = anchas?.[1] ?? '';
    expect(reglas).toMatch(/position:\s*sticky/);
    expect(reglas).toMatch(/inset-block-start:\s*0/);
    expect(reglas).toMatch(/block-size:\s*100vh/);
    expect(reglas).toMatch(/align-self:\s*start/);
    expect(reglas).toMatch(/overflow-y:\s*auto/);
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

  it('el cambio al menú ocurre en el umbral literal de 900px', () => {
    expect(layout).toMatch(/@media\s*\(width\s*<\s*900px\)/);
  });

  it('el botón y la barra del menú no se muestran en pantallas anchas', () => {
    expect(layout).toMatch(
      /\.barraMovil,\s*\.botonMenu\s*\{[^}]*display:\s*none/,
    );
  });

  it('en pantallas anchas la barra lateral no altera la rejilla', () => {
    expect(bloqueCss(layout, '.lateral')).toMatch(/display:\s*contents/);
  });

  it('el panel cerrado sale del orden de tabulación con display none', () => {
    const [, estrecho] = layout.split('@media (width < 900px)');
    expect(estrecho).toMatch(/\.lateral\s*\{\s*display:\s*none/);
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
