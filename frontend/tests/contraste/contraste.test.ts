// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { leerColores, type Tema } from '../css/leerTokens';
import { razonContraste } from './razonContraste';

/**
 * Pares texto-sobre-fondo declarados. Cada par es [primer plano, fondo]
 * con nombres de token. Los bordes y divisores son decorativos y quedan
 * fuera a propósito (WCAG 1.4.11 no los exige cuando no transmiten
 * información por sí solos).
 */
const NIVELES_TEXTO = [
  '--color-text',
  '--color-text-soft',
  '--color-text-secondary',
  '--color-muted',
] as const;
const FONDOS_BASE = [
  '--color-ground',
  '--color-sidebar',
  '--color-surface',
  '--color-surface-raised',
  '--color-inset',
] as const;
const ESTADOS = ['sugerencia', 'sin-match', 'conciliado'] as const;

type Par = readonly [string, string];

const PARES: Par[] = [
  ...NIVELES_TEXTO.flatMap((t) => FONDOS_BASE.map((f): Par => [t, f])),
  ...(['--color-hover', '--color-hover-2'] as const).flatMap((f) =>
    (['--color-text', '--color-text-secondary', '--color-muted'] as const).map(
      (t): Par => [t, f],
    ),
  ),
  // Fila de navegación activa: texto y contador (enlace) sobre el fondo elegido.
  ['--color-text', '--color-selected'],
  ['--color-link', '--color-selected'],
  ...(['--color-link', '--color-link-hover'] as const).flatMap((l) =>
    (
      [
        '--color-ground',
        '--color-sidebar',
        '--color-surface',
        '--color-inset',
      ] as const
    ).map((f): Par => [l, f]),
  ),
  ...ESTADOS.flatMap((s): Par[] => [
    [`--estado-${s}-text`, `--estado-${s}-tint`],
    [`--estado-${s}-text`, `--estado-${s}-tile-bg`],
    [`--estado-${s}-text`, '--color-surface'],
    [`--estado-${s}-accent`, '--color-surface'],
    [`--estado-${s}-accent`, `--estado-${s}-tile-bg`],
    ['--color-text-secondary', `--estado-${s}-tile-bg`],
  ]),
  ['--estado-conciliado-on-accent', '--estado-conciliado-accent'],
  ['--color-on-accent', '--color-accent'],
  ['--estado-sin-match-on-accent', '--estado-sin-match-accent'],
  ['--color-danger-text', '--color-danger-tint'],
  ['--color-danger-text', '--color-surface'],
  ['--color-danger-title', '--color-danger-tint'],
  ['--color-text-soft', '--color-danger-tint'],
  ['--color-danger', '--color-surface'],
  ['--color-ia', '--color-ia-tint'],
  ['--color-ia', '--color-surface'],
  ['--color-text-secondary', '--color-chip-neutral'],
  ['--color-muted', '--color-chip-neutral'],
  ['--color-text-soft', '--color-chip-neutral'],
  // Pantallas de acceso (Main.dc.html), M6. Ya cubiertos arriba: alerta
  // (danger-text, danger-title y text-soft sobre danger-tint), campo
  // (text, text-secondary y muted sobre sidebar/ground) y panel de marca.
  // Aviso informativo: texto sobre su fondo (el borde es decorativo).
  ['--color-text', '--estado-sugerencia-tile-bg'],
  // Campo: mensaje de error sobre el fondo del control y del panel.
  ['--color-danger-text', '--color-sidebar'],
  ['--color-danger-text', '--color-ground'],
  // Rótulo "Paso N de 2" del formulario sobre el fondo del panel.
  ['--color-accent', '--color-ground'],
];

/** Indicadores no textuales (foco y enlaces): mínimo 3:1. */
const PARES_NO_TEXTO: Par[] = [
  '--color-ground',
  '--color-surface',
  '--color-sidebar',
].flatMap((f): Par[] => [
  ['--color-link', f],
  ['--color-accent', f],
]);

const TEMAS: Tema[] = ['dark', 'light'];

function ratio(tema: Tema, [fg, bg]: Par): number {
  const tokens = leerColores()[tema];
  const primero = tokens[fg];
  const segundo = tokens[bg];
  if (!primero || !segundo) {
    throw new Error(`Falta el token ${!primero ? fg : bg} en el tema ${tema}`);
  }
  return razonContraste(primero, segundo);
}

describe('razonContraste', () => {
  it('negro sobre blanco es 21:1 y es simétrico', () => {
    expect(razonContraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(razonContraste('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('el mismo color es 1:1', () => {
    expect(razonContraste('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('#777777 sobre blanco queda por debajo de 4.5 (referencia WCAG ~4.48)', () => {
    const r = razonContraste('#777777', '#ffffff');
    expect(r).toBeGreaterThan(4.4);
    expect(r).toBeLessThan(4.5);
  });
});

describe.each(TEMAS)('contraste de texto, tema %s', (tema) => {
  it('declara pares y todos existen en el tema', () => {
    expect(PARES.length).toBeGreaterThan(60);
    for (const par of PARES)
      expect(Number.isFinite(ratio(tema, par))).toBe(true);
  });

  it.each(PARES)('%s sobre %s alcanza 4.5:1', (fg, bg) => {
    const r = ratio(tema, [fg, bg]);
    expect(
      r,
      `tema ${tema}: ${fg} sobre ${bg} mide ${r.toFixed(2)}:1 (mínimo 4.5:1)`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PARES_NO_TEXTO)('%s sobre %s alcanza 3:1 (no texto)', (fg, bg) => {
    const r = ratio(tema, [fg, bg]);
    expect(
      r,
      `tema ${tema}: ${fg} sobre ${bg} mide ${r.toFixed(2)}:1 (mínimo 3:1)`,
    ).toBeGreaterThanOrEqual(3);
  });
});
