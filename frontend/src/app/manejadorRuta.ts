/** Dato que cada ruta publica en `handle` para el título de la página. */
export interface ManejadorRuta {
  titulo: string;
  /** Línea de apoyo bajo el título; opcional. */
  subtitulo?: string;
}

/** Lee el título de un `handle` de ruta, o `undefined` si no tiene. */
export function tituloDeRuta(manejador: unknown): string | undefined {
  if (typeof manejador !== 'object' || manejador === null) return undefined;
  const { titulo } = manejador as Partial<ManejadorRuta>;
  return typeof titulo === 'string' ? titulo : undefined;
}

/** Lee el subtítulo de un `handle` de ruta, o `undefined` si no tiene. */
export function subtituloDeRuta(manejador: unknown): string | undefined {
  if (typeof manejador !== 'object' || manejador === null) return undefined;
  const { subtitulo } = manejador as Partial<ManejadorRuta>;
  return typeof subtitulo === 'string' ? subtitulo : undefined;
}
