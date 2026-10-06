import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { perfilesBancarios } from '@/shared/api/contratos';
import { clavesCargas, useEpoca } from './claves';
import { VIGENCIA_PERFILES_MS } from './constantes';

/**
 * `GET /bancos/perfiles`. La lista es estática en el servidor, pero la clave
 * lleva la época como todas las demás. Si falla, `data` queda indefinido: la
 * pantalla oculta el campo y el POST no manda `perfil` (el servidor usa el suyo).
 */
export function usePerfiles() {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesCargas.perfiles(epoca),
    queryFn: ({ signal }) =>
      api.fetch('/bancos/perfiles', { schema: perfilesBancarios, signal }),
    enabled: epoca !== null,
    staleTime: VIGENCIA_PERFILES_MS,
  });
}
