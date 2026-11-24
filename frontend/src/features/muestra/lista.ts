import type { CasoMuestra } from '@/shared/api/contratos';

/** Filtros de la lista de casos. */
export type FiltroCasos = 'todos' | 'pendientes' | 'desacuerdo';

/**
 * «Pendientes» es lo que aún falta marcar: un caso reabierto ya no se marca,
 * así que no cuenta (igual que `avance.pendientes` del servidor).
 */
export function cumpleFiltro(caso: CasoMuestra, filtro: FiltroCasos): boolean {
  if (filtro === 'pendientes')
    return caso.marca === 'pendiente' && !caso.reabierta;
  if (filtro === 'desacuerdo') return caso.marca === 'desacuerdo';
  return true;
}

/** Primer caso por marcar; si no queda ninguno, el primero de la muestra. */
export function casoInicial(casos: readonly CasoMuestra[]): string | null {
  const pendiente = casos.find((c) => cumpleFiltro(c, 'pendientes'));
  return (pendiente ?? casos[0])?.decisionId ?? null;
}

/** Posición (desde 1) del caso en toda la muestra, no en la lista filtrada. */
export function numeroDe(
  casos: readonly CasoMuestra[],
  decisionId: string,
): number | null {
  const i = casos.findIndex((c) => c.decisionId === decisionId);
  return i < 0 ? null : i + 1;
}

/**
 * Siguiente (`1`) o anterior (`-1`) caso que cumple el filtro, partiendo de la
 * posición del actual en toda la muestra aunque él mismo ya no cumpla el
 * filtro. `null` en los extremos.
 */
export function vecino(
  casos: readonly CasoMuestra[],
  decisionId: string,
  filtro: FiltroCasos,
  sentido: 1 | -1,
): string | null {
  const desde = casos.findIndex((c) => c.decisionId === decisionId);
  if (desde < 0) return null;
  for (let i = desde + sentido; i >= 0 && i < casos.length; i += sentido) {
    const candidato = casos[i];
    if (candidato !== undefined && cumpleFiltro(candidato, filtro)) {
      return candidato.decisionId;
    }
  }
  return null;
}
