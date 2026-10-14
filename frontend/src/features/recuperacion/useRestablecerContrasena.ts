import { useMutation } from '@tanstack/react-query';
import { api } from '@/shared/api';
import {
  contrasenaRestablecida,
  type ContrasenaRestablecida,
  type SolicitudRestablecer,
} from '@/shared/api/contratos/recuperacion';

/**
 * `POST /auth/recuperacion/:token`: cambia la contraseña y consume el enlace.
 * No abre sesión. La contraseña vive en las variables de la mutación y
 * `gcTime: 0` la suelta de la caché en cuanto termina.
 */
export function useRestablecerContrasena(token: string) {
  return useMutation<ContrasenaRestablecida, unknown, SolicitudRestablecer>({
    gcTime: 0,
    mutationFn: (cuerpo) =>
      api.fetch(`/auth/recuperacion/${encodeURIComponent(token)}`, {
        method: 'POST',
        body: cuerpo,
        schema: contrasenaRestablecida,
        terminaSesion: false,
      }),
  });
}
