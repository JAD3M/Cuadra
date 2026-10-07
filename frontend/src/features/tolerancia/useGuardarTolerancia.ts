import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { clavesCaso } from '@/features/caso/claves';
import { useEpocaVigente } from '@/features/cargas/useEpocaVigente';
import { ContratoError, api } from '@/shared/api';
import {
  respuestaTolerancia,
  type RespuestaTolerancia,
} from '@/shared/api/contratos';
import { clavesTolerancia, useEpoca } from './claves';

interface VariablesGuardado {
  /** Texto decimal tal como se manda: una CADENA JSON, nunca un número. */
  valor: string;
  /** Época en la que se activó el guardado: la guarda descarta las de otra. */
  epoca: number;
}

/** Lo que la pantalla hace con el resultado; solo se llama si sigue montada y en la misma época. */
export interface RespuestasGuardado {
  onSuccess?: (respuesta: RespuestaTolerancia) => void;
  onError?: (error: unknown) => void;
}

function enviar({ valor }: VariablesGuardado) {
  return api.fetch('/empresa/tolerancia', {
    method: 'PUT',
    body: { toleranciaMonto: valor },
    schema: respuestaTolerancia,
  });
}

/**
 * Guardar la tolerancia (`PUT /empresa/tolerancia`). Mismas guardas que
 * `useSubirCarga`: un solo envío en vuelo (síncrono), época capturada al
 * activar y comprobada al resolver.
 *
 * Éxito, solo en la época vigente: el valor de la RESPUESTA (normalizado por
 * el servidor) pasa a la caché sin pedirlo otra vez, los cambios se invalidan
 * para que aparezca la fila nueva y los detalles de caso en caché se marcan
 * como viejos porque embeben `toleranciaMonto`. La bandeja no se toca: el
 * motor no vuelve a correr. Las invalidaciones no se esperan; las tarjetas
 * tienen sus propios estados.
 */
export function useGuardarTolerancia() {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  // Guarda síncrona contra el doble disparo: `isPending` y `disabled` se
  // actualizan tras un render y un clic y un Enter pueden caer en ese intervalo.
  const enVuelo = useRef(false);
  const epocaActual = useEpocaVigente(epoca);

  const mutacion = useMutation({
    mutationFn: enviar,
    onSuccess: (datos, variables) => {
      if (variables.epoca !== epocaActual.current) return;
      const claveValor = clavesTolerancia.valor(variables.epoca);
      // Una lectura vieja en vuelo no debe pisar lo que acaba de guardarse.
      void cliente.cancelQueries({ queryKey: claveValor, exact: true });
      cliente.setQueryData(claveValor, datos);
      void cliente.invalidateQueries({
        queryKey: clavesTolerancia.cambios(variables.epoca),
      });
      void cliente.invalidateQueries({
        queryKey: clavesCaso.todas(variables.epoca),
      });
    },
    onError: (error, variables) => {
      if (variables.epoca !== epocaActual.current) return;
      // El servidor contestó 2xx con un cuerpo ilegible: el cambio pudo
      // hacerse, así que todo lo que lo refleja se vuelve a pedir.
      if (error instanceof ContratoError) {
        void cliente.invalidateQueries({
          queryKey: clavesTolerancia.valor(variables.epoca),
        });
        void cliente.invalidateQueries({
          queryKey: clavesTolerancia.cambios(variables.epoca),
        });
        void cliente.invalidateQueries({
          queryKey: clavesCaso.todas(variables.epoca),
        });
      }
    },
    onSettled: () => {
      enVuelo.current = false;
    },
  });

  const { mutate } = mutacion;
  /**
   * Devuelve `false` si no envió nada (otro guardado en vuelo o sesión no
   * lista). Los callbacks de `respuestas` van en `mutate` (no en el hook): no
   * se llaman tras desmontar y aquí se vuelve a comprobar la época.
   */
  const guardar = useCallback(
    (valor: string, respuestas?: RespuestasGuardado): boolean => {
      if (enVuelo.current || epoca === null) return false;
      enVuelo.current = true;
      mutate(
        { valor, epoca },
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

  return { ...mutacion, guardar };
}
