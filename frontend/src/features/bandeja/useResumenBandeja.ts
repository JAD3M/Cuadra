import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { resumenBandeja } from '@/shared/api/contratos';
import { clavesBandeja } from './claves';
import { useEpoca } from './useEpoca';

// Los contadores cambian por acciones explícitas (que invalidan `todas`), no
// por el paso del tiempo: sin esta ventana, cada observador nuevo (el
// contador de la barra lateral y los indicadores de la pantalla) repetiría la
// petición al montarse.
const VIGENCIA_RESUMEN_MS = 30_000;

/** `GET /bandeja/resumen`: conteos por estado y monto por revisar. */
export function useResumenBandeja() {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesBandeja.resumen(epoca),
    queryFn: ({ signal }) =>
      api.fetch('/bandeja/resumen', { schema: resumenBandeja, signal }),
    enabled: epoca !== null,
    staleTime: VIGENCIA_RESUMEN_MS,
  });
}

/**
 * Pendientes de revisión (sugerencia + sin match) para el contador de la
 * barra lateral. `undefined` mientras carga, si falla y si no hay ninguno:
 * el contador se oculta en los tres casos.
 */
export function usePendientesBandeja(): number | undefined {
  const { data, isError } = useResumenBandeja();
  if (isError || data === undefined) return undefined;
  const pendientes = data.conteos.sugerencia + data.conteos.sin_match;
  return pendientes > 0 ? pendientes : undefined;
}
