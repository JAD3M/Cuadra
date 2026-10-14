// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

describe('contrato CSS de la página de invitación', () => {
  const formulario = leerModuloCss(
    'features/invitaciones/components/FormularioAceptarInvitacion.module.css',
  );
  const terminal = leerModuloCss(
    'features/invitaciones/components/EstadoTerminalInvitacion.module.css',
  );

  it('el formulario usa la columna de acceso y el botón alto', () => {
    expect(bloqueCss(formulario, '.formulario')).toMatch(
      /max-inline-size:\s*var\(--auth-form-width\)/,
    );
    expect(bloqueCss(formulario, '.entrar')).toMatch(
      /min-block-size:\s*var\(--control-height-lg\)/,
    );
  });

  it('la tarjeta terminal mide como máximo 460 px', () => {
    expect(bloqueCss(terminal, '.tarjeta')).toMatch(/max-inline-size:\s*460px/);
  });

  it('el enlace de iniciar sesión mide el alto de control', () => {
    expect(bloqueCss(terminal, '.accion')).toMatch(
      /min-block-size:\s*var\(--control-height\)/,
    );
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(formulario).not.toMatch(LITERAL_DE_COLOR);
    expect(terminal).not.toMatch(LITERAL_DE_COLOR);
  });
});
