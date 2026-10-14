// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

describe('contrato CSS de la lista de empresas de plataforma', () => {
  const css = leerModuloCss(
    'features/plataforma/components/EmpresasPlataforma.module.css',
  );

  it('el RFC va en monoespaciada y sin partirse', () => {
    const rfc = bloqueCss(css, '.rfc');
    expect(rfc).toMatch(/font-family:\s*var\(--font-mono\)/);
    expect(rfc).toMatch(/white-space:\s*nowrap/);
  });

  it('el encabezado de la columna RFC tampoco se parte', () => {
    expect(bloqueCss(css, '.sinPartir')).toMatch(/white-space:\s*nowrap/);
  });

  it('el botón del estado vacío mide el alto de control', () => {
    expect(bloqueCss(css, '.crear')).toMatch(
      /min-block-size:\s*var\(--control-height\)/,
    );
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});

describe('contrato CSS del formulario de alta', () => {
  const css = leerModuloCss(
    'features/plataforma/components/FormularioCrearEmpresa.module.css',
  );

  it('los campos se reparten en rejilla de mínimo 260 px', () => {
    expect(bloqueCss(css, '.campos')).toMatch(
      /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(260px,\s*1fr\)\)/,
    );
  });

  it('el campo RFC va en monoespaciada y sin partirse', () => {
    const rfc = bloqueCss(css, '.rfc');
    expect(rfc).toMatch(/font-family:\s*var\(--font-mono\)/);
    expect(rfc).toMatch(/white-space:\s*nowrap/);
  });

  it('las acciones miden el alto de control y envuelven', () => {
    expect(bloqueCss(css, '.accion')).toMatch(
      /min-block-size:\s*var\(--control-height\)/,
    );
    expect(bloqueCss(css, '.acciones')).toMatch(/flex-wrap:\s*wrap/);
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});

describe('contrato CSS del aviso de empresa creada', () => {
  const css = leerModuloCss(
    'features/plataforma/components/AvisoEmpresaCreada.module.css',
  );

  it('usa los tokens del estado conciliado y ningún literal de color', () => {
    expect(bloqueCss(css, '.aviso')).toMatch(
      /var\(--estado-conciliado-tile-border\)/,
    );
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});
