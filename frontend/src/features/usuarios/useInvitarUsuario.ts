import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api';
import {
  invitacionUsuarioEnviada,
  type InvitacionUsuarioEnviada,
  type SolicitudInvitarUsuario,
} from '@/shared/api/contratos/usuarios';
import { clavesUsuarios, useEpoca } from './claves';

/**
 * `POST /usuarios/invitaciones`: invita por correo a una persona con uno o
 * más roles. La respuesta es idéntica exista o no la cuenta y la pantalla no
 * deriva nada de ella. No guarda nada en caché (`gcTime: 0`). Al terminar
 * invalida la lista de pendientes: la invitación nueva (o el reemplazo de una
 * previa al mismo correo) aparece sin recargar.
 */
export function useInvitarUsuario() {
  const cliente = useQueryClient();
  const epoca = useEpoca();
  return useMutation<
    InvitacionUsuarioEnviada,
    unknown,
    SolicitudInvitarUsuario
  >({
    gcTime: 0,
    onSuccess: () => {
      void cliente.invalidateQueries({
        queryKey: clavesUsuarios.pendientes(epoca),
      });
      void cliente.invalidateQueries({
        queryKey: clavesUsuarios.lista(epoca),
      });
    },
    mutationFn: ({ email, roles }) =>
      api.fetch('/usuarios/invitaciones', {
        method: 'POST',
        body: { email, roles },
        schema: invitacionUsuarioEnviada,
      }),
  });
}
