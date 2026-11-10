import { api } from '@/shared/api';
import {
  respuestaReabrir,
  type RespuestaReabrir,
} from '@/shared/api/contratos';
import { useMutacionDescarte } from './useDescartarMovimiento';

export interface PeticionReabrir {
  /** Id de la decisión confirmada que se reabre. */
  conciliacionId: string;
  /** Texto ya validado; se recorta antes de enviarlo. */
  motivo: string;
}

/**
 * Reabre una confirmación con su motivo (obligatorio): el caso vuelve a la
 * bandeja como pendiente. Mismas guardas que el descarte (un vuelo, época,
 * sin actualización optimista); al terminar se vuelven a pedir el caso, su
 * historial y la bandeja.
 */
export function useReabrirConfirmacion() {
  const { lanzar, ...mutacion } = useMutacionDescarte<
    PeticionReabrir,
    RespuestaReabrir
  >(({ conciliacionId, motivo }) =>
    api.fetch(`/conciliaciones/${encodeURIComponent(conciliacionId)}/reabrir`, {
      method: 'POST',
      body: { motivo: motivo.trim() },
      schema: respuestaReabrir,
    }),
  );
  return { ...mutacion, reabrir: lanzar };
}
