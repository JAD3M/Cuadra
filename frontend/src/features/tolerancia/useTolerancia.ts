import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { respuestaTolerancia } from '@/shared/api/contratos';
import { clavesTolerancia, useEpoca } from './claves';

/**
 * `GET /empresa/tolerancia`: el valor vigente como cadena decimal del
 * servidor ("0.5000"). La clave lleva la época de la sesión; sin sesión lista
 * la consulta queda apagada. Es independiente de los cambios recientes: una
 * puede fallar mientras la otra llega.
 */
export function useTolerancia() {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesTolerancia.valor(epoca),
    queryFn: ({ signal }) =>
      api.fetch('/empresa/tolerancia', { schema: respuestaTolerancia, signal }),
    enabled: epoca !== null,
  });
}
