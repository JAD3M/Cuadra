import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/shared/api';
import { respuestaMarca, type ResultadoMuestra } from '@/shared/api/contratos';
import { clavesMuestra, useEpoca } from './claves';

export interface PeticionMarca {
  decisionId: string;
  resultado: ResultadoMuestra;
}

/**
 * `POST /muestra/casos/:decisionId/verificar` (historia 9.4). Un solo vuelo a
 * la vez, época de la activación y sin actualización optimista: la pantalla
 * cambia cuando el servidor respondió y la muestra se volvió a pedir. Tras
 * cualquier respuesta del servidor (también un 403, 404 o 409) se relee la
 * muestra: el caso pudo cambiar mientras la persona lo miraba. «Cambiar marca»
 * es otra marca; la última vale.
 */
export function useVerificarMuestra() {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  const enVuelo = useRef(false);
  // Época vigente al resolverse la petición, no la de cuando se activó.
  const epocaActual = useRef(epoca);
  useEffect(() => {
    epocaActual.current = epoca;
  }, [epoca]);

  const mutacion = useMutation({
    mutationFn: ({ peticion }: { peticion: PeticionMarca; epoca: number }) =>
      api.fetch(
        `/muestra/casos/${encodeURIComponent(peticion.decisionId)}/verificar`,
        {
          method: 'POST',
          body: { resultado: peticion.resultado },
          schema: respuestaMarca,
        },
      ),
    onSettled: async (_datos, _error, variables) => {
      enVuelo.current = false;
      if (variables.epoca !== epocaActual.current) return;
      await cliente.invalidateQueries({
        queryKey: clavesMuestra.todas(variables.epoca),
      });
    },
  });

  const { mutate } = mutacion;
  /** Devuelve `false` si no envió nada (otra en vuelo o sesión no lista). */
  const marcar = useCallback(
    (peticion: PeticionMarca, alExito?: () => void): boolean => {
      if (enVuelo.current || epoca === null) return false;
      enVuelo.current = true;
      mutate({ peticion, epoca }, { onSuccess: alExito });
      return true;
    },
    [epoca, mutate],
  );
  return { ...mutacion, marcar };
}
