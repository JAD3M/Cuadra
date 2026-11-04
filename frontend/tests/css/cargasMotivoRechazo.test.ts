// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

// Historia 3.7: el motivo del rechazo, en la fila expandible de Cargas y en
// la confirmación de la Vista previa. jsdom no calcula layout, así que el
// contrato se verifica sobre el texto del CSS. Ambos temas salen de los mismos
// roles de color: aquí no hay un solo literal.

const fila = leerModuloCss('features/cargas/components/FilaCarga.module.css');
const dialogo = leerModuloCss(
  'features/vista-previa/components/ConfirmarRechazo.module.css',
);

describe('contrato CSS del motivo del rechazo (3.7)', () => {
  it('ni la fila ni el diálogo llevan literales de color', () => {
    expect(fila).not.toMatch(LITERAL_DE_COLOR);
    expect(dialogo).not.toMatch(LITERAL_DE_COLOR);
  });

  it('el botón de la fila mide al menos 44 px por lado y no tiene fondo propio', () => {
    const boton = bloqueCss(fila, '.alternar');
    expect(boton).toContain('min-inline-size: var(--touch-min)');
    expect(boton).toContain('min-block-size: var(--touch-min)');
    expect(boton).toContain('var(--color-text-secondary)');
    expect(boton).toMatch(/background:\s*none/);
  });

  it('el botón muestra el foco con el acento y el giro sigue a aria-expanded', () => {
    expect(bloqueCss(fila, '.alternar:focus-visible')).toContain(
      'var(--color-accent)',
    );
    expect(bloqueCss(fila, ".alternar[aria-expanded='true'] .flecha")).toMatch(
      /rotate\(90deg\)/,
    );
  });

  it('la fila rechazada avisa que se puede pulsar y respeta reducir movimiento', () => {
    expect(bloqueCss(fila, '.expandible')).toMatch(/cursor:\s*pointer/);
    expect(fila).toMatch(/prefers-reduced-motion:\s*reduce/);
  });

  it('la fila de detalle usa el fondo hundido y el motivo el título de peligro a 13 px', () => {
    expect(bloqueCss(fila, '.detalle')).toContain('var(--color-inset)');
    const motivo = bloqueCss(fila, '.motivo');
    expect(motivo).toContain('var(--color-danger-title)');
    expect(motivo).toContain('var(--text-sm)');
  });

  it('el motivo se parte dentro de su contenedor, nunca lo desborda', () => {
    const motivo = bloqueCss(fila, '.motivo');
    expect(motivo).toMatch(/overflow-wrap:\s*anywhere/);
    expect(bloqueCss(fila, '.contenidoDetalle')).toMatch(
      /min-inline-size:\s*0/,
    );
    expect(motivo).not.toMatch(/white-space:\s*nowrap|text-overflow/);
  });

  it('el campo del motivo usa los roles del control, a todo el ancho y con foco visible', () => {
    const control = bloqueCss(dialogo, '.control');
    expect(control).toContain('var(--color-inset)');
    expect(control).toContain('var(--color-text)');
    expect(control).toMatch(/inline-size:\s*100%/);
    expect(control).toMatch(/box-sizing:\s*border-box/);
    expect(bloqueCss(dialogo, '.control:focus-visible')).toContain(
      'var(--color-accent)',
    );
  });

  it('la ayuda del campo es texto de apoyo atenuado', () => {
    const ayuda = bloqueCss(dialogo, '.ayuda');
    expect(ayuda).toContain('var(--color-muted)');
    expect(ayuda).toContain('var(--text-sm)');
  });
});
