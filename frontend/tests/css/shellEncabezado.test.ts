// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bloqueCss, leerModuloCss, LITERAL_DE_COLOR } from './leerCss';

const insignia = leerModuloCss('app/shell/CompanyBadge.module.css');
const encabezado = leerModuloCss('app/shell/Header.module.css');

describe('contrato CSS de la insignia de empresa', () => {
  it('el RFC usa la fuente mono y no se parte', () => {
    const rfc = bloqueCss(insignia, '.rfc');
    expect(rfc).toMatch(/font-family:\s*var\(--font-mono\)/);
    expect(rfc).toMatch(/white-space:\s*nowrap/);
    expect(rfc).toMatch(/flex-shrink:\s*0/);
  });

  it('nada recorta el contenido', () => {
    expect(insignia).not.toMatch(/overflow:\s*hidden/);
    expect(insignia).not.toMatch(/text-overflow/);
  });

  it('el nombre puede partirse sin desbordar', () => {
    expect(bloqueCss(insignia, '.nombre')).toMatch(/overflow-wrap:\s*anywhere/);
    expect(bloqueCss(insignia, '.datos')).toMatch(/min-inline-size:\s*0/);
  });

  it('el mosaico no se encoge', () => {
    expect(bloqueCss(insignia, '.mosaico')).toMatch(/flex-shrink:\s*0/);
  });

  it('el encabezado permite que la insignia pase a otra línea', () => {
    expect(bloqueCss(encabezado, '.fila')).toMatch(/flex-wrap:\s*wrap/);
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(insignia).not.toMatch(LITERAL_DE_COLOR);
    expect(encabezado).not.toMatch(LITERAL_DE_COLOR);
  });
});
