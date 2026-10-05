import type { EstadoBandeja } from '@/shared/dominio/bandeja';

// Claves de consulta de la bandeja. La segunda posición es la época de la
// sesión (un contador, nunca un token ni un identificador): al cambiar de
// empresa o de cuenta la época cambia y ninguna consulta anterior se sirve
// ni se reutiliza como dato provisional. Sin sesión lista la época es `null`
// y las consultas están deshabilitadas.

export type EpocaBandeja = number | null;

export const clavesBandeja = {
  /** Prefijo común: invalida lista y resumen de una época. */
  todas: (epoca: EpocaBandeja) => ['bandeja', epoca] as const,
  lista: (
    epoca: EpocaBandeja,
    estados: readonly EstadoBandeja[],
    pagina: number,
    limite: number,
  ) => ['bandeja', epoca, 'lista', { estados, pagina, limite }] as const,
  resumen: (epoca: EpocaBandeja) => ['bandeja', epoca, 'resumen'] as const,
};
