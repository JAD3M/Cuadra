import { useMutation } from '@tanstack/react-query';
import { api } from '@/shared/api';
import {
  solicitudRecibida,
  type SolicitudRecibida,
  type SolicitudRecuperacion,
} from '@/shared/api/contratos/recuperacion';

/**
 * `POST /auth/recuperacion`: responde 200 con el mismo texto exista o no la
 * cuenta, así que la pantalla no deriva nada de la respuesta. `gcTime: 0`
 * suelta el correo de la caché en cuanto termina.
 */
export function useSolicitarRecuperacion() {
  return useMutation<SolicitudRecibida, unknown, SolicitudRecuperacion>({
    gcTime: 0,
    mutationFn: (cuerpo) =>
      api.fetch('/auth/recuperacion', {
        method: 'POST',
        body: cuerpo,
        schema: solicitudRecibida,
        terminaSesion: false,
      }),
  });
}
