import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { respuestaUsuariosBitacora } from '@/shared/api/contratos';
import { clavesBitacora, useEpoca } from './claves';

/**
 * `GET /bitacora/usuarios`: las personas del filtro de usuario (id y nombre,
 * sin correo). Es independiente de la lista: si falla, el filtro avisa y los
 * eventos se siguen viendo. La clave lleva la época de la sesión; sin sesión
 * lista la consulta queda apagada.
 */
export function useUsuariosBitacora() {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesBitacora.usuarios(epoca),
    queryFn: async ({ signal }) => {
      const respuesta = await api.fetch('/bitacora/usuarios', {
        schema: respuestaUsuariosBitacora,
        signal,
      });
      return respuesta.datos;
    },
    enabled: epoca !== null,
  });
}
