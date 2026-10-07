// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { razonContraste } from '../contraste/razonContraste';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';
import { leerColores, RAIZ_FRONTEND, type Tema } from './leerTokens';

/** Los contratos miran las declaraciones, no lo que dicen los comentarios. */
const sinComentarios = (css: string): string =>
  css.replace(/\/\*[\s\S]*?\*\//g, '');

const tarjeta = sinComentarios(
  leerModuloCss('features/tolerancia/components/TarjetaValor.module.css'),
);
const aviso = sinComentarios(
  leerModuloCss('features/tolerancia/components/AvisoSoloAdmin.module.css'),
);

/** Módulos de la pantalla de Tolerancia que ya existen en esta rebanada. */
const MODULOS: readonly (readonly [string, string])[] = [
  ['TarjetaValor', tarjeta],
  ['AvisoSoloAdmin', aviso],
];

describe.each(MODULOS)('contrato CSS de %s', (_nombre, css) => {
  it('solo usa tokens: sin literales de color (TOL-11.3)', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });

  it('no usa opacity para atenuar nada', () => {
    expect(css).not.toMatch(/opacity/);
  });
});

describe('contrato CSS del monto del valor (TOL-1.7)', () => {
  it('el monto no se parte en dos líneas', () => {
    expect(bloqueCss(tarjeta, '.monto')).toMatch(/white-space:\s*nowrap/);
  });

  it('nada recorta el monto: ningún overflow hidden en el módulo', () => {
    expect(tarjeta).not.toMatch(/overflow(-x|-y)?:\s*hidden/);
  });

  it('la fuente crece con el ancho de la tarjeta entre dos tokens', () => {
    const monto = bloqueCss(tarjeta, '.monto');
    expect(monto).toMatch(
      /font-size:\s*clamp\(var\(--text-hero\),\s*[\d.]+cqi,\s*var\(--text-display-xl\)\)/,
    );
    expect(bloqueCss(tarjeta, '.tarjeta')).toMatch(
      /container-type:\s*inline-size/,
    );
  });

  it('la fila del valor deja caer «MXN» y desplaza como último recurso', () => {
    const valor = bloqueCss(tarjeta, '.valor');
    expect(valor).toMatch(/flex-wrap:\s*wrap/);
    expect(valor).toMatch(/overflow-x:\s*auto/);
  });

  it('el monto va en mono, con el acento del estado sin match', () => {
    const monto = bloqueCss(tarjeta, '.monto');
    expect(monto).toContain('var(--font-mono)');
    expect(monto).toContain('var(--estado-sin-match-accent)');
  });

  it('la tarjeta usa las superficies de las otras tarjetas', () => {
    const bloque = bloqueCss(tarjeta, '.tarjeta');
    expect(bloque).toContain('var(--color-surface)');
    expect(bloque).toContain('var(--color-border)');
  });
});

describe('contrato CSS del aviso de solo administrador', () => {
  it('vive sobre el fondo hundido con el texto suave', () => {
    const bloque = bloqueCss(aviso, '.aviso');
    expect(bloque).toContain('var(--color-inset)');
    expect(bloque).toContain('var(--color-text-soft)');
  });

  it('el candado usa el color secundario', () => {
    expect(bloqueCss(aviso, '.icono')).toContain('var(--color-text-secondary)');
  });
});

describe('token del monto grande', () => {
  it('--text-display-xl vale 88px y se declara una vez', () => {
    const base = fs
      .readFileSync(
        path.join(RAIZ_FRONTEND, 'src/shared/styles/tokens/base.css'),
        'utf8',
      )
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const declaraciones = [
      ...base.matchAll(/(--text-display-xl)\s*:\s*([^;]+);/g),
    ];
    expect(declaraciones).toHaveLength(1);
    expect(declaraciones[0]?.[2]?.trim()).toBe('88px');
  });
});

/**
 * Pares texto-sobre-fondo de la tarjeta del valor y del aviso. Ninguno es nuevo
 * (están en `contraste.test.ts`); este contrato falla si el módulo pasa a un par
 * que nadie midió.
 *  - título de la tarjeta: muted sobre surface
 *  - monto: sin-match-accent sobre surface
 *  - «MXN»: text-secondary sobre surface
 *  - párrafo: text-soft sobre surface
 *  - aviso: text-soft y text-secondary (candado) sobre inset
 */
const PARES: readonly (readonly [string, string])[] = [
  ['--color-muted', '--color-surface'],
  ['--estado-sin-match-accent', '--color-surface'],
  ['--color-text-secondary', '--color-surface'],
  ['--color-text-soft', '--color-surface'],
  ['--color-text-soft', '--color-inset'],
  ['--color-text-secondary', '--color-inset'],
];

describe.each<Tema>(['dark', 'light'])(
  'contraste de la tarjeta del valor y del aviso, tema %s',
  (tema) => {
    it.each(PARES)('%s sobre %s alcanza 4.5:1', (fg, bg) => {
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
