import ts from 'typescript';

// Lectura de la matriz de permisos del backend (src/auth/permisos/matriz.ts)
// y comparación con su espejo (src/shared/dominio/permisos.ts). Solo LEE texto:
// el frontend no importa código del backend. Es un AST y no una regex porque
// la matriz es un objeto, no una lista plana como las de tipos.ts.

export interface MatrizBackend {
  /** `PERMISOS`, en el orden del archivo. */
  permisos: string[];
  /** `PERMISOS_DUENO`: los evalúa la sesión plataforma, no `RolesGuard`. */
  dueno: string[];
  /** `PERMISOS_PROPIOS`: «solo lo que hizo»; la historia de la acción verifica. */
  propios: string[];
  /** `MATRIZ_PERMISOS`: roles por permiso, en orden. */
  matriz: Record<string, string[]>;
  /** Lo que no se pudo leer, con el nombre del archivo. */
  problemas: string[];
}

function textos(nodo: ts.Expression): string[] | null {
  const literal = ts.isAsExpression(nodo) ? nodo.expression : nodo;
  if (!ts.isArrayLiteralExpression(literal)) return null;
  const valores: string[] = [];
  for (const el of literal.elements) {
    if (!ts.isStringLiteral(el)) return null;
    valores.push(el.text);
  }
  return valores;
}

export function extraerMatriz(
  texto: string,
  nombreArchivo: string,
): MatrizBackend {
  const fuente = ts.createSourceFile(
    nombreArchivo,
    texto,
    ts.ScriptTarget.Latest,
    true,
  );
  const salida: MatrizBackend = {
    permisos: [],
    dueno: [],
    propios: [],
    matriz: {},
    problemas: [],
  };
  const hallados = new Set<string>();
  for (const sentencia of fuente.statements) {
    if (!ts.isVariableStatement(sentencia)) continue;
    for (const decl of sentencia.declarationList.declarations) {
      const nombre = decl.name.getText(fuente);
      const init = decl.initializer;
      if (!init) continue;
      if (
        nombre === 'PERMISOS' ||
        nombre === 'PERMISOS_DUENO' ||
        nombre === 'PERMISOS_PROPIOS'
      ) {
        const valores = textos(init);
        if (valores === null) continue;
        hallados.add(nombre);
        if (nombre === 'PERMISOS') salida.permisos = valores;
        else if (nombre === 'PERMISOS_DUENO') salida.dueno = valores;
        else salida.propios = valores;
      } else if (nombre === 'MATRIZ_PERMISOS') {
        const objeto = ts.isAsExpression(init) ? init.expression : init;
        if (!ts.isObjectLiteralExpression(objeto)) continue;
        let completa = true;
        for (const prop of objeto.properties) {
          if (!ts.isPropertyAssignment(prop)) {
            completa = false;
            continue;
          }
          const clave = ts.isStringLiteral(prop.name)
            ? prop.name.text
            : prop.name.getText(fuente);
          const roles = textos(prop.initializer);
          if (roles === null) completa = false;
          else salida.matriz[clave] = roles;
        }
        if (completa) hallados.add(nombre);
      }
    }
  }
  for (const nombre of [
    'PERMISOS',
    'PERMISOS_DUENO',
    'PERMISOS_PROPIOS',
    'MATRIZ_PERMISOS',
  ]) {
    if (!hallados.has(nombre)) {
      salida.problemas.push(
        `${nombreArchivo}: no se pudo leer ${nombre}; ¿cambió el formato del archivo?`,
      );
    }
  }
  return salida;
}

const igual = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Problemas legibles (vacío si el espejo coincide con el backend). */
export function compararPermisos(
  backend: MatrizBackend,
  espejo: Record<string, unknown>,
): string[] {
  const problemas = [...backend.problemas];
  if (problemas.length > 0) return problemas;

  for (const [nombre, valores] of [
    ['PERMISOS', backend.permisos],
    ['PERMISOS_DUENO', backend.dueno],
    ['PERMISOS_PROPIOS', backend.propios],
  ] as const) {
    const copia = espejo[nombre];
    if (!igual(copia, valores)) {
      const lista = Array.isArray(copia) ? (copia as string[]) : [];
      const faltan = valores.filter((v) => !lista.includes(v));
      const sobran = lista.filter((v) => !valores.includes(v));
      problemas.push(
        `${nombre}: difiere del backend. backend=${JSON.stringify(valores)} espejo=${JSON.stringify(copia)} (faltan en el espejo: [${faltan.join(', ')}], sobran: [${sobran.join(', ')}]; si no hay diferencia de valores, cambió el orden)`,
      );
    }
  }

  const filasEspejo = (espejo.MATRIZ_PERMISOS ?? {}) as Record<string, unknown>;
  for (const [permiso, roles] of Object.entries(backend.matriz)) {
    if (!(permiso in filasEspejo)) {
      problemas.push(
        `${permiso}: el backend lo tiene en MATRIZ_PERMISOS y el espejo no`,
      );
    } else if (!igual(filasEspejo[permiso], roles)) {
      problemas.push(
        `${permiso}: roles difieren del backend. backend=${JSON.stringify(roles)} espejo=${JSON.stringify(filasEspejo[permiso])}`,
      );
    }
  }
  for (const permiso of Object.keys(filasEspejo)) {
    if (!(permiso in backend.matriz)) {
      problemas.push(
        `${permiso}: el espejo lo tiene en MATRIZ_PERMISOS y el backend no (el frontend no inventa permisos)`,
      );
    }
  }
  return problemas;
}
