import type { EpocaBandeja } from '@/features/bandeja/claves';

export { useEpoca } from '@/features/bandeja/useEpoca';

// Claves de consulta de la muestra. Como en las demás pantallas, la segunda
// posición es la época de la sesión: al cambiar de empresa o de cuenta ninguna
// consulta anterior se sirve ni se reutiliza.

export const clavesMuestra = {
  /** Prefijo común: invalida todas las lecturas de una época. */
  todas: (epoca: EpocaBandeja) => ['muestra', epoca] as const,
  /** `mes` `null` es «el más reciente con muestra». */
  lectura: (epoca: EpocaBandeja, mes: string | null) =>
    ['muestra', epoca, 'lectura', mes] as const,
};
