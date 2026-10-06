import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { respuestaHistorial } from '@/shared/api/contratos';
import { useEpoca } from '@/features/bandeja/useEpoca';
import { clavesCaso } from './claves';

/**
 * `GET /conciliaciones/:id/historial` de la propuesta indicada. Con `null`
 * (no hay propuesta cuyo historial mostrar) no se pide nada; al cambiar el id
 * se pide el del nuevo.
 */
export function useHistorial(conciliacionId: string | null) {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesCaso.historial(epoca, conciliacionId ?? ''),
    queryFn: ({ signal }) =>
      api.fetch(
        `/conciliaciones/${encodeURIComponent(conciliacionId ?? '')}/historial`,
        { schema: respuestaHistorial, signal },
      ),
    enabled: epoca !== null && conciliacionId !== null,
  });
}
