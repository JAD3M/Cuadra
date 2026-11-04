import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { detalleCarga } from '@/shared/api/contratos';
import { clavesCargas, useEpoca } from './claves';

/**
 * `GET /cargas/:id` de una carga. Comparte clave con el sondeo del panel
 * (`clavesCargas.detalle`): el cuerpo es el mismo y las invalidaciones de la
 * vista previa también lo refrescan. Con `habilitado` en falso no pide nada;
 * la fila de una carga rechazada solo lo activa al abrirse (historia 3.7).
 */
export function useDetalleCarga(id: string, habilitado: boolean) {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesCargas.detalle(epoca, id),
    queryFn: ({ signal }) =>
      api.fetch(`/cargas/${encodeURIComponent(id)}`, {
        schema: detalleCarga,
        signal,
      }),
    enabled: habilitado && epoca !== null,
  });
}
