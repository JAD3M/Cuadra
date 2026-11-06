import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/shared/api';
import { respuestaLote, type RespuestaLote } from '@/shared/api/contratos';
import { invalidarTrasResolver } from '@/features/caso/invalidar';
import { useEpoca } from './useEpoca';

interface VariablesLote {
  ids: readonly string[];
  /** Época en la que se activó el lote: la guarda descarta las de otra. */
  epoca: number;
}

export interface LlamadasDeLote {
  onExito: (respuesta: RespuestaLote) => void;
  onFallo: (error: unknown) => void;
}

/**
 * `POST /conciliaciones/lotes` (5.3). Sin actualización optimista: la bandeja
 * cambia cuando el servidor respondió y la lista se volvió a pedir. Tras el
 * intento, con éxito O con error, se refresca la bandeja y los casos: un error
 * sin respuesta legible no prueba que nada se aplicó, y decir la verdad
 * exige volver a mirar.
 */
export function useConfirmarLote() {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  // Guarda síncrona contra el doble disparo (clic y Enter caen antes de que
  // `isPending` llegue a pintarse).
  const enVuelo = useRef(false);
  const epocaActual = useRef(epoca);
  useEffect(() => {
    epocaActual.current = epoca;
  }, [epoca]);

  const mutacion = useMutation({
    mutationFn: ({ ids }: VariablesLote) =>
      api.fetch('/conciliaciones/lotes', {
        method: 'POST',
        body: { ids },
        schema: respuestaLote,
      }),
    onSettled: async (_datos, _error, variables) => {
      enVuelo.current = false;
      if (variables.epoca !== epocaActual.current) return;
      await invalidarTrasResolver(cliente, variables.epoca);
    },
  });

  const { mutate } = mutacion;
  /** Devuelve `false` si no envió nada (otro en vuelo, sin ids o sesión no lista). */
  const confirmar = useCallback(
    (ids: readonly string[], llamadas: LlamadasDeLote): boolean => {
      if (enVuelo.current || epoca === null || ids.length === 0) return false;
      enVuelo.current = true;
      mutate(
        { ids, epoca },
        {
          onSuccess: (respuesta, variables) => {
            if (variables.epoca === epocaActual.current) {
              llamadas.onExito(respuesta);
            }
          },
          onError: (error, variables) => {
            if (variables.epoca === epocaActual.current) {
              llamadas.onFallo(error);
            }
          },
        },
      );
      return true;
    },
    [epoca, mutate],
  );

  return { confirmar, enviando: mutacion.isPending };
}
