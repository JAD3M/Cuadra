import type { EpocaBandeja } from '@/features/bandeja/claves';

export { useEpoca } from '@/features/bandeja/useEpoca';

// Claves de consulta de la medición. Como en las demás pantallas, la segunda
// posición es la época de la sesión: al cambiar de empresa o de cuenta ninguna
// consulta anterior se sirve ni se reutiliza.

export const clavesMedicion = {
  desacuerdo: (epoca: EpocaBandeja) =>
    ['medicion', epoca, 'desacuerdo'] as const,
};
