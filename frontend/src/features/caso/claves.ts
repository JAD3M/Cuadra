import type { EpocaBandeja } from '@/features/bandeja/claves';

// Claves de consulta del detalle del caso. Como en la bandeja, la segunda
// posición es la época de la sesión (un contador, nunca un token): al cambiar
// de empresa o de cuenta ninguna consulta anterior se sirve bajo la nueva.

export const clavesCaso = {
  /** Prefijo común: invalida el caso y todos los historiales de una época. */
  todas: (epoca: EpocaBandeja) => ['caso', epoca] as const,
  detalle: (epoca: EpocaBandeja, movimientoId: string) =>
    ['caso', epoca, 'detalle', movimientoId] as const,
  historial: (epoca: EpocaBandeja, conciliacionId: string) =>
    ['caso', epoca, 'historial', conciliacionId] as const,
};
