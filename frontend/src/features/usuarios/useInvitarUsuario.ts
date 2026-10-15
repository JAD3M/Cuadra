import { useMutation } from '@tanstack/react-query';
import { api } from '@/shared/api';
import {
  invitacionUsuarioEnviada,
  type InvitacionUsuarioEnviada,
  type SolicitudInvitarUsuario,
} from '@/shared/api/contratos/usuarios';

/**
 * `POST /usuarios/invitaciones`: invita por correo a una persona con uno o
 * más roles. La respuesta es idéntica exista o no la cuenta y la pantalla no
 * deriva nada de ella. No guarda nada en caché (`gcTime: 0`).
 */
export function useInvitarUsuario() {
  return useMutation<
    InvitacionUsuarioEnviada,
    unknown,
    SolicitudInvitarUsuario
  >({
    gcTime: 0,
    mutationFn: ({ email, roles }) =>
      api.fetch('/usuarios/invitaciones', {
        method: 'POST',
        body: { email, roles },
        schema: invitacionUsuarioEnviada,
      }),
  });
}
