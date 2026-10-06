import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { respuestaCaso } from '@/shared/api/contratos';
import { useEpoca } from '@/features/bandeja/useEpoca';
import { clavesCaso } from './claves';

/**
 * `GET /casos/:movimientoId`. Sin `placeholderData`: nunca se muestra el dato
 * de otro caso ni de otra época mientras llega el propio. La política de
 * reintentos por defecto no repite un 4xx ni un fallo de contrato, así que el
 * usuario ve el estado de inmediato.
 */
export function useCaso(movimientoId: string) {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesCaso.detalle(epoca, movimientoId),
    queryFn: ({ signal }) =>
      api.fetch(`/casos/${encodeURIComponent(movimientoId)}`, {
        schema: respuestaCaso,
        signal,
      }),
    enabled: epoca !== null,
  });
}
