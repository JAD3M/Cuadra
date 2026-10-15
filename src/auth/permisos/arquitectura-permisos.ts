import ts from 'typescript';

/**
 * AD-11. Regla de arquitectura: todo endpoint declara qué exige. Este helper
 * es puro (texto -> infracciones) para probarlo con fixtures en memoria.
 *
 * Un endpoint es un método con un decorador HTTP de una clase `@Controller`.
 * Cumple si el método o su clase llevan `@Permiso` (rol de empresa),
 * `@Publico` (sin sesión) o `@Scope` (tipo de sesión: elegir empresa,
 * plataforma, contexto).
 */

export interface ArchivoFuente {
  /** Ruta relativa a `src/`, con `/` como separador. */
  ruta: string;
  contenido: string;
}

export interface EndpointSinPermiso {
  ruta: string;
  clase: string;
  metodo: string;
}

const DECORADORES_HTTP = new Set([
  'Get',
  'Post',
  'Put',
  'Patch',
  'Delete',
  'Head',
  'Options',
  'All',
]);
const DECORADORES_DE_ACCESO = new Set(['Permiso', 'Publico', 'Scope']);

function nombresDeDecoradores(nodo: ts.Node): string[] {
  if (!ts.canHaveDecorators(nodo)) return [];
  return (ts.getDecorators(nodo) ?? []).flatMap((d) => {
    const e = d.expression;
    const llamada = ts.isCallExpression(e) ? e.expression : e;
    return ts.isIdentifier(llamada) ? [llamada.text] : [];
  });
}

export function endpointsSinPermiso(
  fuentes: readonly ArchivoFuente[],
): EndpointSinPermiso[] {
  const salida: EndpointSinPermiso[] = [];
  for (const fuente of fuentes) {
    const archivo = ts.createSourceFile(
      fuente.ruta,
      fuente.contenido,
      ts.ScriptTarget.Latest,
      true,
    );
    const visitar = (nodo: ts.Node): void => {
      if (ts.isClassDeclaration(nodo)) {
        const deClase = nombresDeDecoradores(nodo);
        if (deClase.includes('Controller')) {
          const claseCubierta = deClase.some((d) =>
            DECORADORES_DE_ACCESO.has(d),
          );
          for (const miembro of nodo.members) {
            if (!ts.isMethodDeclaration(miembro)) continue;
            const deMetodo = nombresDeDecoradores(miembro);
            if (!deMetodo.some((d) => DECORADORES_HTTP.has(d))) continue;
            const cubierto =
              claseCubierta ||
              deMetodo.some((d) => DECORADORES_DE_ACCESO.has(d));
            if (!cubierto) {
              salida.push({
                ruta: fuente.ruta,
                clase: nodo.name?.text ?? '(anónima)',
                metodo: miembro.name.getText(archivo),
              });
            }
          }
        }
      }
      ts.forEachChild(nodo, visitar);
    };
    visitar(archivo);
  }
  return salida;
}
