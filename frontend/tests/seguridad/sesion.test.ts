// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import arquitectura from '../../eslint/arquitectura.js';
import { RAIZ_FRONTEND } from '../css/leerTokens';

/**
 * Comprobación estática de la sesión (AUT-2, AUT-5, AUT-17): el código de la
 * sesión, del cliente de la API y de las pantallas de acceso no usa
 * almacenamiento del navegador, consola, temporizadores ni decodifica
 * tokens, y los tokens no viajan por el estado del enrutador, las claves de
 * consulta ni las URL.
 */
const CARPETAS = ['src/shared/sesion', 'src/shared/api', 'src/features/auth'];

function esFuente(archivo: string) {
  return /\.(ts|tsx)$/.test(archivo) && !/\.test\.(ts|tsx)$/.test(archivo);
}

function listar(carpeta: string): string[] {
  const raiz = path.join(RAIZ_FRONTEND, carpeta);
  return readdirSync(raiz, { recursive: true, encoding: 'utf8' })
    .filter(esFuente)
    .map((archivo) => path.join(carpeta, archivo))
    .sort();
}

/** Quita comentarios para no confundir una nota con código. */
function sinComentarios(codigo: string) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

const FUENTES = CARPETAS.flatMap(listar).map((archivo) => ({
  archivo,
  codigo: sinComentarios(
    readFileSync(path.join(RAIZ_FRONTEND, archivo), 'utf8'),
  ),
}));

const PROHIBIDOS: [string, RegExp][] = [
  ['console', /\bconsole\s*\./],
  ['localStorage', /\blocalStorage\b/],
  ['sessionStorage', /\bsessionStorage\b/],
  ['cookie', /\bdocument\s*\.\s*cookie\b/],
  ['indexedDB', /\bindexedDB\b/],
  ['setTimeout', /\bsetTimeout\s*\(/],
  ['setInterval', /\bsetInterval\s*\(/],
  ['setImmediate', /\bsetImmediate\s*\(/],
  ['AbortSignal.timeout', /\bAbortSignal\s*\.\s*timeout\b/],
  ['atob (decodificar un JWT)', /\batob\s*\(/],
  ['Buffer.from (decodificar un JWT)', /\bBuffer\s*\.\s*from\s*\(/],
  ['jwt-decode', /jwt[-_ ]?decode/i],
  ['dangerouslySetInnerHTML', /\bdangerouslySetInnerHTML\b/],
];

// El token no debe entrar en el estado del enrutador, en una clave de
// consulta ni en una URL.
const TOKEN_EN_DESTINOS: [string, RegExp][] = [
  ['estado del enrutador', /\bstate\s*[:=]\s*\{[^}]*(token|password)/i],
  ['navigate', /\bnavigate\s*\([^)]*(token|password)/i],
  ['clave de consulta', /\bqueryKey\s*:\s*\[[^\]]*(token|password)/i],
  ['URL', /new\s+URL\s*\([^)]*(token|password)/i],
  ['query string', /[?&](token|password)=/i],
];

describe('seguridad de la sesión (estático)', () => {
  it('encuentra el código que debe vigilar', () => {
    const archivos = FUENTES.map((f) => f.archivo);
    expect(archivos).toContain('src/shared/sesion/SessionProvider.tsx');
    expect(archivos).toContain('src/shared/sesion/almacenTokens.ts');
    expect(archivos).toContain('src/shared/api/client.ts');
    expect(archivos).toContain('src/features/auth/LoginPage.tsx');
    expect(archivos.some((a) => a.endsWith('.test.tsx'))).toBe(false);
  });

  it.each(PROHIBIDOS)('ningún archivo usa %s', (_nombre, patron) => {
    const infractores = FUENTES.filter((f) => patron.test(f.codigo)).map(
      (f) => f.archivo,
    );
    expect(infractores).toEqual([]);
  });

  it.each(TOKEN_EN_DESTINOS)(
    'ningún token ni contraseña viaja por %s',
    (_nombre, patron) => {
      const infractores = FUENTES.filter((f) => patron.test(f.codigo)).map(
        (f) => f.archivo,
      );
      expect(infractores).toEqual([]);
    },
  );

  it('los patrones detectan lo que dicen detectar', () => {
    const malos: [RegExp, string][] = [
      [PROHIBIDOS[0]![1], "console.log('x')"],
      [PROHIBIDOS[1]![1], "window.localStorage.setItem('a', t)"],
      [PROHIBIDOS[3]![1], 'document.cookie = t'],
      [PROHIBIDOS[5]![1], 'setTimeout(() => {}, 1)'],
      [PROHIBIDOS[9]![1], 'JSON.parse(atob(parte))'],
      [TOKEN_EN_DESTINOS[0]![1], 'navigate(x, { state: { token } })'],
      [TOKEN_EN_DESTINOS[2]![1], "useQuery({ queryKey: ['a', token] })"],
    ];
    for (const [patron, codigo] of malos)
      expect(patron.test(codigo)).toBe(true);
    expect(
      sinComentarios('// console.log(1)\n/* localStorage */ ok'),
    ).not.toMatch(/console|localStorage/);
  });
});

describe('no-console en el código de la sesión', () => {
  const eslint = new ESLint({
    cwd: RAIZ_FRONTEND,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: { parser: tseslint.parser },
      },
      ...arquitectura,
    ],
  });

  async function reglas(codigo: string, ruta: string) {
    const [resultado] = await eslint.lintText(codigo, { filePath: ruta });
    return (resultado?.messages ?? []).map((m) => m.ruleId);
  }

  it.each(CARPETAS)('prohíbe console en %s', async (carpeta) => {
    expect(
      await reglas("console.log('x');\n", `${carpeta}/ejemplo.ts`),
    ).toContain('no-console');
  });

  it('no afecta a las pruebas ni a otras carpetas', async () => {
    expect(
      await reglas("console.log('x');\n", 'src/shared/sesion/a.test.ts'),
    ).not.toContain('no-console');
    expect(
      await reglas("console.log('x');\n", 'src/shared/otro/ejemplo.ts'),
    ).not.toContain('no-console');
  });
});
