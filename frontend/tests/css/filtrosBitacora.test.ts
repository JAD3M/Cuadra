// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const css = leerModuloCss(
  'features/bitacora/components/FiltrosBitacora.module.css',
);

describe('contrato CSS de los filtros de la bitácora', () => {
  it('cinco columnas que bajan a dos y a una en pantallas angostas', () => {
    expect(bloqueCss(css, '.filtros')).toMatch(
      /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 900px\)\s*\{\s*\.filtros\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 520px\)\s*\{\s*\.filtros\s*\{\s*grid-template-columns:\s*1fr/,
    );
  });

  it('cada control mide al menos un objetivo táctil y muestra el foco', () => {
    expect(bloqueCss(css, '.control')).toContain('var(--touch-min)');
    expect(bloqueCss(css, '.control:focus-visible')).toContain(
      'var(--color-accent)',
    );
  });

  it('el campo inválido cambia el borde a peligro y el aviso usa danger-text', () => {
    expect(bloqueCss(css, ".control[aria-invalid='true']")).toContain(
      'var(--color-danger)',
    );
    expect(bloqueCss(css, '.rango')).toContain('var(--color-danger-text)');
    expect(bloqueCss(css, '.rango')).toMatch(/grid-column:\s*1 \/ -1/);
    expect(bloqueCss(css, '.error')).toContain('var(--color-danger-text)');
  });

  it('las fechas van en mono', () => {
    expect(bloqueCss(css, '.fecha')).toContain('var(--font-mono)');
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(LITERAL_DE_COLOR);
  });
});
