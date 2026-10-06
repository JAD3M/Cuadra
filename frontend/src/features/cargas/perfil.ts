import { PERFIL_POR_DEFECTO } from '@/shared/dominio';

/** Lo que el selector necesita de un perfil bancario. */
interface PerfilElegible {
  id: string;
}

/**
 * Perfil que se muestra y se manda. Sin perfiles cargados no hay perfil
 * (`null`): el campo se oculta y el POST no manda `perfil`, así que el servidor
 * usa el suyo. Con perfiles, lo elegido si sigue en la lista; si no, el del
 * servidor (`cuadra`, M13) y, si tampoco está, el primero en el orden de la API.
 */
export function perfilVigente(
  perfiles: readonly PerfilElegible[] | undefined,
  elegido: string | null,
): string | null {
  if (perfiles === undefined || perfiles.length === 0) return null;
  const ids = perfiles.map((p) => p.id);
  if (elegido !== null && ids.includes(elegido)) return elegido;
  if (ids.includes(PERFIL_POR_DEFECTO)) return PERFIL_POR_DEFECTO;
  return ids[0] ?? null;
}
