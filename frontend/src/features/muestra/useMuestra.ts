import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import { respuestaMuestra } from '@/shared/api/contratos';
import { clavesMuestra, useEpoca } from './claves';

/**
 * `GET /muestra` (historia 9.4). `mes` es `AAAA-MM`; `null` pide el más
 * reciente con muestra. La clave lleva la época; `habilitado` apaga la
 * consulta si la persona no tiene `muestra.ver`. Al cambiar de mes se
 * conserva la lectura anterior solo dentro de la misma época.
 */
export function useMuestra(mes: string | null, habilitado = true) {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesMuestra.lectura(epoca, mes),
    queryFn: ({ signal }) =>
      api.fetch(
        mes === null ? '/muestra' : `/muestra?mes=${encodeURIComponent(mes)}`,
        { schema: respuestaMuestra, signal },
      ),
    enabled: epoca !== null && habilitado,
    placeholderData: (anterior, consultaAnterior) =>
      consultaAnterior?.queryKey[1] === epoca ? anterior : undefined,
  });
}
