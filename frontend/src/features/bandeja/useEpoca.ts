import { useSessionContext } from '@/shared/sesion';
import type { EpocaBandeja } from './claves';

/** Época de la sesión lista, o `null` mientras no hay una. */
export function useEpoca(): EpocaBandeja {
  const sesion = useSessionContext();
  return sesion.status === 'ready' ? sesion.epoca : null;
}
