import { useMutation } from '@tanstack/react-query';
import { api } from '@/shared/api';
import {
  invitacionEnviada,
  type InvitacionEnviada,
  type SolicitudInvitarAdmin,
} from '@/shared/api/contratos/invitaciones';

export interface InvitarAdminVariables extends SolicitudInvitarAdmin {
  empresaId: string;
}

/**
 * `POST /plataforma/empresas/:id/invitaciones`: invita por correo a la
 * persona administradora. La respuesta es idéntica exista o no la cuenta y la
 * pantalla no deriva nada de ella. No toca la lista de empresas.
 */
export function useInvitarAdminPlataforma() {
  return useMutation<InvitacionEnviada, unknown, InvitarAdminVariables>({
    gcTime: 0,
    mutationFn: ({ empresaId, email }) =>
      api.fetch(
        `/plataforma/empresas/${encodeURIComponent(empresaId)}/invitaciones`,
        {
          method: 'POST',
          body: { email },
          schema: invitacionEnviada,
          terminaSesion: false,
        },
      ),
  });
}
