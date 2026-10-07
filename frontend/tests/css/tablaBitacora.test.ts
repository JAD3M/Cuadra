// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { leerColores } from './leerTokens';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const css = leerModuloCss(
  'features/bitacora/components/TablaBitacora.module.css',
);

describe('contrato CSS de la tabla de la bitácora', () => {
  it('un monto del detalle no se parte en dos líneas ni se recorta', () => {
    const monto = bloqueCss(css, '.monto');
    expect(monto).toMatch(/white-space:\s*nowrap/);
    expect(monto).not.toMatch(
      /overflow|text-overflow|max-inline-size|max-width/,
    );
  });

  it('el detalle y el id de la entidad se parten en vez de ensanchar la tabla', () => {
    expect(bloqueCss(css, '.detalle')).toMatch(/overflow-wrap:\s*anywhere/);
    expect(bloqueCss(css, '.entidadId')).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it('la fecha y el autor no se parten', () => {
    expect(bloqueCss(css, '.cuando')).toMatch(/white-space:\s*nowrap/);
    expect(bloqueCss(css, '.quien')).toMatch(/white-space:\s*nowrap/);
  });

  it('la fila de un acceso denegado usa --color-danger-row en sus celdas', () => {
    expect(bloqueCss(css, '.filaDenegada > td')).toContain(
      'var(--color-danger-row)',
    );
  });

  it('el chip del acceso denegado usa --color-danger-chip y danger-text', () => {
    const chip = bloqueCss(css, '.denegado');
    expect(chip).toContain('var(--color-danger-chip)');
    expect(chip).toContain('var(--color-danger-text)');
  });

  it('el chip de acción va en mono y no se parte', () => {
    const chip = bloqueCss(css, '.chip');
    expect(chip).toContain('var(--font-mono)');
    expect(chip).toMatch(/white-space:\s*nowrap/);
  });

  it('las barras de carga miden al menos un objetivo táctil', () => {
    expect(bloqueCss(css, '.barra')).toContain('var(--touch-min)');
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});

describe('tokens nuevos de peligro', () => {
  const { dark, light } = leerColores();

  it('el oscuro es el de la maqueta (Bitacora.dc.html)', () => {
    expect(dark['--color-danger-row']).toBe('#1a0e12');
    expect(dark['--color-danger-chip']).toBe('#3a121c');
  });

  it('el claro define los mismos roles', () => {
    expect(light['--color-danger-row']).toBe('#fff5f6');
    expect(light['--color-danger-chip']).toBe('#fbdde2');
  });
});
