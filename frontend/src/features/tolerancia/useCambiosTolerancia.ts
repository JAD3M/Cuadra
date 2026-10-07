import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api';
import {
  extraerCambiosTolerancia,
  respuestaBitacoraCruda,
} from '@/shared/api/contratos';
import { ACCION_ACTUALIZAR, ENTIDAD_EMPRESA } from '@/shared/dominio';
import { clavesTolerancia, useEpoca } from './claves';
import { CAMBIOS_VISIBLES, LIMITE_CONSULTA_CAMBIOS } from './constantes';

/** Camino de la consulta, armado con las constantes del dominio. */
const RUTA_CAMBIOS =
  `/bitacora?entidad=${ENTIDAD_EMPRESA}` +
  `&accion=${ACCION_ACTUALIZAR}&limite=${LIMITE_CONSULTA_CAMBIOS}`;

/**
 * Últimos cambios de la tolerancia: `GET /bitacora` de la empresa con acción
 * `actualizar`, filtrado en el cliente a los eventos de tolerancia y recortado
 * a `CAMBIOS_VISIBLES` (el servidor no filtra por `datos.campo`). La
 * extracción ocurre en la `queryFn`, así que la caché ya guarda datos limpios.
 * `CAMBIOS_VISIBLES` se pasa explícito: el valor por defecto del contrato es
 * una copia local (shared no importa features) y aquí manda la de la feature.
 */
export function useCambiosTolerancia() {
  const epoca = useEpoca();
  return useQuery({
    queryKey: clavesTolerancia.cambios(epoca),
    queryFn: async ({ signal }) => {
      const respuesta = await api.fetch(RUTA_CAMBIOS, {
        schema: respuestaBitacoraCruda,
        signal,
      });
      return extraerCambiosTolerancia(respuesta.datos, CAMBIOS_VISIBLES);
    },
    enabled: epoca !== null,
  });
}
