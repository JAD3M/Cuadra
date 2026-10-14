import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { estadoRecuperacion } from '@/shared/api/contratos/recuperacion';

/**
 * `GET /auth/recuperacion/:token`: siempre 200 con la misma forma. El token
 * viaja solo en la URL: la clave de la consulta no lo lleva y la caché se
 * descarta al salir (`gcTime: 0`). Sin reintentos: un fallo se muestra y la
 * persona recarga.
 */
export function useEstadoRecuperacion(token: string) {
  return useQuery({
    queryKey: ['recuperacion', 'estado'],
    gcTime: 0,
    staleTime: 0,
    queryFn: () =>
      api.fetch(`/auth/recuperacion/${encodeURIComponent(token)}`, {
        schema: estadoRecuperacion,
        terminaSesion: false,
      }),
  });
}
