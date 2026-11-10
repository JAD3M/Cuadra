import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { ContratoError, api } from '@/shared/api';
import {
  respuestaDescarte,
  type RespuestaDescarte,
} from '@/shared/api/contratos';
import { useEpoca } from '@/features/bandeja/useEpoca';
import { clavesCaso } from './claves';
import { invalidarTrasResolver } from './invalidar';

export interface PeticionDescartar {
  movimientoId: string;
  /** Texto ya validado; se recorta antes de enviarlo. */
  motivo: string;
}

export interface PeticionDeshacer {
  movimientoId: string;
}

/**
 * Mutación del descarte (y de la reapertura, 5.7) con las mismas guardas que
 * `useResolverCaso`: un solo vuelo a la vez, época de la activación y sin
 * actualización optimista. La pantalla cambia cuando el servidor respondió y
 * el caso se volvió a pedir.
 */
export function useMutacionDescarte<P, R = RespuestaDescarte>(
  enviar: (peticion: P) => Promise<R>,
) {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  const enVuelo = useRef(false);
  // Época vigente al resolverse la petición, no la de cuando se activó.
  const epocaActual = useRef(epoca);
  useEffect(() => {
    epocaActual.current = epoca;
  }, [epoca]);

  const mutacion = useMutation({
    mutationFn: ({ peticion }: { peticion: P; epoca: number }) =>
      enviar(peticion),
    onSuccess: async (_datos, variables) => {
      if (variables.epoca !== epocaActual.current) return;
      await invalidarTrasResolver(cliente, variables.epoca);
    },
    onError: async (error, variables) => {
      if (variables.epoca !== epocaActual.current) return;
      // 200 con cuerpo ilegible: la escritura pudo ocurrir.
      if (error instanceof ContratoError) {
        await cliente.invalidateQueries({
          queryKey: clavesCaso.todas(variables.epoca),
        });
      }
    },
    onSettled: () => {
      enVuelo.current = false;
    },
  });

  const { mutate } = mutacion;
  /** Devuelve `false` si no envió nada (otra en vuelo o sesión no lista). */
  const lanzar = useCallback(
    (peticion: P): boolean => {
      if (enVuelo.current || epoca === null) return false;
      enVuelo.current = true;
      mutate({ peticion, epoca });
      return true;
    },
    [epoca, mutate],
  );
  return { ...mutacion, lanzar };
}

function base(movimientoId: string) {
  return `/movimientos/${encodeURIComponent(movimientoId)}`;
}

/** Descarta un movimiento abierto con su motivo (obligatorio). */
export function useDescartarMovimiento() {
  const { lanzar, ...mutacion } = useMutacionDescarte<PeticionDescartar>(
    ({ movimientoId, motivo }) =>
      api.fetch(`${base(movimientoId)}/descartar`, {
        method: 'POST',
        body: { motivo: motivo.trim() },
        schema: respuestaDescarte,
      }),
  );
  return { ...mutacion, descartar: lanzar };
}

/** Deshace el descarte vigente: el movimiento vuelve a la bandeja. */
export function useDeshacerDescarte() {
  const { lanzar, ...mutacion } = useMutacionDescarte<PeticionDeshacer>(
    ({ movimientoId }) =>
      api.fetch(`${base(movimientoId)}/deshacer-descarte`, {
        method: 'POST',
        schema: respuestaDescarte,
      }),
  );
  return { ...mutacion, deshacer: lanzar };
}
