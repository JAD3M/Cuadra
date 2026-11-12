import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { bancosPdf } from '@/shared/api/contratos';
import { clavesCargas, useEpoca } from './claves';
import { VIGENCIA_PERFILES_MS } from './constantes';

/**
 * `GET /bancos/pdf` (historia 8.3, UX-DR4). Los bancos con lector de PDF salen
 * del backend, no de una copia en la pantalla. Es estática en el servidor, como
 * los perfiles: vigente el mismo tiempo y con la época en la clave. Si falla,
 * `data` queda indefinido: el select queda apagado con «Reintentar».
 */
export function useBancosPdf() {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesCargas.bancosPdf(epoca),
    queryFn: ({ signal }) =>
      api.fetch('/bancos/pdf', { schema: bancosPdf, signal }),
    enabled: epoca !== null,
    staleTime: VIGENCIA_PERFILES_MS,
  });
}
