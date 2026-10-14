import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { estadoInvitacion } from '@/shared/api/contratos/invitaciones';

/**
 * `GET /auth/invitaciones/:token`: siempre 200 con la misma forma. El token
 * viaja solo en la URL: la clave de la consulta no lo lleva y la caché se
 * descarta al salir (`gcTime: 0`), así que no queda guardado en ningún lado.
 * No hay reintentos de un enlace: un fallo se muestra y la persona recarga.
 */
export function useEstadoInvitacion(token: string) {
  return useQuery({
    queryKey: ['invitacion', 'estado'],
    gcTime: 0,
    staleTime: 0,
    queryFn: () =>
      api.fetch(`/auth/invitaciones/${encodeURIComponent(token)}`, {
        schema: estadoInvitacion,
        terminaSesion: false,
      }),
  });
}
