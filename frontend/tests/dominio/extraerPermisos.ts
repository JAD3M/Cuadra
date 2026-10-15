// Lectura de texto del backend para las pruebas de deriva de permisos
// (historia 2.1). Solo LEE: el frontend no importa código del backend.

/** Los permisos de cada `@Permiso('...')` del texto, en orden de aparición. */
export function permisosDelControlador(texto: string): string[] {
  return [...texto.matchAll(/@Permiso\('([^']+)'\)/g)].map((m) => m[1] ?? '');
}

/** El permiso del `@Permiso` que sigue a `decorador` (p. ej. `@Get('usuarios')`). */
export function permisoTrasDecorador(
  texto: string,
  decorador: string,
): string | undefined {
  const inicio = texto.indexOf(decorador);
  if (inicio < 0) return undefined;
  return /^\s*@Permiso\('([^']+)'\)/.exec(
    texto.slice(inicio + decorador.length),
  )?.[1];
}

/** Roles de la fila `'permiso': [...]` de src/auth/permisos/matriz.ts. */
export function rolesDeMatriz(
  matriz: string,
  permiso: string,
): string[] | undefined {
  const escapado = permiso.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fila = new RegExp(`'${escapado}':\\s*\\[([^\\]]*)\\]`).exec(matriz);
  if (fila === null) return undefined;
  return [...(fila[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1] ?? '');
}
