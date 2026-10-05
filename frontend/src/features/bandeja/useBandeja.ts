import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { respuestaBandeja } from '@/shared/api/contratos';
import {
  ESTADOS_BANDEJA,
  ESTADOS_POR_DEFECTO,
  type EstadoBandeja,
} from '@/shared/dominio/bandeja';
import { clavesBandeja } from './claves';
import { LIMITE_PAGINA } from './constantes';
import { useEpoca } from './useEpoca';

export interface ParametrosBandeja {
  estados: readonly EstadoBandeja[];
  pagina: number;
}

/** Estados únicos en el orden canónico; sin ninguno, los de por defecto. */
function canonicos(estados: readonly EstadoBandeja[]): EstadoBandeja[] {
  const pedidos = ESTADOS_BANDEJA.filter((e) => estados.includes(e));
  return pedidos.length > 0 ? pedidos : [...ESTADOS_POR_DEFECTO];
}

/**
 * Ruta de `GET /bandeja`. Siempre manda los estados de forma explícita y el
 * límite fijo: el cliente nunca depende de los valores por defecto del
 * servidor ni envía algo que cause un 400.
 */
export function rutaBandeja(
  estados: readonly EstadoBandeja[],
  pagina: number,
): string {
  const consulta = new URLSearchParams();
  for (const estado of estados) consulta.append('estado', estado);
  consulta.set('pagina', String(pagina));
  consulta.set('limite', String(LIMITE_PAGINA));
  return `/bandeja?${consulta.toString()}`;
}

/**
 * Página de la bandeja. La clave lleva la época de la sesión y las filas de
 * la página anterior solo se conservan mientras carga la siguiente DENTRO de
 * la misma época: nada de una empresa se muestra bajo otra.
 */
export function useBandeja({ estados, pagina }: ParametrosBandeja) {
  const epoca = useEpoca();
  const pedidos = canonicos(estados);
  return useQuery({
    queryKey: clavesBandeja.lista(epoca, pedidos, pagina, LIMITE_PAGINA),
    queryFn: ({ signal }) =>
      api.fetch(rutaBandeja(pedidos, pagina), {
        schema: respuestaBandeja,
        signal,
      }),
    enabled: epoca !== null,
    placeholderData: (anterior, consultaAnterior) =>
      consultaAnterior?.queryKey[1] === epoca ? anterior : undefined,
  });
}
