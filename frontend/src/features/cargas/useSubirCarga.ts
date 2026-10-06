import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { ContratoError, api } from '@/shared/api';
import { respuestaCarga, type RespuestaCarga } from '@/shared/api/contratos';
import { TIPO_CFDI, TIPO_ESTADO_CUENTA } from '@/shared/dominio';
import { clavesCargas, useEpoca } from './claves';
import { useEpocaVigente } from './useEpocaVigente';
import { construirFormCfdi, construirFormEstadoCuenta } from './formularios';

export type PeticionSubida =
  | { tipo: typeof TIPO_CFDI; archivos: readonly File[] }
  | {
      tipo: typeof TIPO_ESTADO_CUENTA;
      archivo: File;
      banco: string;
      cuenta: string;
      /** `null` cuando no hay perfil elegido: el POST no manda `perfil`. */
      perfil: string | null;
    };

type VariablesSubida = PeticionSubida & {
  /** Época en la que se activó la subida: la guarda descarta las de otra. */
  epoca: number;
};

/** Lo que la pantalla hace con el resultado; solo se llama si sigue montada y en la misma época. */
export interface RespuestasSubida {
  onSuccess?: (respuesta: RespuestaCarga) => void;
  onError?: (error: unknown) => void;
}

function enviar(variables: VariablesSubida) {
  if (variables.tipo === TIPO_CFDI) {
    return api.fetch('/cargas/cfdi', {
      method: 'POST',
      body: construirFormCfdi(variables.archivos),
      schema: respuestaCarga,
    });
  }
  return api.fetch('/cargas/estado-cuenta', {
    method: 'POST',
    body: construirFormEstadoCuenta(variables),
    schema: respuestaCarga,
  });
}

/**
 * Subir un lote de CFDI o un estado de cuenta. Una sola mutación cubre ambas
 * tarjetas: un solo `isPending`, un solo error y una sola guarda. Mismas
 * guardas que `useResolverCaso`, pero la lista se invalida SIN esperarla: la
 * respuesta del POST ya alimenta el panel y la tabla tiene sus propios estados.
 */
export function useSubirCarga() {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  // Guarda síncrona contra el doble disparo: `isPending` y `disabled` se
  // actualizan tras un render y un clic y un Enter pueden caer en ese intervalo.
  const enVuelo = useRef(false);
  const epocaActual = useEpocaVigente(epoca);

  const mutacion = useMutation({
    mutationFn: enviar,
    onSuccess: (_datos, variables) => {
      if (variables.epoca !== epocaActual.current) return;
      void cliente.invalidateQueries({
        queryKey: clavesCargas.lista(variables.epoca),
      });
    },
    onError: (error, variables) => {
      if (variables.epoca !== epocaActual.current) return;
      // El servidor contestó 2xx con un cuerpo ilegible: la carga pudo
      // crearse, así que la tabla se vuelve a pedir para decir la verdad.
      if (error instanceof ContratoError) {
        void cliente.invalidateQueries({
          queryKey: clavesCargas.lista(variables.epoca),
        });
      }
    },
    onSettled: () => {
      enVuelo.current = false;
    },
  });

  const { mutate } = mutacion;
  /**
   * Devuelve `false` si no envió nada (otra en vuelo o sesión no lista). Los
   * callbacks de `respuestas` van en `mutate` (no en el hook): no se llaman
   * tras desmontar y aquí se vuelve a comprobar la época.
   */
  const subir = useCallback(
    (peticion: PeticionSubida, respuestas?: RespuestasSubida): boolean => {
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

  return { ...mutacion, subir };
}
