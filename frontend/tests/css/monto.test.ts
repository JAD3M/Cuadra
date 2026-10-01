// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ_FRONTEND } from './leerTokens';

/**
 * jsdom no calcula layout, así que el contrato anti-desborde de Monto se
 * verifica sobre el texto del CSS. El comportamiento real en el navegador se
 * revisa a mano en la galería (slice 11).
 */
const css = fs.readFileSync(
  path.join(RAIZ_FRONTEND, 'src/shared/ui/Monto.module.css'),
  'utf8',
);

function bloque(selector: string): string {
  const coincidencia = css.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`));
  if (!coincidencia?.[1]) throw new Error(`Sin bloque .${selector}`);
  return coincidencia[1];
}

describe('contrato CSS de Monto', () => {
  const monto = bloque('monto');

  it.each([
    ['no se parte en líneas', /white-space:\s*nowrap/],
    ['usa la fuente mono', /font-family:\s*var\(--font-mono\)/],
    ['usa numerales tabulares', /font-variant-numeric:\s*tabular-nums/],
    [
      'mide al menos lo que ocupa su contenido',
      /min-inline-size:\s*max-content/,
    ],
    ['no se encoge dentro de un flex', /flex-shrink:\s*0/],
  ])('%s', (_nombre, patron) => {
    expect(monto).toMatch(patron);
  });

  it('no depende de un ancho fijo ni recorta el contenido', () => {
    expect(monto).not.toMatch(
      /(?:^|[\s;])(?:inline-size|width|max-inline-size|max-width)\s*:/,
    );
    expect(monto).not.toMatch(/overflow/);
    expect(monto).not.toMatch(/text-overflow/);
  });

  it('el estado negativo usa el token de texto de peligro', () => {
    expect(bloque('negativo')).toMatch(/color:\s*var\(--color-danger-text\)/);
  });

  it('solo usa tokens: sin literales de color', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });

  it('el auxiliar de texto oculto es local y solo recorta ese texto', () => {
    const oculto = bloque('ocultoVisual');
    expect(oculto).toMatch(/clip-path/);
    expect(monto).not.toMatch(/clip/);
  });
});
