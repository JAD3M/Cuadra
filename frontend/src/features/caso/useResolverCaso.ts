import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { ContratoError, api } from '@/shared/api';
import { respuestaResolucion } from '@/shared/api/contratos';
import { ACCION_CONFIRMAR } from '@/shared/dominio';
import { useEpoca } from '@/features/bandeja/useEpoca';
import { clavesCaso } from './claves';
import type { AccionCaso } from './errores';
import { invalidarTrasResolver } from './invalidar';

export interface PeticionResolver {
  accion: AccionCaso;
  conciliacionId: string;
  /** Solo para rechazar; se recorta y, vacío, se omite. */
  motivo?: string;
}

interface VariablesResolver extends PeticionResolver {
  /** Época en la que se activó la acción: la guarda descarta las de otra. */
  epoca: number;
}

/**
 * Confirmar o rechazar la propuesta indicada. Una sola mutación cubre ambos
 * botones: un solo `isPending`, un solo error y una sola guarda. Sin
 * actualización optimista: la pantalla cambia cuando el servidor respondió y
 * el caso se volvió a pedir.
 */
export function useResolverCaso() {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  // Guarda síncrona contra el doble disparo: `isPending` y el atributo
  // `disabled` se actualizan tras un render y un clic y un Enter pueden caer
  // en ese intervalo.
  const enVuelo = useRef(false);
  // Época vigente al resolverse la petición, no la de cuando se activó.
  const epocaActual = useRef(epoca);
  useEffect(() => {
    epocaActual.current = epoca;
  }, [epoca]);

  const mutacion = useMutation({
    mutationFn: ({ accion, conciliacionId, motivo }: VariablesResolver) => {
      const ruta = `/conciliaciones/${encodeURIComponent(conciliacionId)}/${accion}`;
      if (accion === ACCION_CONFIRMAR) {
        return api.fetch(ruta, {
          method: 'POST',
          schema: respuestaResolucion,
        });
      }
      const texto = motivo?.trim();
      return api.fetch(ruta, {
        method: 'POST',
        // Siempre un objeto JSON: un cuerpo vacío llegaría indefinido.
        body: texto ? { motivo: texto } : {},
        schema: respuestaResolucion,
      });
    },
    onSuccess: async (_datos, variables) => {
      if (variables.epoca !== epocaActual.current) return;
      await invalidarTrasResolver(cliente, variables.epoca);
    },
    onError: async (error, variables) => {
      if (variables.epoca !== epocaActual.current) return;
      // El servidor contestó 200 con un cuerpo ilegible: la escritura pudo
      // ocurrir, así que se vuelve a pedir el caso para decir la verdad.
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
  const resolver = useCallback(
    (peticion: PeticionResolver): boolean => {
      if (enVuelo.current || epoca === null) return false;
      enVuelo.current = true;
      mutate({ ...peticion, epoca });
      return true;
    },
    [epoca, mutate],
  );

  return { ...mutacion, resolver };
}
