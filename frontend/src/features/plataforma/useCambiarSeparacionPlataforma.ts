import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/api';
import {
  empresaSeparacionCambiada,
  type EmpresaPlataforma,
  type SolicitudCambiarSeparacion,
} from '@/shared/api/contratos/plataforma';
import { CLAVE_PLATAFORMA } from '@/shared/sesion/plataforma';

export interface CambiarSeparacionVariables extends SolicitudCambiarSeparacion {
  empresaId: string;
}

/**
 * `PUT /plataforma/empresas/:id/separacion-funciones`: desactiva o reactiva la
 * separación de funciones de una empresa, con motivo. La lista se vuelve a
 * pedir al terminar bien y también con un 409 o un 404 (alguien ya la cambió
 * o la empresa ya no existe):
 * el chip sale del servidor, no de una suposición.
 */
export function useCambiarSeparacionPlataforma() {
  const cliente = useQueryClient();
  const refrescar = () =>
    cliente.invalidateQueries({ queryKey: [CLAVE_PLATAFORMA, 'empresas'] });
  return useMutation<EmpresaPlataforma, unknown, CambiarSeparacionVariables>({
    gcTime: 0,
    mutationFn: ({ empresaId, activa, motivo }) =>
      api.fetch(
        `/plataforma/empresas/${encodeURIComponent(empresaId)}/separacion-funciones`,
        {
          method: 'PUT',
          body: { activa, motivo },
          schema: empresaSeparacionCambiada,
          terminaSesion: false,
        },
      ),
    onSuccess: refrescar,
    onError: (error) => {
      if (
        error instanceof ApiError &&
        (error.statusCode === 409 || error.statusCode === 404)
      ) {
        void refrescar();
      }
    },
  });
}
