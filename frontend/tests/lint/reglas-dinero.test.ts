// @vitest-environment node
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import reglasDinero from '../../eslint/reglas-dinero.js';
import { RAIZ_FRONTEND } from '../css/leerTokens';

const eslint = new ESLint({
  cwd: RAIZ_FRONTEND,
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser } },
    ...reglasDinero,
  ],
});

async function reglasDisparadas(codigo: string, ruta: string) {
  const [resultado] = await eslint.lintText(codigo, { filePath: ruta });
  return (resultado?.messages ?? []).map((m) => m.ruleId);
}

const RUTA_DINERO = 'src/shared/dinero/ejemplo.ts';
const RUTA_MONTO = 'src/shared/ui/Monto.tsx';
const RUTA_CONTRATOS = 'src/shared/api/contratos/ejemplo.ts';
const RUTA_AJENA = 'src/shared/otro/ejemplo.ts';

const PROHIBIDOS: [string, string, string][] = [
  ['Number(x)', 'const n = Number(x);', 'no-restricted-globals'],
  [
    'Number.parseFloat',
    'const n = Number.parseFloat(x);',
    'no-restricted-globals',
  ],
  ['parseFloat', 'const n = parseFloat(x);', 'no-restricted-globals'],
  ['parseInt', 'const n = parseInt(x, 10);', 'no-restricted-globals'],
  ['Math.round', 'const n = Math.round(x);', 'no-restricted-globals'],
  [
    'Intl.NumberFormat',
    "const f = new Intl.NumberFormat('es-MX');",
    'no-restricted-globals',
  ],
  ['+x unario', 'const n = +x;', 'no-restricted-syntax'],
  ['toLocaleString', 'const s = x.toLocaleString();', 'no-restricted-syntax'],
  ['toNumber', 'const n = d.toNumber();', 'no-restricted-syntax'],
  [
    'globalThis.Number',
    'const n = globalThis.Number(x);',
    'no-restricted-syntax',
  ],
  [
    'window.parseFloat',
    'const n = window.parseFloat(x);',
    'no-restricted-syntax',
  ],
];

describe('reglas de dinero', () => {
  describe.each([
    ['shared/dinero', RUTA_DINERO],
    ['Monto', RUTA_MONTO],
    ['contratos', RUTA_CONTRATOS],
  ])('en %s', (_nombre, ruta) => {
    it.each(PROHIBIDOS)('marca %s', async (_caso, codigo, regla) => {
      expect(await reglasDisparadas(codigo, ruta)).toContain(regla);
    });

    it('no marca código sin flotantes', async () => {
      const codigo = "const s = valor.toFixed(2) + '0';\nexport { s };";
      expect(await reglasDisparadas(codigo, ruta)).toEqual([]);
    });

    it('conserva la prohibición de dangerouslySetInnerHTML', async () => {
      const codigo =
        'export const A = () => <div dangerouslySetInnerHTML={{ __html: x }} />;';
      const ruta_ = ruta.replace(/\.ts$/, '.tsx');
      expect(await reglasDisparadas(codigo, ruta_)).toContain(
        'no-restricted-syntax',
      );
    });
  });

  it('marca z.number() solo en contratos', async () => {
    const codigo = "import { z } from 'zod';\nexport const s = z.number();";
    expect(await reglasDisparadas(codigo, RUTA_CONTRATOS)).toContain(
      'no-restricted-syntax',
    );
    expect(await reglasDisparadas(codigo, RUTA_DINERO)).toEqual([]);
  });

  it('permite z.number() con eslint-disable y razón explícita', async () => {
    const codigo = [
      "import { z } from 'zod';",
      '// eslint-disable-next-line no-restricted-syntax -- conteo de páginas, no es dinero',
      'export const paginas = z.number();',
    ].join('\n');
    expect(await reglasDisparadas(codigo, RUTA_CONTRATOS)).toEqual([]);
  });

  it.each(PROHIBIDOS)(
    'no marca %s fuera de las rutas de dinero',
    async (_caso, codigo) => {
      expect(await reglasDisparadas(codigo, RUTA_AJENA)).toEqual([]);
    },
  );
});
