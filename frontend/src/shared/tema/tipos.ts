/** Lo que la persona eligió. `system` sigue la preferencia del sistema. */
export type Preferencia = 'light' | 'dark' | 'system';

/** Lo que se pinta: el valor que va en `data-theme`. */
export type TemaResuelto = 'light' | 'dark';

export const CLAVE_TEMA = 'cuadra.tema';

export const PREFERENCIAS: readonly Preferencia[] = ['light', 'dark', 'system'];

export const CONSULTA_OSCURO = '(prefers-color-scheme: dark)';
