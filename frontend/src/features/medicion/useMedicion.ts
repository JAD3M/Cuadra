import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { tasaDeDesacuerdo } from '@/shared/api/contratos';
import { clavesMedicion, useEpoca } from './claves';

/**
 * `GET /medicion/desacuerdo` (historia 9.1): la tasa de desacuerdo de la
 * empresa de la sesión, que el servidor calcula en cada consulta. La clave lleva
 * la época; `habilitado` apaga la consulta si la persona no tiene
 * `medicion.ver`, para no pedirla en vano.
 */
export function useMedicion(habilitado = true) {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesMedicion.desacuerdo(epoca),
    queryFn: ({ signal }) =>
      api.fetch('/medicion/desacuerdo', { schema: tasaDeDesacuerdo, signal }),
    enabled: epoca !== null && habilitado,
  });
}
