// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  leerColores,
  leerTokensPorTema,
  RAIZ_FRONTEND,
  RUTA_COLORES,
} from './leerTokens';

const HEX_6 = /^#[0-9a-f]{6}$/i;
const LITERAL_COLOR =
  /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/i;

function archivos(dir: string, extensiones: string[]): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(ruta, extensiones);
    return extensiones.some((x) => e.name.endsWith(x)) ? [ruta] : [];
  });
}

describe('leerTokensPorTema', () => {
  it('separa el bloque oscuro (por omisión) del claro', () => {
    const css = `
      /* comentario con --color-falso: #000000; */
      :root, :root[data-theme='dark'] { --a: #111111; }
      :root[data-theme='light'] { --a: #eeeeee; --b: #ffffff; }`;
    expect(leerTokensPorTema(css)).toEqual({
      dark: { '--a': '#111111' },
      light: { '--a': '#eeeeee', '--b': '#ffffff' },
    });
  });
});

describe('tokens de color', () => {
  const { dark, light } = leerColores();

  it('hay tokens en ambos temas', () => {
    expect(Object.keys(dark).length).toBeGreaterThan(40);
    expect(Object.keys(light).length).toBeGreaterThan(40);
  });

  it('ambos temas definen exactamente los mismos nombres', () => {
    const soloOscuro = Object.keys(dark).filter((k) => !(k in light));
    const soloClaro = Object.keys(light).filter((k) => !(k in dark));
    expect({ soloOscuro, soloClaro }).toEqual({
      soloOscuro: [],
      soloClaro: [],
    });
  });

  it.each([
    ['dark', dark],
    ['light', light],
  ] as const)(
    'todos los valores del tema %s son hex de 6 dígitos',
    (_t, tokens) => {
      const invalidos = Object.entries(tokens).filter(
        ([, v]) => !HEX_6.test(v),
      );
      expect(invalidos).toEqual([]);
    },
  );

  it('cada tema declara su color-scheme', () => {
    const css = fs.readFileSync(RUTA_COLORES, 'utf8');
    expect(css).toMatch(/data-theme='dark'\]\s*\{\s*color-scheme: dark;/);
    expect(css).toMatch(/data-theme='light'\]\s*\{\s*color-scheme: light;/);
  });
});

describe('sin colores literales fuera de colors.css', () => {
  const src = path.join(RAIZ_FRONTEND, 'src');
  const candidatos = archivos(src, ['.css', '.ts', '.tsx']).filter(
    (f) => f !== RUTA_COLORES && !/\.test\.tsx?$/.test(f),
  );

  it('encuentra archivos que revisar', () => {
    expect(candidatos.length).toBeGreaterThan(0);
  });

  it('ningún CSS ni TS/TSX de src usa hex, rgb() ni hsl()', () => {
    const infractores = candidatos.filter((f) =>
      LITERAL_COLOR.test(
        fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
      ),
    );
    expect(infractores.map((f) => path.relative(RAIZ_FRONTEND, f))).toEqual([]);
  });

  it('el detector reconoce los literales prohibidos', () => {
    for (const malo of [
      '#fff',
      '#0a0e13',
      '#0a0e13cc',
      'rgb(1,2,3)',
      'hsl(0 0% 0%)',
    ]) {
      expect(LITERAL_COLOR.test(`color: ${malo};`)).toBe(true);
    }
    expect(LITERAL_COLOR.test('color: var(--color-text); margin: 4px;')).toBe(
      false,
    );
  });
});
