// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCION_ACTUALIZAR,
  CAMPO_TOLERANCIA,
  ENTIDAD_EMPRESA,
  ESTADOS_BANDEJA,
  ESTADOS_CONCILIACION,
  ROLES,
} from '@/shared/dominio';
import { RAIZ_FRONTEND } from '../css/leerTokens';

// TOL-12.1 / TOL-12.2: el código de `features/tolerancia` no repite como
// literales los valores que el espejo del dominio ya trae (roles, entidad,
// acción, campo y estados) y no pasa un monto por flotante.
//
// Los estados solo se permiten en una comparación (`=== 'x'`, `!== 'x'`,
// `case 'x'`) o como `tono="x"`, igual que en `cargasSinLiterales`: ahí tsc
// falla si el backend renombra el valor; fuera de una comparación el literal
// es una copia.
//
// Los montos: nada de `Number(`, `parseFloat`, `valueAsNumber`, `toFixed`, `+`
// unario ni `Intl.NumberFormat`, y nadie importa el formateador de 2
// decimales (`formatearMonto`), que redondea. El formateador exacto de
// `shared/dinero` y el contrato zod son ayudantes puros de la pantalla: se
// revisan con la regla de montos, pero no con la de literales (el contrato
// y el espejo SON quienes nombran el dominio). `formatearDecimalExacto` usa el
// `toFixed()` de Decimal.js sin precisión, que no redondea; por eso `toFixed`
// se prohíbe en la feature, no en ese archivo.
//
// Solo el código de producción: ni las pruebas ni los valores de ejemplo
// entran en el recorrido.

const RAIZ = path.join(RAIZ_FRONTEND, 'src', 'features', 'tolerancia');
const AYUDANTES_PUROS = [
  path.join(
    RAIZ_FRONTEND,
    'src',
    'shared',
    'dinero',
    'formatearDecimalExacto.ts',
  ),
  path.join(
    RAIZ_FRONTEND,
    'src',
    'shared',
    'api',
    'contratos',
    'tolerancia.ts',
  ),
];
const FORMATEADOR_EXACTO = AYUDANTES_PUROS[0]!;

function archivosDeProduccion(carpeta: string): string[] {
  return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(carpeta, entrada.name);
    if (entrada.isDirectory()) {
      return entrada.name === 'node_modules' ? [] : archivosDeProduccion(ruta);
    }
    const esCodigo = /\.(ts|tsx)$/.test(entrada.name);
    return esCodigo && !/\.test\.(ts|tsx)$/.test(entrada.name) ? [ruta] : [];
  });
}

/** Quita los comentarios: nombrar un valor en la documentación no lo copia. */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Además quita el contenido de los textos: un «+» dentro de un mensaje no es aritmética. */
function sinTextos(codigo: string): string {
  return sinComentarios(codigo).replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
}

const leer = (archivo: string) => fs.readFileSync(archivo, 'utf8');
const relativo = (archivo: string) => path.relative(RAIZ_FRONTEND, archivo);

const archivos = archivosDeProduccion(RAIZ);
const conMontos = [...archivos, ...AYUDANTES_PUROS];

/** El patrón de una copia de `valor` fuera de una comparación tipada. */
const copiaDeEstado = (valor: string) =>
  new RegExp(`(?<!(?:===|!==|\\bcase|\\btono=)\\s*)(['"\`])${valor}\\1`);
const literal = (valor: string) => new RegExp(`(['"\`])${valor}\\1`);

describe('la pantalla de tolerancia no repite valores del dominio como literales (TOL-12.2)', () => {
  it('encuentra el código de producción de la pantalla', () => {
    expect(archivos.length).toBeGreaterThanOrEqual(15);
    expect(archivos.some((a) => a.endsWith('ToleranciaContenedor.tsx'))).toBe(
      true,
    );
    expect(archivos.some((a) => a.endsWith('vista.ts'))).toBe(true);
    expect(archivos.some((a) => /\.test\./.test(a))).toBe(false);
  });

  it.each([...ROLES, ENTIDAD_EMPRESA, ACCION_ACTUALIZAR, CAMPO_TOLERANCIA])(
    'ningún archivo escribe el literal «%s»',
    (valor) => {
      const infractores = archivos.filter((archivo) =>
        literal(valor).test(sinComentarios(leer(archivo))),
      );
      expect(infractores.map(relativo)).toEqual([]);
    },
  );

  it.each([...ESTADOS_BANDEJA, ...ESTADOS_CONCILIACION])(
    'el estado «%s» solo aparece como literal en una comparación tipada',
    (valor) => {
      const infractores = archivos.filter((archivo) =>
        copiaDeEstado(valor).test(sinComentarios(leer(archivo))),
      );
      expect(infractores.map(relativo)).toEqual([]);
    },
  );

  it('el recorrido detecta una copia (control positivo)', () => {
    expect(copiaDeEstado('pendiente').test("const x = 'pendiente';")).toBe(
      true,
    );
    expect(copiaDeEstado('pendiente').test("if (e === 'pendiente') {}")).toBe(
      false,
    );
    expect(copiaDeEstado('pendiente').test("case 'pendiente':")).toBe(false);
    expect(copiaDeEstado('sin_match').test('<Button tono="sin_match" />')).toBe(
      false,
    );
    expect(
      literal('admin').test(sinComentarios("// 'admin'\nx('admin')")),
    ).toBe(true);
    expect(literal('admin').test(sinComentarios("// 'admin'\nx(1)"))).toBe(
      false,
    );
  });
});

/**
 * Cada regla de montos: nombre y patrón. Sobre el código sin comentarios ni
 * textos, salvo las importaciones, que se leen justo en un texto.
 */
const REGLAS_DE_MONTOS: readonly (readonly [string, RegExp])[] = [
  ['Number(', /\bNumber\s*\(/],
  ['parseFloat', /\bparseFloat\b/],
  ['parseInt', /\bparseInt\b/],
  ['valueAsNumber', /\bvalueAsNumber\b/],
  ['Intl.NumberFormat', /\bIntl\s*\.\s*NumberFormat\b/],
  ['toLocaleString', /\btoLocaleString\b/],
  ['+ unario', /(?:^|[=(,:?&|!>;{}[]|\breturn\b)\s*\+\s*[\w(]/m],
  ['formatearMonto', /\bformatearMonto\b/],
  ['el componente Monto', /@\/shared\/ui\/Monto\b/],
];

const REGLAS_DE_IMPORTACION = new Set([
  'formatearMonto',
  'el componente Monto',
]);

function prepararParaRegla(nombre: string, codigo: string): string {
  return REGLAS_DE_IMPORTACION.has(nombre)
    ? sinComentarios(codigo)
    : sinTextos(codigo);
}

describe('la pantalla de tolerancia no pasa un monto por flotante (TOL-12.1)', () => {
  it('revisa la feature y sus ayudantes puros', () => {
    expect(conMontos.length).toBe(archivos.length + 2);
    expect(conMontos.some((a) => a.endsWith('formatearDecimalExacto.ts'))).toBe(
      true,
    );
    expect(conMontos.some((a) => a.endsWith('contratos/tolerancia.ts'))).toBe(
      true,
    );
  });

  it.each(REGLAS_DE_MONTOS)('ningún archivo usa «%s»', (nombre, patron) => {
    const infractores = conMontos.filter((archivo) =>
      patron.test(prepararParaRegla(nombre, leer(archivo))),
    );
    expect(infractores.map(relativo)).toEqual([]);
  });

  it('la feature no usa toFixed (el del formateador exacto es el de Decimal, sin precisión)', () => {
    const infractores = archivos.filter((archivo) =>
      /\btoFixed\b/.test(sinTextos(leer(archivo))),
    );
    expect(infractores.map(relativo)).toEqual([]);
  });

  it('el formateador exacto solo llama toFixed() sin argumentos', () => {
    const codigo = sinTextos(leer(FORMATEADOR_EXACTO));
    const llamadas = codigo.match(/\.toFixed\s*\([^)]*\)/g) ?? [];
    expect(llamadas.length).toBeGreaterThan(0);
    for (const llamada of llamadas) expect(llamada).toMatch(/\(\s*\)$/);
  });

  it('las reglas detectan lo que prohíben (control positivo)', () => {
    const muestras: Readonly<Record<string, string>> = {
      'Number(': 'const n = Number(x);',
      parseFloat: 'parseFloat(x)',
      parseInt: 'parseInt(x, 10)',
      valueAsNumber: 'e.currentTarget.valueAsNumber',
      'Intl.NumberFormat': 'new Intl.NumberFormat("es-MX")',
      toLocaleString: 'x.toLocaleString()',
      '+ unario': 'const n = +texto;',
      formatearMonto: 'formatearMonto(v)',
      'el componente Monto': "import { Monto } from '@/shared/ui/Monto';",
    };
    for (const [nombre, patron] of REGLAS_DE_MONTOS) {
      expect(patron.test(prepararParaRegla(nombre, muestras[nombre]!))).toBe(
        true,
      );
    }
    expect(
      REGLAS_DE_MONTOS.some(([nombre, patron]) =>
        patron.test(
          prepararParaRegla(nombre, 'const total = a + b;\nconst s = "+ x";'),
        ),
      ),
    ).toBe(false);
    expect(/\btoFixed\b/.test(sinTextos('x.toFixed(2)'))).toBe(true);
  });
});
