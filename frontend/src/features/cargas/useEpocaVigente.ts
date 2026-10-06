import { useEffect, useRef, type RefObject } from 'react';
import type { EpocaBandeja } from '@/features/bandeja/claves';

/**
 * Referencia a la época vigente AHORA: una petición que se resuelve compara
 * contra ella la época con la que salió y descarta lo que ya no corresponde.
 */
export function useEpocaVigente(epoca: EpocaBandeja): RefObject<EpocaBandeja> {
  const vigente = useRef(epoca);
  useEffect(() => {
    vigente.current = epoca;
  }, [epoca]);
  return vigente;
}
