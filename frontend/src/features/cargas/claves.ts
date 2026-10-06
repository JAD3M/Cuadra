import type { EpocaBandeja } from '@/features/bandeja/claves';

export { useEpoca } from '@/features/bandeja/useEpoca';

// Claves de consulta de las cargas. Como en la bandeja, la segunda posición es
// la época de la sesión (un contador, nunca un token): al cambiar de empresa o
// de cuenta ninguna consulta anterior se sirve ni se reutiliza. Sin sesión
// lista la época es `null` y las consultas están deshabilitadas.

export const clavesCargas = {
  /** Prefijo común: lista, detalles y perfiles de una época. */
  todas: (epoca: EpocaBandeja) => ['cargas', epoca] as const,
  lista: (epoca: EpocaBandeja) => ['cargas', epoca, 'lista'] as const,
  detalle: (epoca: EpocaBandeja, id: string) =>
    ['cargas', epoca, 'detalle', id] as const,
  perfiles: (epoca: EpocaBandeja) => ['cargas', epoca, 'perfiles'] as const,
};
