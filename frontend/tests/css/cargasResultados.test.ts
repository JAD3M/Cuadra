// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { razonContraste } from '../contraste/razonContraste';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';
import { leerColores, type Tema } from './leerTokens';

const MODULOS = {
  resultado: 'features/cargas/components/resultado.module.css',
  aviso: 'features/cargas/components/AvisoYaExistia.module.css',
  fallido: 'features/cargas/components/ResultadoFallido.module.css',
  barra: 'features/cargas/components/BarraAvance.module.css',
} as const;

const css = Object.fromEntries(
  Object.entries(MODULOS).map(([nombre, ruta]) => [
    nombre,
    leerModuloCss(ruta),
  ]),
) as Record<keyof typeof MODULOS, string>;

describe('contrato CSS de los paneles de resultado', () => {
  it('solo usa tokens: sin literales de color en ningún módulo', () => {
    for (const [nombre, fuente] of Object.entries(css)) {
      expect(fuente, nombre).not.toMatch(LITERAL_DE_COLOR);
    }
  });

  it('las cifras no se parten y la caja crece con el número', () => {
    const cifra = bloqueCss(css.resultado, '.cifra');
    expect(cifra).toMatch(/white-space:\s*nowrap/);
    expect(cifra).not.toMatch(/overflow|text-overflow|max-inline-size|width/);
  });

  it('el estado de cada archivo no se parte', () => {
    expect(bloqueCss(css.resultado, '.estado')).toMatch(
      /white-space:\s*nowrap/,
    );
  });

  it('las listas se desplazan, nunca recortan, y muestran el foco', () => {
    const region = bloqueCss(css.resultado, '.region');
    expect(region).toMatch(/overflow:\s*auto/);
    expect(region).not.toMatch(/overflow:\s*hidden/);
    expect(bloqueCss(css.resultado, '.region:focus-visible')).toContain(
      'var(--color-accent)',
    );
  });

  it('la caja vive sobre el fondo hundido', () => {
    expect(bloqueCss(css.resultado, '.caja')).toContain('var(--color-inset)');
  });

  it('cada resultado de archivo usa su color de texto y el estado también va en texto', () => {
    expect(
      bloqueCss(css.resultado, ".archivo[data-tono='ok'] .estado"),
    ).toContain('var(--estado-conciliado-text)');
    expect(
      bloqueCss(css.resultado, ".archivo[data-tono='neutro'] .estado"),
    ).toContain('var(--color-muted)');
    expect(
      bloqueCss(css.resultado, ".archivo[data-tono='peligro'] .estado"),
    ).toContain('var(--color-danger-text)');
    expect(bloqueCss(css.resultado, '.motivo')).toContain(
      'var(--color-danger-title)',
    );
    expect(bloqueCss(css.resultado, '.fila')).toContain(
      'var(--color-danger-title)',
    );
  });

  it('el aviso de que ya existía usa la baldosa de sugerencia, sin opacity', () => {
    const aviso = bloqueCss(css.aviso, '.aviso');
    expect(aviso).toContain('var(--estado-sugerencia-tile-bg)');
    expect(aviso).toContain('var(--estado-sugerencia-tile-border)');
    expect(aviso).toContain('var(--color-text)');
    expect(css.aviso).not.toMatch(/opacity/);
  });

  it('la falla usa el tinte y el borde de peligro', () => {
    const fallido = bloqueCss(css.fallido, '.fallido');
    expect(fallido).toContain('var(--color-danger-tint)');
    expect(fallido).toContain('var(--color-danger-border)');
    expect(bloqueCss(css.fallido, '.etiqueta')).toContain(
      'var(--color-danger-title)',
    );
    expect(bloqueCss(css.fallido, '.detalle')).toContain(
      'var(--color-text-soft)',
    );
  });

  it('la barra del panel conserva la animación y la apaga con prefers-reduced-motion', () => {
    expect(bloqueCss(css.barra, '.indeterminada')).toContain('animation:');
    expect(css.barra).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.indeterminada\s*\{[^}]*animation:\s*none/,
    );
  });
});

/**
 * Pares texto-sobre-fondo que pinta el panel, medidos aquí con los tokens del
 * tema. Ninguno es nuevo: todos están también en `contraste.test.ts` (S4 y S5),
 * pero este contrato falla si el módulo cambia a un par que nadie midió.
 */
const PARES_DEL_PANEL: readonly (readonly [string, string])[] = [
  ['--color-text', '--color-inset'],
  ['--estado-conciliado-text', '--color-inset'],
  ['--color-muted', '--color-inset'],
  ['--color-danger-text', '--color-inset'],
  ['--color-danger-title', '--color-inset'],
  ['--color-text', '--estado-sugerencia-tile-bg'],
  ['--color-danger-title', '--color-danger-tint'],
  ['--color-danger-text', '--color-danger-tint'],
  ['--color-text-soft', '--color-danger-tint'],
];

describe.each<Tema>(['dark', 'light'])(
  'contraste del panel, tema %s',
  (tema) => {
    it.each(PARES_DEL_PANEL)('%s sobre %s alcanza 4.5:1', (fg, bg) => {
      const tokens = leerColores()[tema];
      const primero = tokens[fg];
      const segundo = tokens[bg];
      if (!primero || !segundo) throw new Error(`Falta ${fg} o ${bg}`);
      const r = razonContraste(primero, segundo);
      expect(
        r,
        `tema ${tema}: ${fg} sobre ${bg} mide ${r.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  },
);
