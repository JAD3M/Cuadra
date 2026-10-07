/**
 * Filas que se piden a GET /bitacora. El filtro por `datos.campo` es del
 * cliente: pedimos de más para que 5 filas de tolerancia sigan alcanzando si
 * otros cambios de empresa se intercalan. Debe quedar bajo `LIMITE_MAXIMO` del
 * backend (lo vigila tests/dominio/toleranciaEspejo.test.ts).
 */
export const LIMITE_CONSULTA_CAMBIOS = 50;

/** Cambios que muestra la tarjeta "Cambios recientes". */
export const CAMBIOS_VISIBLES = 5;
