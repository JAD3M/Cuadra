import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { usuariosListado } from '@/shared/api/contratos/usuarios';
import { clavesUsuarios, useEpoca } from './claves';

/**
 * `GET /usuarios`: las personas de la empresa (activas y con invitación
 * pendiente), ordenadas por correo. La clave lleva la época de la sesión;
 * `habilitado` apaga la consulta cuando la persona no tiene `usuarios.ver`
 * (el servidor igual respondería 403).
 */
export function useUsuarios(habilitado: boolean) {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesUsuarios.lista(epoca),
    queryFn: ({ signal }) =>
      api.fetch('/usuarios', { schema: usuariosListado, signal }),
    enabled: epoca !== null && habilitado,
  });
}
