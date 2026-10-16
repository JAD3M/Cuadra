import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ZodType } from 'zod';
import { ContratoError, api } from '@/shared/api';
import {
  invitacionCancelada,
  invitacionReenviada,
  type InvitacionCancelada,
  type InvitacionReenviada,
} from '@/shared/api/contratos/usuarios';
import { clavesUsuarios, useEpoca } from './claves';

/**
 * Reenviar y cancelar comparten forma: un POST sobre el id de la fila. Éxito
 * invalida la lista de personas (la fila de un reenvío es otra, con otro id y otra
 * caducidad). Un 409 o un 404 NO la invalidan: la fila y su aviso siguen a la
 * vista y la lista se renueva en la próxima lectura. Un 2xx ilegible sí:
 * la acción pudo hacerse.
 */
function useAccion<T>(accion: 'reenviar' | 'cancelar', schema: ZodType<T>) {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  const invalidar = () =>
    cliente.invalidateQueries({ queryKey: clavesUsuarios.lista(epoca) });
  return useMutation<T, unknown, string>({
    gcTime: 0,
    mutationFn: (id) =>
      api.fetch(`/usuarios/invitaciones/${id}/${accion}`, {
        method: 'POST',
        schema,
      }),
    onSuccess: () => {
      void invalidar();
    },
    onError: (error) => {
      if (error instanceof ContratoError) void invalidar();
    },
  });
}

/** `POST /usuarios/invitaciones/:id/reenviar` (201). */
export function useReenviarInvitacion() {
  return useAccion<InvitacionReenviada>('reenviar', invitacionReenviada);
}

/** `POST /usuarios/invitaciones/:id/cancelar` (200). */
export function useCancelarInvitacion() {
  return useAccion<InvitacionCancelada>('cancelar', invitacionCancelada);
}
