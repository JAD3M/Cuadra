import ts from 'typescript';

/** Lo que el espejo no necesita copiar, con la razón de cada exclusión. */
export const EXCLUIDOS_BACKEND: Readonly<Record<string, string>> = {
  listaSql: 'función de SQL: solo la usan los CHECK de las migraciones',
};

/** Los tipos exportados se derivan en el espejo con `(typeof LISTA)[number]`. */
export const RAZON_TIPOS =
  'tipos de TypeScript: el espejo los deriva de sus propias listas';

/** Las clases (DTO con decoradores) no tienen espejo: solo se espejan sus constantes. */
export const RAZON_CLASES =
  'clases de TypeScript (DTO del backend): el frontend valida con sus propios contratos';

export interface ExportsBackend {
  /** `export const X = [...]` (con o sin `as const`), en el orden del archivo. */
  arreglos: Record<string, string[]>;
  /** `export const X = 'texto'` o `export const X = 50`. */
  constantes: Record<string, string | number>;
  funciones: string[];
  tipos: string[];
  /** `export class X`: se excluyen solas, con la razón `RAZON_CLASES`. */
  clases: string[];
  /** Exports que no encajan en ninguna clase conocida. */
  desconocidos: string[];
}

function esExportado(nodo: ts.Node): boolean {
  return (
    ts.canHaveModifiers(nodo) &&
    (ts.getModifiers(nodo) ?? []).some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    )
  );
}

/**
 * Lee `export const X = [...]` y devuelve sus literales de texto. Acepta el
 * arreglo plano (con o sin tipo declarado) y el `as const`.
 */
function literalesDeArreglo(init: ts.Expression): string[] | null {
  const literal = ts.isAsExpression(init) ? init.expression : init;
  if (!ts.isArrayLiteralExpression(literal)) return null;
  const valores: string[] = [];
  for (const el of literal.elements) {
    if (!ts.isStringLiteral(el)) return null;
    valores.push(el.text);
  }
  return valores;
}

/** Clasifica cada export del archivo del backend mediante su AST. */
export function extraerExportsBackend(
  texto: string,
  nombreArchivo: string,
): ExportsBackend {
  const fuente = ts.createSourceFile(
    nombreArchivo,
    texto,
    ts.ScriptTarget.Latest,
    true,
  );
  const salida: ExportsBackend = {
    arreglos: {},
    constantes: {},
    funciones: [],
    tipos: [],
    clases: [],
    desconocidos: [],
  };
  for (const sentencia of fuente.statements) {
    if (!esExportado(sentencia)) continue;
    if (ts.isTypeAliasDeclaration(sentencia)) {
      salida.tipos.push(sentencia.name.text);
    } else if (ts.isClassDeclaration(sentencia)) {
      salida.clases.push(sentencia.name?.text ?? '(anónima)');
    } else if (ts.isFunctionDeclaration(sentencia)) {
      salida.funciones.push(sentencia.name?.text ?? '(anónima)');
    } else if (ts.isVariableStatement(sentencia)) {
      for (const decl of sentencia.declarationList.declarations) {
        const nombre = decl.name.getText(fuente);
        const init = decl.initializer;
        const arreglo = init ? literalesDeArreglo(init) : null;
        if (arreglo) salida.arreglos[nombre] = arreglo;
        else if (init && ts.isStringLiteral(init))
          salida.constantes[nombre] = init.text;
        else if (init && ts.isNumericLiteral(init))
          salida.constantes[nombre] = Number(init.text);
        else salida.desconocidos.push(nombre);
      }
    } else {
      salida.desconocidos.push(ts.SyntaxKind[sentencia.kind] ?? 'export');
    }
  }
  return salida;
}

export const MINIMO_ARREGLOS = 11;

/**
 * Compara el backend con el espejo y devuelve una lista de problemas legibles
 * (vacía si están sincronizados). `espejo` son los exports en runtime del
 * módulo `@/shared/dominio/tipos`.
 */
export function compararConEspejo(
  backend: ExportsBackend,
  espejo: Record<string, unknown>,
  nombreArchivo: string,
  excluidos: Readonly<Record<string, string>> = EXCLUIDOS_BACKEND,
  minimoArreglos: number = MINIMO_ARREGLOS,
): string[] {
  const problemas: string[] = [];
  const total = Object.keys(backend.arreglos).length;
  if (total < minimoArreglos) {
    problemas.push(
      `${nombreArchivo}: se encontraron ${total} listas y se esperaban al menos ${minimoArreglos}; ¿cambió el formato del archivo?`,
    );
  }
  const reconocidos = new Set<string>([
    ...Object.keys(backend.arreglos),
    ...Object.keys(backend.constantes),
  ]);

  for (const [nombre, valores] of Object.entries(backend.arreglos)) {
    const copia = espejo[nombre];
    if (copia === undefined) {
      problemas.push(
        `${nombre}: el backend la exporta (${nombreArchivo}) y el espejo no la tiene`,
      );
    } else if (JSON.stringify(copia) !== JSON.stringify(valores)) {
      const faltan = valores.filter(
        (v) => !(Array.isArray(copia) && copia.includes(v)),
      );
      const sobran = Array.isArray(copia)
        ? copia.filter((v: unknown) => !valores.includes(v as string))
        : [];
      problemas.push(
        `${nombre}: difiere del backend. backend=${JSON.stringify(valores)} espejo=${JSON.stringify(copia)} (faltan en el espejo: [${faltan.join(', ')}], sobran: [${sobran.join(', ')}]; si no hay diferencia de valores, cambió el orden)`,
      );
    }
  }
  for (const [nombre, valor] of Object.entries(backend.constantes)) {
    if (espejo[nombre] === undefined) {
      problemas.push(
        `${nombre}: el backend la exporta (${nombreArchivo}) y el espejo no la tiene`,
      );
    } else if (espejo[nombre] !== valor) {
      problemas.push(
        `${nombre}: difiere del backend. backend=${JSON.stringify(valor)} espejo=${JSON.stringify(espejo[nombre])}`,
      );
    }
  }

  for (const nombre of [...backend.funciones, ...backend.desconocidos]) {
    if (!(nombre in excluidos)) {
      problemas.push(
        `${nombre}: export de ${nombreArchivo} sin clasificar; espéjalo o agrégalo a EXCLUIDOS_BACKEND con su razón`,
      );
    }
  }

  for (const nombre of Object.keys(espejo)) {
    if (!reconocidos.has(nombre)) {
      problemas.push(
        `${nombre}: el espejo lo exporta y el backend no (el frontend no inventa valores)`,
      );
    }
  }
  return problemas;
}
