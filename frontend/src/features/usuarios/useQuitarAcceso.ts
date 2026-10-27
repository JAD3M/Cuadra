import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ContratoError, api } from '@/shared/api';
import {
  usuarioRoles,
  type UsuarioRoles,
} from '@/shared/api/contratos/usuarios';
import { clavesUsuarios, useEpoca } from './claves';

/**
 * `DELETE /usuarios/:id/roles` (historia 2.6): quita todos los roles de una
 * persona en la empresa. Éxito invalida la lista de personas; un 409 o un 404
 * no (ver `useCambiarRoles`).
 */
export function useQuitarAcceso() {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  const invalidar = () =>
    cliente.invalidateQueries({ queryKey: clavesUsuarios.lista(epoca) });
  return useMutation<UsuarioRoles, unknown, string>({
    gcTime: 0,
    mutationFn: (id) =>
      api.fetch(`/usuarios/${id}/roles`, {
        method: 'DELETE',
        schema: usuarioRoles,
      }),
    onSuccess: () => {
      void invalidar();
    },
    onError: (error) => {
      if (error instanceof ContratoError) void invalidar();
    },
  });
}
