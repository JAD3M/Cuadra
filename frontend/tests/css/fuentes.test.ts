// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ_FRONTEND } from './leerTokens';

const estilos = path.join(RAIZ_FRONTEND, 'src/shared/styles');
const leer = (ruta: string) => fs.readFileSync(ruta, 'utf8');

describe('fuentes autoalojadas', () => {
  const fuentes = leer(path.join(estilos, 'fuentes.css'));
  const importaciones = [...fuentes.matchAll(/@import '([^']+)'/g)].map(
    (m) => m[1] ?? '',
  );

  it('carga solo el subconjunto latino de IBM Plex en cuatro pesos', () => {
    const esperadas = ['ibm-plex-sans', 'ibm-plex-mono'].flatMap((familia) =>
      [400, 500, 600, 700].map(
        (peso) => `@fontsource/${familia}/latin-${peso}.css`,
      ),
    );
    expect(importaciones).toEqual(esperadas);
  });

  it('cada importación existe en node_modules y registra la familia esperada', () => {
    for (const ruta of importaciones) {
      const css = leer(path.join(RAIZ_FRONTEND, 'node_modules', ruta));
      const familia = ruta.includes('sans') ? 'IBM Plex Sans' : 'IBM Plex Mono';
      expect(css).toContain(`font-family: '${familia}'`);
      expect(css).toContain('font-display: swap');
    }
  });

  it('--font-ui y --font-mono usan los nombres de familia registrados', () => {
    const base = leer(path.join(estilos, 'tokens/base.css'));
    expect(base).toMatch(/--font-ui: 'IBM Plex Sans'/);
    expect(base).toMatch(/--font-mono: 'IBM Plex Mono'/);
  });

  it('index.css importa fuentes, tokens y reset', () => {
    const indice = leer(path.join(estilos, 'index.css'));
    for (const parte of ['fuentes', 'tokens/colors', 'tokens/base', 'reset']) {
      expect(indice).toContain(`./${parte}.css`);
    }
  });

  it('main.tsx importa los estilos globales', () => {
    expect(leer(path.join(RAIZ_FRONTEND, 'src/main.tsx'))).toContain(
      "import './shared/styles/index.css';",
    );
  });

  it('ni src ni index.html referencian hosts de fuentes de terceros', () => {
    const revisar = [
      path.join(RAIZ_FRONTEND, 'index.html'),
      ...fs
        .readdirSync(estilos, { recursive: true })
        .map(String)
        .filter((f) => f.endsWith('.css'))
        .map((f) => path.join(estilos, f)),
    ];
    for (const archivo of revisar) {
      expect(leer(archivo), archivo).not.toMatch(
        /fonts\.googleapis|gstatic|https?:\/\//,
      );
    }
  });
});
