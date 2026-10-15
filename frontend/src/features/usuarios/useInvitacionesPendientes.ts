import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { invitacionesPendientes } from '@/shared/api/contratos/usuarios';
import { clavesUsuarios, useEpoca } from './claves';

/**
 * `GET /usuarios/invitaciones`: las pendientes de la empresa, la más reciente
 * primero. La clave lleva la época de la sesión; `habilitado` apaga la consulta
 * cuando la persona no tiene `usuarios.ver` (el servidor igual respondería
 * 403).
 */
export function useInvitacionesPendientes(habilitado: boolean) {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesUsuarios.pendientes(epoca),
    queryFn: ({ signal }) =>
      api.fetch('/usuarios/invitaciones', {
        schema: invitacionesPendientes,
        signal,
      }),
    enabled: epoca !== null && habilitado,
  });
}
