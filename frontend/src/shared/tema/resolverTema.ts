import type { Preferencia, TemaResuelto } from './tipos';

/** Una elección explícita gana; `system` sigue al sistema operativo. */
export function resolverTema(
  preferencia: Preferencia,
  sistemaOscuro: boolean,
): TemaResuelto {
  if (preferencia === 'light' || preferencia === 'dark') return preferencia;
  return sistemaOscuro ? 'dark' : 'light';
}
