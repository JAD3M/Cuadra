// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

describe('contrato CSS del panel «Invitar administrador»', () => {
  const css = leerModuloCss(
    'features/plataforma/components/FormularioInvitarAdmin.module.css',
  );

  it('el campo mide como máximo 460 px', () => {
    expect(bloqueCss(css, '.campo')).toMatch(/max-inline-size:\s*460px/);
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

describe('contrato CSS de la columna «Acciones»', () => {
  const css = leerModuloCss(
    'features/plataforma/components/EmpresasPlataforma.module.css',
  );

  it('el botón de la fila no se parte', () => {
    expect(bloqueCss(css, '.acciones')).toMatch(/white-space:\s*nowrap/);
  });
});
