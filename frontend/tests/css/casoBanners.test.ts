// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const RAIZ = 'features/caso/components/';
const MODULOS = [
  'BannerResolucion',
  'ErrorCaso',
  'EstadoCargaCaso',
  'EnlaceBandeja',
] as const;

const css = Object.fromEntries(
  MODULOS.map((nombre) => [
    nombre,
    leerModuloCss(`${RAIZ}${nombre}.module.css`),
  ]),
) as Record<(typeof MODULOS)[number], string>;

describe('contrato CSS de los banners y errores del caso', () => {
  it.each(MODULOS)('%s solo usa tokens: sin literales de color', (nombre) => {
    expect(css[nombre]).not.toMatch(LITERAL_DE_COLOR);
  });

  it('el banner confirmado usa los tokens de la baldosa conciliado', () => {
    const banner = css.BannerResolucion;
    const confirmado = bloqueCss(banner, '.confirmado');
    expect(confirmado).toContain('var(--estado-conciliado-tile-bg)');
    expect(confirmado).toContain('var(--estado-conciliado-tile-border)');
    expect(bloqueCss(banner, '.confirmado .titulo')).toContain(
      'var(--estado-conciliado-text)',
    );
  });

  it('el banner rechazado usa los tokens de la baldosa sin match', () => {
    const banner = css.BannerResolucion;
    const rechazado = bloqueCss(banner, '.rechazado');
    expect(rechazado).toContain('var(--estado-sin-match-tile-bg)');
    expect(rechazado).toContain('var(--estado-sin-match-tile-border)');
    expect(bloqueCss(banner, '.rechazado .titulo')).toContain(
      'var(--estado-sin-match-text)',
    );
  });

  it('el banner se puede enfocar y el foco es visible', () => {
    expect(css.BannerResolucion).toContain('.banner:focus-visible');
    expect(css.BannerResolucion).toContain(
      'outline: 2px solid var(--color-accent)',
    );
  });

  it('el esqueleto usa el fondo de carga de la bandeja', () => {
    expect(css.EstadoCargaCaso).toContain('var(--color-hover-2)');
  });

  it('los enlaces a la bandeja miden al menos 44 px', () => {
    expect(bloqueCss(css.EnlaceBandeja, '.atras')).toContain(
      'var(--touch-min)',
    );
    expect(bloqueCss(css.EnlaceBandeja, '.accion')).toContain(
      'var(--touch-min)',
    );
  });
});
