import { api } from '@/shared/api';
import {
  respuestaComentario,
  type RespuestaComentario,
} from '@/shared/api/contratos';
import { useMutacionDescarte } from './useDescartarMovimiento';

export interface PeticionComentar {
  /** Id de la decisión que se comenta. */
  decisionId: string;
  /** Texto ya validado; se recorta antes de enviarlo. */
  texto: string;
}

/**
 * Deja un comentario sobre una decisión del caso. No cambia el estado: solo
 * agrega el comentario y su evento en la bitácora. Mismas guardas que el
 * descarte (un vuelo, época, sin actualización optimista); al terminar se
 * vuelven a pedir el caso y sus historiales.
 */
export function useComentarDecision() {
  const { lanzar, ...mutacion } = useMutacionDescarte<
    PeticionComentar,
    RespuestaComentario
  >(({ decisionId, texto }) =>
    api.fetch(`/conciliaciones/${encodeURIComponent(decisionId)}/comentarios`, {
      method: 'POST',
      body: { texto: texto.trim() },
      schema: respuestaComentario,
    }),
  );
  return { ...mutacion, comentar: lanzar };
}
