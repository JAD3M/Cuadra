// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const MODULOS = [
  'features/auth/components/LayoutAuth.module.css',
  'features/auth/components/PanelMarca.module.css',
  'features/auth/components/AvisoAuth.module.css',
] as const;

describe('contrato CSS de LayoutAuth', () => {
  const css = leerModuloCss('features/auth/components/LayoutAuth.module.css');
  const [ancho, estrecho] = css.split('@media (width < 900px)');

  it('usa el literal de 900 px del shell', () => {
    expect(estrecho).toBeDefined();
    expect(css).not.toMatch(/max-width:\s*900px/);
  });

  it('en ancho reparte 1.1fr / 1fr con minmax(0, ...)', () => {
    expect(bloqueCss(ancho ?? '', '.layout')).toMatch(
      /grid-template-columns:\s*minmax\(0, 1\.1fr\) minmax\(0, 1fr\)/,
    );
  });

  it('el control de tema flota arriba a la derecha con el ancho del token', () => {
    const tema = bloqueCss(ancho ?? '', '.tema');
    expect(tema).toMatch(/position:\s*absolute/);
    expect(tema).toMatch(/inset-block-start:\s*var\(--space-24\)/);
    expect(tema).toMatch(/inset-inline-end:\s*var\(--space-24\)/);
    expect(tema).toMatch(/inline-size:\s*var\(--auth-theme-width\)/);
  });

  it('bajo 900 px queda una columna y se oculta el panel de marca', () => {
    expect(bloqueCss(estrecho ?? '', '.layout')).toMatch(
      /grid-template-columns:\s*minmax\(0, 1fr\)/,
    );
    expect(bloqueCss(estrecho ?? '', '.marca')).toMatch(/display:\s*none/);
  });

  it('bajo 900 px el control de tema deja de flotar', () => {
    const tema = bloqueCss(estrecho ?? '', '.tema');
    expect(tema).toMatch(/position:\s*static/);
    expect(tema).toMatch(/align-self:\s*flex-end/);
  });

  it('el panel del formulario usa el relleno de la maqueta', () => {
    expect(bloqueCss(ancho ?? '', '.formulario')).toMatch(
      /padding:\s*var\(--space-64\) var\(--space-48\)/,
    );
  });
});

describe('contrato CSS de PanelMarca', () => {
  const css = leerModuloCss('features/auth/components/PanelMarca.module.css');

  it('el titular y el apoyo usan los tokens de escala de la maqueta', () => {
    const titular = bloqueCss(css, '.titular');
    expect(titular).toMatch(/font-size:\s*var\(--text-hero\)/);
    expect(titular).toMatch(/line-height:\s*var\(--leading-hero\)/);
    expect(titular).toMatch(/letter-spacing:\s*var\(--tracking-hero\)/);
    const apoyo = bloqueCss(css, '.apoyo');
    expect(apoyo).toMatch(/font-size:\s*var\(--text-lead\)/);
    expect(apoyo).toMatch(/line-height:\s*var\(--leading-support\)/);
  });
});

describe('contrato CSS de AvisoAuth', () => {
  const css = leerModuloCss('features/auth/components/AvisoAuth.module.css');

  it('pinta con los roles del aviso informativo', () => {
    const aviso = bloqueCss(css, '.aviso');
    expect(aviso).toMatch(
      /border:\s*1px solid var\(--estado-sugerencia-tile-border\)/,
    );
    expect(aviso).toMatch(/background:\s*var\(--estado-sugerencia-tile-bg\)/);
  });

  it('declara foco visible propio', () => {
    expect(bloqueCss(css, '.aviso:focus-visible')).toMatch(
      /outline:\s*2px solid var\(--color-accent\)/,
    );
  });
});

describe('módulos de acceso', () => {
  it.each(MODULOS)('%s solo usa tokens: sin literales de color', (ruta) => {
    expect(leerModuloCss(ruta)).not.toMatch(LITERAL_DE_COLOR);
  });
});
