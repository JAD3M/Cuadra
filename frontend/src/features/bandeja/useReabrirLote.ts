import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/shared/api';
import {
  respuestaReabrirLote,
  type RespuestaReabrirLote,
} from '@/shared/api/contratos';
import { invalidarTrasResolver } from '@/features/caso/invalidar';
import { motivoParaEnvio } from '@/features/caso/motivo';
import { useEpoca } from './useEpoca';

interface VariablesReapertura {
  loteId: string;
  motivo: string;
  /** Época en la que se activó la reapertura: la guarda descarta las de otra. */
  epoca: number;
}

export interface LlamadasDeReapertura {
  onExito: (respuesta: RespuestaReabrirLote) => void;
  onFallo: (error: unknown) => void;
}

/**
 * `POST /conciliaciones/lotes/:loteId/reabrir` (5.8): reabre todo el lote con
 * un solo motivo, todo o nada. Mismas guardas que `useConfirmarLote` (un vuelo
 * a la vez, época de la activación, sin actualización optimista). Tras el
 * intento, con éxito o con error, se vuelven a pedir la bandeja y los casos:
 * un corte sin respuesta legible no prueba que nada se reabrió.
 */
export function useReabrirLote() {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  const enVuelo = useRef(false);
  const epocaActual = useRef(epoca);
  useEffect(() => {
    epocaActual.current = epoca;
  }, [epoca]);

  const mutacion = useMutation({
    mutationFn: ({ loteId, motivo }: VariablesReapertura) =>
      api.fetch(`/conciliaciones/lotes/${encodeURIComponent(loteId)}/reabrir`, {
        method: 'POST',
        body: { motivo },
        schema: respuestaReabrirLote,
      }),
    onSettled: async (_datos, _error, variables) => {
      enVuelo.current = false;
      if (variables.epoca !== epocaActual.current) return;
      await invalidarTrasResolver(cliente, variables.epoca);
    },
  });

  const { mutate } = mutacion;
  /** Devuelve `false` si no envió nada (otro en vuelo, motivo vacío o sesión no lista). */
  const reabrir = useCallback(
    (
      loteId: string,
      motivo: string,
      llamadas: LlamadasDeReapertura,
    ): boolean => {
      const texto = motivoParaEnvio(motivo);
      if (enVuelo.current || epoca === null || texto === undefined) {
        return false;
      }
      enVuelo.current = true;
      mutate(
        { loteId, motivo: texto, epoca },
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

  return { reabrir, enviando: mutacion.isPending };
}
