// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { razonContraste } from '../contraste/razonContraste';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';
import { leerColores, type Tema } from './leerTokens';

const aviso = leerModuloCss(
  'features/cargas/components/AvisoActualizacion.module.css',
);

describe('contrato CSS del aviso de actualización', () => {
  it('solo usa tokens: sin literales de color', () => {
    expect(aviso).not.toMatch(LITERAL_DE_COLOR);
  });

  it('el texto usa el color secundario y no tiene opacity', () => {
    expect(bloqueCss(aviso, '.texto')).toContain('var(--color-text-secondary)');
    expect(aviso).not.toMatch(/opacity/);
  });

  it('en la tarjeta vive sobre el fondo hundido, como la caja del resultado', () => {
    const caja = bloqueCss(aviso, '.caja');
    expect(caja).toContain('var(--color-inset)');
    expect(caja).toContain('var(--color-border)');
  });
});

/**
 * Pares texto-sobre-fondo de las alertas de subida y del aviso. Ninguno es
 * nuevo (están en `contraste.test.ts`); este contrato falla si el módulo pasa
 * a un par que nadie midió.
 *  - aviso en el encabezado: text-secondary sobre surface
 *  - aviso en la tarjeta: text-secondary sobre inset
 *  - alerta (AlertaError): danger-title y text-soft sobre danger-tint
 */
const PARES: readonly (readonly [string, string])[] = [
  ['--color-text-secondary', '--color-surface'],
  ['--color-text-secondary', '--color-inset'],
  ['--color-danger-title', '--color-danger-tint'],
  ['--color-text-soft', '--color-danger-tint'],
];

describe.each<Tema>(['dark', 'light'])(
  'contraste de las alertas y el aviso, tema %s',
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
