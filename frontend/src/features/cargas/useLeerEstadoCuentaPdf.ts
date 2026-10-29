import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { api } from '@/shared/api';
import {
  respuestaLecturaPdf,
  type RespuestaLecturaPdf,
} from '@/shared/api/contratos';
import { clavesCargas, useEpoca } from './claves';
import { construirFormLecturaPdf } from './formularios';
import { useEpocaVigente } from './useEpocaVigente';

export interface PeticionLecturaPdf {
  archivo: File;
  /** El id del banco (`bbva`). */
  banco: string;
}

type VariablesLectura = PeticionLecturaPdf & {
  /** Época en la que se activó la lectura: la guarda descarta las de otra. */
  epoca: number;
};

/** Lo que la pantalla hace con el resultado; solo se llama si sigue montada y en la misma época. */
export interface RespuestasLecturaPdf {
  onSuccess?: (lectura: RespuestaLecturaPdf) => void;
  onError?: (error: unknown) => void;
}

/**
 * Leer un PDF de estado de cuenta (historias 3.2 y 3.3). Si cuadra, el
 * servidor lo guarda como una carga `pendiente_vista_previa`: la lista del
 * historial se invalida sin esperarla. Un rechazo no guarda nada y no la toca.
 * Mismas guardas que `useSubirCarga`: un solo envío en vuelo y una respuesta
 * de otra época se descarta. Los saldos llegan como cadenas y así se quedan.
 */
export function useLeerEstadoCuentaPdf() {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  // Guarda síncrona contra el doble disparo (un clic y un Enter pueden caer
  // antes de que `disabled` se pinte).
  const enVuelo = useRef(false);
  const epocaActual = useEpocaVigente(epoca);

  const mutacion = useMutation({
    mutationFn: (variables: VariablesLectura) =>
      api.fetch('/cargas/estado-cuenta/pdf', {
        method: 'POST',
        body: construirFormLecturaPdf(variables),
        schema: respuestaLecturaPdf,
      }),
    onSuccess: (_datos, variables) => {
      if (variables.epoca !== epocaActual.current) return;
      void cliente.invalidateQueries({
        queryKey: clavesCargas.lista(variables.epoca),
      });
    },
    onSettled: () => {
      enVuelo.current = false;
    },
  });

  const { mutate } = mutacion;
  /** Devuelve `false` si no envió nada (otra en vuelo o sesión no lista). */
  const leer = useCallback(
    (
      peticion: PeticionLecturaPdf,
      respuestas?: RespuestasLecturaPdf,
    ): boolean => {
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

  return { ...mutacion, leer };
}
