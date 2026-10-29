import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { api } from '@/shared/api';
import {
  respuestaDecisionVistaPrevia,
  type RespuestaDecisionVistaPrevia,
} from '@/shared/api/contratos';
import { clavesBandeja } from '@/features/bandeja/claves';
import { clavesCargas, useEpoca } from '@/features/cargas/claves';
import { useEpocaVigente } from '@/features/cargas/useEpocaVigente';

export type AccionVistaPrevia = 'aceptar' | 'rechazar';

export interface PeticionDecision {
  accion: AccionVistaPrevia;
  cargaId: string;
}

type VariablesDecision = PeticionDecision & {
  /** Época en la que se activó la acción: la guarda descarta las de otra. */
  epoca: number;
};

/** Lo que la pantalla hace con el resultado; solo se llama si sigue en la misma época. */
export interface RespuestasDecision {
  onSuccess?: (respuesta: RespuestaDecisionVistaPrevia) => void;
  onError?: (error: unknown) => void;
}

/**
 * Aceptar o rechazar la vista previa de una carga (historia 3.4). Una sola
 * mutación cubre ambos botones: un solo `isPending`, un solo error y una sola
 * guarda. Sin actualización optimista: la pantalla cambia cuando el servidor
 * respondió. Al terminar se invalidan el historial y el detalle de la carga
 * (cambió de estado) y, al aceptar, la bandeja (entran movimientos y el motor
 * corre). La vista previa misma NO se invalida: ya no existe y volver a
 * pedirla daría un 404 que taparía el resultado.
 */
export function useDecidirVistaPrevia() {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  // Guarda síncrona contra el doble disparo (un clic y un Enter pueden caer
  // antes de que `disabled` se pinte).
  const enVuelo = useRef(false);
  const epocaActual = useEpocaVigente(epoca);

  const mutacion = useMutation({
    mutationFn: ({ accion, cargaId }: VariablesDecision) =>
      api.fetch(`/cargas/${encodeURIComponent(cargaId)}/${accion}`, {
        method: 'POST',
        schema: respuestaDecisionVistaPrevia,
      }),
    onSuccess: (_datos, variables) => {
      if (variables.epoca !== epocaActual.current) return;
      void cliente.invalidateQueries({
        queryKey: clavesCargas.lista(variables.epoca),
      });
      void cliente.invalidateQueries({
        queryKey: clavesCargas.detalle(variables.epoca, variables.cargaId),
      });
      if (variables.accion === 'aceptar') {
        void cliente.invalidateQueries({
          queryKey: clavesBandeja.todas(variables.epoca),
        });
      }
    },
    onSettled: () => {
      enVuelo.current = false;
    },
  });

  const { mutate } = mutacion;
  /** Devuelve `false` si no envió nada (otra en vuelo o sesión no lista). */
  const decidir = useCallback(
    (peticion: PeticionDecision, respuestas?: RespuestasDecision): boolean => {
      if (enVuelo.current || epoca === null) return false;
      enVuelo.current = true;
      mutate(
        { ...peticion, epoca },
        {
          onSuccess: (datos, variables) => {
            if (variables.epoca !== epocaActual.current) return;
            respuestas?.onSuccess?.(datos);
          },
          onError: (error, variables) => {
            if (variables.epoca !== epocaActual.current) return;
            respuestas?.onError?.(error);
          },
        },
      );
      return true;
    },
    [epoca, epocaActual, mutate],
  );

  return { ...mutacion, decidir };
}
