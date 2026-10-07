import { skipToken, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { respuestaListadoBitacora } from '@/shared/api/contratos';
import { clavesBitacora, useEpoca } from './claves';
import { rutaBitacora, type ConsultaBitacora } from './consulta';

/**
 * Página de la bitácora para una consulta ya armada. `null` (rango invertido)
 * no envía nada: la pantalla avisa el rango y la consulta queda apagada. La
 * clave lleva la época de la sesión y las filas de la página anterior solo se
 * conservan mientras carga la siguiente DENTRO de la misma época: nada de una
 * empresa se muestra bajo otra.
 */
export function useBitacora(consulta: ConsultaBitacora | null) {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesBitacora.lista(epoca, consulta),
    queryFn:
      epoca === null || consulta === null
        ? skipToken
        : ({ signal }) =>
            api.fetch(rutaBitacora(consulta), {
              schema: respuestaListadoBitacora,
              signal,
            }),
    placeholderData: (anterior, consultaAnterior) =>
      consulta !== null && consultaAnterior?.queryKey[1] === epoca
        ? anterior
        : undefined,
  });
}
