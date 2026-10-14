import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/api';
import { listaEmpresasPlataforma } from '@/shared/api/contratos/plataforma';
import { CLAVE_PLATAFORMA } from '@/shared/sesion/plataforma';

/** `GET /plataforma/empresas`: la lista del dueño. */
export function useEmpresasPlataforma() {
  return useQuery({
    queryKey: [CLAVE_PLATAFORMA, 'empresas'],
    queryFn: () =>
      // Una llamada de plataforma nunca toca el cliente de empresa: su 401 lo
      // resuelve la pantalla con `terminar()` de la sesión de plataforma.
      api.fetch('/plataforma/empresas', {
        schema: listaEmpresasPlataforma,
        terminaSesion: false,
      }),
  });
}

/** 401 (sesión vencida) o 403 (cookie de otro mundo): la sesión ya no vale. */
export function esFinDeSesion(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.statusCode === 401 || error.statusCode === 403)
  );
}
