import type { OpcionSelector } from './SelectorTema';
import type { Preferencia } from './tipos';

/**
 * Opciones del control de tema, en el orden en que se muestran. Agregar o
 * quitar una opción es una línea; el selector no cambia. "Sistema" sigue al
 * sistema operativo y es la que queda marcada si no hay nada guardado.
 */
export const OPCIONES_TEMA: readonly OpcionSelector<Preferencia>[] = [
  { valor: 'light', etiqueta: 'Claro', glifo: '☀' },
  { valor: 'system', etiqueta: 'Sistema', glifo: '◐' },
  { valor: 'dark', etiqueta: 'Oscuro', glifo: '☾' },
];
