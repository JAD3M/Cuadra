import type { EpocaBandeja } from '@/features/bandeja/claves';

export { useEpoca } from '@/features/bandeja/useEpoca';

// Claves de consulta de la tolerancia. Como en la bandeja y las cargas, la
// segunda posición es la época de la sesión (un contador, nunca un token): al
// cambiar de empresa o de cuenta ninguna consulta anterior se sirve ni se
// reutiliza. Sin sesión lista la época es `null` y las consultas están
// deshabilitadas. "Cambios" vive aquí y no bajo una clave de bitácora: es una
// proyección filtrada, y la bitácora (CU-26) tendrá las suyas.

export const clavesTolerancia = {
  /** Prefijo común: el valor y los cambios de una época. */
  todas: (epoca: EpocaBandeja) => ['tolerancia', epoca] as const,
  valor: (epoca: EpocaBandeja) => ['tolerancia', epoca, 'valor'] as const,
  cambios: (epoca: EpocaBandeja) => ['tolerancia', epoca, 'cambios'] as const,
};
