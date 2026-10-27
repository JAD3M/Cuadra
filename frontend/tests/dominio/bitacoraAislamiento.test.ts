// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ_FRONTEND, RUTA_COLORES } from '../css/leerTokens';

// Escaneo estático de `features/bitacora` (CU-26, U6 y U7). Solo el código de
// producción; ni las pruebas ni los valores de ejemplo entran en el recorrido.
//
// 1. Montos: nunca pasan por flotante. Nada de `parseFloat`, `valueAsNumber`,
//    `toFixed`, `Math.`, `+` unario ni `Intl.NumberFormat`, y nadie importa el
//    formateador de 2 decimales (`formatearMonto`), que redondea: el detalle
//    usa solo `formatearDecimalExacto` (U4). `Number(` se permite únicamente
//    en los dos archivos que convierten números que NO son montos: el año, el
//    mes y el día del calendario (`fechas.ts`, D6) y el número de página de la
//    URL (`filtrosUrl.ts`).
// 2. Tokens nuevos de peligro: `--color-danger-row` y `--color-danger-chip`
//    son de la tabla de la bitácora y de nadie más. Solo su módulo CSS los
//    consume; ningún componente compartido ni otra pantalla los toca, así que
//    cambiarlos no mueve nada fuera de la bitácora.
// 3. D8: la pantalla nunca lee la ip ni el agente de usuario, y el correo solo
//    lo nombra `detalle.ts` (texto de las acciones de administración, historia
//    2.7); el contrato descarta la ip, el agente y el correo del usuario.

const RAIZ_SRC = path.join(RAIZ_FRONTEND, 'src');
const RAIZ = path.join(RAIZ_SRC, 'features', 'bitacora');
const CSS_TABLA = path.join(RAIZ, 'components', 'TablaBitacora.module.css');

const NUMBER_PERMITIDO = new Set(
  ['fechas.ts', 'filtrosUrl.ts'].map((f) => path.join(RAIZ, f)),
);

function recorrer(carpeta: string, extension: RegExp): string[] {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) return recorrer(ruta, extension);
    return extension.test(entrada.name) &&
      !/\.test\.(ts|tsx)$/.test(entrada.name)
      ? [ruta]
      : [];
  });
}

/** Quita los comentarios: nombrar algo en la documentación no lo usa. */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Además vacía los textos: un «+» o un `$` dentro de un mensaje no es código. */
function sinTextos(codigo: string): string {
  return sinComentarios(codigo).replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
}

const leer = (archivo: string) => fs.readFileSync(archivo, 'utf8');
const relativo = (archivo: string) => path.relative(RAIZ_FRONTEND, archivo);

const codigo = recorrer(RAIZ, /\.(ts|tsx)$/);

describe('bitácora: el escaneo encuentra lo que debe revisar', () => {
  it('recorre el código de producción de la feature', () => {
    const nombres = codigo.map((f) => path.basename(f));
    for (const esperado of [
      'claves.ts',
      'useBitacora.ts',
      'useUsuariosBitacora.ts',
      'detalle.ts',
      'TablaBitacora.tsx',
    ]) {
      expect(nombres).toContain(esperado);
    }
    expect(nombres.some((n) => n.includes('.test.'))).toBe(false);
  });
});

describe('bitácora: los montos no pasan por flotante', () => {
  const PROHIBIDOS: [string, RegExp][] = [
    ['parseFloat', /\bparseFloat\b/],
    ['parseInt', /\bparseInt\b/],
    ['valueAsNumber', /\bvalueAsNumber\b/],
    ['toFixed', /\.toFixed\(/],
    ['Math.', /\bMath\./],
    ['Intl.NumberFormat', /\bNumberFormat\b/],
    ['toLocaleString', /\.toLocaleString\(/],
    ['+ unario', /(?:^|[=(,:?!&|]\s*|return\s+)\+\s*[\w(]/m],
  ];

  it.each(codigo.map((f) => [relativo(f), f]))(
    '%s no usa aritmética de flotantes',
    (_n, archivo) => {
      const limpio = sinTextos(leer(archivo));
      const hallados = PROHIBIDOS.filter(([, patron]) => patron.test(limpio));
      expect(hallados.map(([nombre]) => nombre)).toEqual([]);
    },
  );

  it('Number( solo aparece en los dos archivos de números que no son montos', () => {
    const conNumber = codigo.filter((f) =>
      /\bNumber\(/.test(sinTextos(leer(f))),
    );
    for (const archivo of conNumber) {
      expect(NUMBER_PERMITIDO, relativo(archivo)).toContain(archivo);
    }
  });

  it('nadie importa el formateador de 2 decimales', () => {
    for (const archivo of codigo) {
      expect(sinComentarios(leer(archivo)), relativo(archivo)).not.toMatch(
        /\bformatearMonto\b/,
      );
    }
  });
});

describe('bitácora: los tokens nuevos de peligro están aislados', () => {
  const TOKENS = ['--color-danger-row', '--color-danger-chip'];
  const fuera = recorrer(RAIZ_SRC, /\.(css|ts|tsx)$/).filter(
    (f) => f !== RUTA_COLORES && f !== CSS_TABLA,
  );

  it.each(TOKENS)('%s se declara en colors.css', (token) => {
    const declaraciones = leer(RUTA_COLORES).match(
      new RegExp(`${token}\\s*:`, 'g'),
    );
    expect(declaraciones).toHaveLength(2);
  });

  it.each(TOKENS)('%s lo consume el módulo CSS de la tabla', (token) => {
    expect(leer(CSS_TABLA)).toContain(`var(${token})`);
  });

  it.each(TOKENS)('%s no se usa en ningún otro archivo de src', (token) => {
    const usos = fuera.filter((f) => sinComentarios(leer(f)).includes(token));
    expect(usos.map(relativo)).toEqual([]);
  });

  it('la tabla no redefine tokens ni pinta colores literales', () => {
    const css = leer(CSS_TABLA);
    expect(css).not.toMatch(/--[\w-]+\s*:/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });
});

const DETALLE = path.join(RAIZ, 'detalle.ts');

/**
 * D8 acotada (historia 2.7): `ip` y `userAgent` están prohibidos en toda la
 * feature; `email` y `correo` solo en `detalle.ts`, que redacta el texto de las
 * acciones de administración con el correo de la persona afectada.
 */
const PROHIBIDO_EN_TODA_LA_FEATURE = /\.ip\b|\bip:|userAgent/;
const PROHIBIDO_FUERA_DEL_DETALLE = /\bemail\b|\bcorreo\b/;

function violaD8(archivo: string, fuente: string): boolean {
  const limpio = sinComentarios(fuente);
  if (PROHIBIDO_EN_TODA_LA_FEATURE.test(limpio)) return true;
  return archivo !== DETALLE && PROHIBIDO_FUERA_DEL_DETALLE.test(limpio);
}

describe('bitácora: nunca lee ip ni agente de usuario; el correo solo en detalle.ts (D8)', () => {
  it.each(codigo.map((f) => [relativo(f), f]))('%s', (_n, archivo) => {
    expect(violaD8(archivo, leer(archivo))).toBe(false);
  });

  it('detalle.ts es el único archivo que nombra el correo', () => {
    const nombran = codigo.filter((f) =>
      PROHIBIDO_FUERA_DEL_DETALLE.test(sinComentarios(leer(f))),
    );
    expect(nombran.map(relativo)).toEqual([relativo(DETALLE)]);
  });

  it('la regla falla si otro archivo usa email o correo', () => {
    const tabla = path.join(RAIZ, 'components', 'TablaBitacora.tsx');
    expect(violaD8(tabla, 'const x = evento.datos.email;')).toBe(true);
    expect(violaD8(tabla, "const t = 'correo';")).toBe(true);
    expect(violaD8(tabla, 'const x = evento.id;')).toBe(false);
  });

  it('en detalle.ts el correo se permite, pero ip y userAgent no', () => {
    expect(violaD8(DETALLE, 'const e = datos.email;')).toBe(false);
    expect(violaD8(DETALLE, 'const p = evento.ip;')).toBe(true);
    expect(violaD8(DETALLE, 'const a = datos.userAgent;')).toBe(true);
  });
});
