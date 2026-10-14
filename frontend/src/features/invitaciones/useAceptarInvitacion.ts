import { useMutation } from '@tanstack/react-query';
import { api } from '@/shared/api';
import {
  invitacionAceptada,
  type InvitacionAceptada,
  type SolicitudAceptarInvitacion,
} from '@/shared/api/contratos/invitaciones';

/**
 * `POST /auth/invitaciones/:token/aceptar`: cuenta nueva manda `nombre` y
 * `password`; cuenta existente no manda nada. El servidor pone la cookie de
 * sesión. La contraseña vive en las variables de la mutación y `gcTime: 0` la
 * suelta de la caché en cuanto termina.
 */
export function useAceptarInvitacion(token: string) {
  return useMutation<InvitacionAceptada, unknown, SolicitudAceptarInvitacion>({
    gcTime: 0,
    mutationFn: (cuerpo) =>
      api.fetch(`/auth/invitaciones/${encodeURIComponent(token)}/aceptar`, {
        method: 'POST',
        body: cuerpo,
        schema: invitacionAceptada,
        terminaSesion: false,
      }),
  });
}
