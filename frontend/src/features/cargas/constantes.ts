/** Cada cuánto se vuelve a pedir lo que sigue activo (pendiente o procesando). */
export const INTERVALO_MS = 3000;

/** Desde que empieza una ventana de polling, se deja de pedir solo a los 5 min. */
export const TOPE_MS = 300_000;

/** La lista de perfiles bancarios es estática en el servidor. */
export const VIGENCIA_PERFILES_MS = 300_000;
