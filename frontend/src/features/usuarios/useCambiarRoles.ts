import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ContratoError, api } from '@/shared/api';
import {
  usuarioRoles,
  type SolicitudCambiarRoles,
  type UsuarioRoles,
} from '@/shared/api/contratos/usuarios';
import { clavesUsuarios, useEpoca } from './claves';

/**
 * `PATCH /usuarios/:id/roles` (historia 2.6): reemplaza el conjunto de roles
 * de una persona en la empresa. Éxito invalida la lista de personas. Un 409 o
 * un 404 NO la invalidan (el aviso sigue a la vista); un 2xx ilegible sí, porque
 * el cambio pudo hacerse.
 */
export function useCambiarRoles() {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  const invalidar = () =>
    cliente.invalidateQueries({ queryKey: clavesUsuarios.lista(epoca) });
  return useMutation<
    UsuarioRoles,
    unknown,
    SolicitudCambiarRoles & { id: string }
  >({
    gcTime: 0,
    mutationFn: ({ id, roles }) =>
      api.fetch(`/usuarios/${id}/roles`, {
        method: 'PATCH',
        body: { roles },
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
