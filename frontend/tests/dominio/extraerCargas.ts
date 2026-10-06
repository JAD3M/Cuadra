import ts from 'typescript';

// Extractores de los espejos de cargas (CU-24, M9). Leen el código del
// backend con el AST de TypeScript, como `derivaTipos.ts`, y devuelven
// `undefined` cuando el archivo ya no tiene la forma esperada: así una
// constante eliminada o renombrada hace fallar la prueba, nunca pasar en
// silencio.

function fuenteDe(texto: string, nombre: string): ts.SourceFile {
  return ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true);
}

/** Los literales de texto de las propiedades `resultado` de un tipo o interfaz. */
function literalesDeResultado(
  fuente: ts.SourceFile,
  nombreDeclaracion: string,
): string[] | undefined {
  let encontrada = false;
  const literales: string[] = [];
  const recorrer = (nodo: ts.Node) => {
    if (
      ts.isPropertySignature(nodo) &&
      nodo.name.getText(fuente) === 'resultado' &&
      nodo.type !== undefined
    ) {
      ts.forEachChild(nodo.type, function visitar(hijo) {
        if (ts.isLiteralTypeNode(hijo) && ts.isStringLiteral(hijo.literal)) {
          literales.push(hijo.literal.text);
        }
        ts.forEachChild(hijo, visitar);
      });
      if (
        ts.isLiteralTypeNode(nodo.type) &&
        ts.isStringLiteral(nodo.type.literal)
      ) {
        literales.push(nodo.type.literal.text);
      }
    }
    ts.forEachChild(nodo, recorrer);
  };
  for (const sentencia of fuente.statements) {
    const nombre =
      ts.isTypeAliasDeclaration(sentencia) ||
      ts.isInterfaceDeclaration(sentencia)
        ? sentencia.name.text
        : undefined;
    if (nombre === nombreDeclaracion) {
      encontrada = true;
      recorrer(sentencia);
    }
  }
  return encontrada ? literales : undefined;
}

/** `resultado` de `ResultadoDeArchivo` en carga.entity.ts, sin repetidos y en orden. */
export function resultadosDeArchivo(texto: string): string[] | undefined {
  const literales = literalesDeResultado(
    fuenteDe(texto, 'carga.entity.ts'),
    'ResultadoDeArchivo',
  );
  return literales === undefined ? undefined : [...new Set(literales)];
}

/** `resultado` de `ResultadoDeFila` en carga.entity.ts. */
export function resultadosDeFila(texto: string): string[] | undefined {
  return literalesDeResultado(
    fuenteDe(texto, 'carga.entity.ts'),
    'ResultadoDeFila',
  );
}

/** Los roles de cada `@Roles(...)` del controlador, en orden de aparición. */
export function rolesDelControlador(texto: string): string[][] {
  return [...texto.matchAll(/@Roles\(([^)]*)\)/g)].map((m) =>
    [...(m[1] ?? '').matchAll(/'([^']+)'/g)].map((r) => r[1] ?? ''),
  );
}

export function perfilPorDefecto(texto: string): string | undefined {
  return /export const PERFIL_POR_DEFECTO = '([^']+)'/.exec(texto)?.[1];
}

/** Evalúa números, identificadores ya conocidos y `+ - *`; todo lo demás es `undefined`. */
function evaluar(
  nodo: ts.Expression,
  conocidos: Readonly<Record<string, number>>,
): number | undefined {
  if (ts.isNumericLiteral(nodo)) return Number(nodo.text);
  if (ts.isParenthesizedExpression(nodo))
    return evaluar(nodo.expression, conocidos);
  if (ts.isIdentifier(nodo)) return conocidos[nodo.text];
  if (ts.isBinaryExpression(nodo)) {
    const a = evaluar(nodo.left, conocidos);
    const b = evaluar(nodo.right, conocidos);
    if (a === undefined || b === undefined) return undefined;
    switch (nodo.operatorToken.kind) {
      case ts.SyntaxKind.AsteriskToken:
        return a * b;
      case ts.SyntaxKind.PlusToken:
        return a + b;
      case ts.SyntaxKind.MinusToken:
        return a - b;
      default:
        return undefined;
    }
  }
  return undefined;
}

/** Cada `const X = <expresión numérica>` de archivos.guard.ts, ya evaluada. */
export function constantesNumericas(texto: string): Record<string, number> {
  const fuente = fuenteDe(texto, 'archivos.guard.ts');
  const valores: Record<string, number> = {};
  for (const sentencia of fuente.statements) {
    if (!ts.isVariableStatement(sentencia)) continue;
    for (const decl of sentencia.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.initializer === undefined) {
        continue;
      }
      const valor = evaluar(decl.initializer, valores);
      if (valor !== undefined) valores[decl.name.text] = valor;
    }
  }
  return valores;
}

/** La `extension:` con la que se arma cada guard exportado. */
export function extensionDelGuard(
  texto: string,
  guard: string,
): string | undefined {
  return new RegExp(
    `export const ${guard} = ArchivosGuard\\(\\{[^}]*?extension: '([^']+)'`,
    's',
  ).exec(texto)?.[1];
}

/** El `@MaxLength(n)` de cada propiedad de un DTO. */
export function maxLengthPorPropiedad(texto: string): Record<string, number> {
  const fuente = fuenteDe(texto, 'estado-cuenta.dto.ts');
  const salida: Record<string, number> = {};
  const visitar = (nodo: ts.Node) => {
    if (ts.isPropertyDeclaration(nodo)) {
      for (const decorador of ts.getDecorators(nodo) ?? []) {
        const llamada = decorador.expression;
        const argumento = ts.isCallExpression(llamada)
          ? llamada.arguments[0]
          : undefined;
        if (
          ts.isCallExpression(llamada) &&
          llamada.expression.getText(fuente) === 'MaxLength' &&
          argumento !== undefined
        ) {
          const valor = evaluar(argumento, {});
          if (valor !== undefined) salida[nodo.name.getText(fuente)] = valor;
        }
      }
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return salida;
}
