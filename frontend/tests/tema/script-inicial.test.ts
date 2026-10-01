// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  leerPreferencia,
  sistemaPrefiereOscuro,
} from '@/shared/tema/almacenamiento';
import { resolverTema } from '@/shared/tema/resolverTema';
import { CLAVE_TEMA, type TemaResuelto } from '@/shared/tema/tipos';
import { crearAlmacenFalso, crearMatchMediaFalso } from '@/test/fixturesTema';

const RUTA_HTML = path.resolve(import.meta.dirname, '../../index.html');

function extraerScript(): string {
  const html = fs.readFileSync(RUTA_HTML, 'utf8');
  const coincidencias = [
    ...html.matchAll(/<script id="tema-inicial">([\s\S]*?)<\/script>/g),
  ];
  expect(coincidencias).toHaveLength(1);
  return coincidencias[0]?.[1] ?? '';
}

interface Escenario {
  guardado: string | undefined;
  sistemaOscuro: boolean;
  almacenLanza: boolean;
  sinMatchMedia: boolean;
}

function ejecutarScript(texto: string, e: Escenario): string | null {
  const almacen = crearAlmacenFalso(
    e.guardado === undefined ? {} : { [CLAVE_TEMA]: e.guardado },
    { lanza: e.almacenLanza },
  );
  const atributos = new Map<string, string>();
  const documento = {
    documentElement: {
      setAttribute: (k: string, v: string) => atributos.set(k, v),
    },
  };
  const ventana = e.sinMatchMedia
    ? {}
    : { matchMedia: crearMatchMediaFalso(e.sistemaOscuro).matchMedia };
  new Function('window', 'document', 'localStorage', texto)(
    ventana,
    documento,
    almacen,
  );
  return atributos.get('data-theme') ?? null;
}

function ejecutarRuntime(e: Escenario): TemaResuelto {
  const almacen = crearAlmacenFalso(
    e.guardado === undefined ? {} : { [CLAVE_TEMA]: e.guardado },
    { lanza: e.almacenLanza },
  );
  const ventana = e.sinMatchMedia
    ? ({} as Pick<Window, 'matchMedia'>)
    : crearMatchMediaFalso(e.sistemaOscuro);
  return resolverTema(leerPreferencia(almacen), sistemaPrefiereOscuro(ventana));
}

const GUARDADOS = [undefined, 'light', 'dark', 'system', 'purple', ''];
const escenarios: Escenario[] = GUARDADOS.flatMap((guardado) =>
  [true, false].flatMap((sistemaOscuro) =>
    [false, true].flatMap((almacenLanza) =>
      [false, true].map((sinMatchMedia) => ({
        guardado,
        sistemaOscuro,
        almacenLanza,
        sinMatchMedia,
      })),
    ),
  ),
);

describe('script inicial del tema', () => {
  const texto = extraerScript();

  it('cubre todas las combinaciones de la matriz', () => {
    expect(escenarios).toHaveLength(48);
  });

  it.each(escenarios)('coincide con el resolver: %j', (escenario) => {
    expect(ejecutarScript(texto, escenario)).toBe(ejecutarRuntime(escenario));
  });

  it('solo escribe un data-theme válido', () => {
    for (const e of escenarios) {
      expect(['light', 'dark']).toContain(ejecutarScript(texto, e));
    }
  });

  it('un matchMedia que lanza termina en oscuro sin romper', () => {
    const atributos = new Map<string, string>();
    new Function('window', 'document', 'localStorage', texto)(
      {
        matchMedia: () => {
          throw new Error('no disponible');
        },
      },
      {
        documentElement: {
          setAttribute: (k: string, v: string) => atributos.set(k, v),
        },
      },
      crearAlmacenFalso(),
    );
    expect(atributos.get('data-theme')).toBe('dark');
  });

  it('no rompe si el documento falla', () => {
    expect(() =>
      new Function('window', 'document', 'localStorage', texto)(
        {},
        {
          get documentElement(): never {
            throw new Error('sin documento');
          },
        },
        crearAlmacenFalso(),
      ),
    ).not.toThrow();
  });
});

describe('index.html', () => {
  const html = fs.readFileSync(RUTA_HTML, 'utf8');

  it('declara color-scheme dark light', () => {
    expect(html).toMatch(/<meta name="color-scheme" content="dark light"/);
  });

  it('el script va antes del módulo para ejecutarse antes del primer pintado', () => {
    expect(html.indexOf('id="tema-inicial"')).toBeLessThan(
      html.indexOf('type="module"'),
    );
  });

  it('no es module ni async ni defer (bloquea el pintado)', () => {
    const etiqueta = /<script id="tema-inicial"[^>]*>/.exec(html)?.[0] ?? '';
    expect(etiqueta).not.toMatch(/type=|async|defer/);
  });

  it('el script no usa sintaxis posterior a ES5', () => {
    const texto = extraerScript();
    expect(texto).not.toMatch(/=>|\b(?:let|const)\b|`/);
  });
});
