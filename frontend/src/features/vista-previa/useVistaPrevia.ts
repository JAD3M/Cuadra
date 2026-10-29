import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { vistaPreviaCarga } from '@/shared/api/contratos';
import { clavesCargas, useEpoca } from '@/features/cargas/claves';

/**
 * `GET /cargas/:id/vista-previa` (historia 3.4). Sin `placeholderData`: nunca
 * se muestra la vista previa de otra carga ni de otra época. La política de
 * reintentos por defecto no repite un 4xx, así que un 404 o un 409 se ve de
 * inmediato.
 */
export function useVistaPrevia(cargaId: string) {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesCargas.vistaPrevia(epoca, cargaId),
    queryFn: ({ signal }) =>
      api.fetch(`/cargas/${encodeURIComponent(cargaId)}/vista-previa`, {
        schema: vistaPreviaCarga,
        signal,
      }),
    enabled: epoca !== null,
  });
}
