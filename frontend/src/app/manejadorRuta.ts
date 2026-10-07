/** Dato que cada ruta publica en `handle` para el título de la página. */
export interface ManejadorRuta {
  titulo: string;
  /** Línea de apoyo bajo el título; opcional. */
  subtitulo?: string;
  /**
   * Línea de apoyo que lleva el nombre de la empresa activa. La arma el shell
   * con la empresa de la sesión; si la ruta declara también `subtitulo`, este
   * es el que vale mientras haya empresa.
   */
  subtituloConEmpresa?: (empresa: string) => string;
  /**
   * Título del documento (pestaña) cuando difiere del encabezado. Sin él, el
   * documento usa `<titulo> · Cuadra`.
   */
  tituloDocumento?: string;
}

/** Lee el título de un `handle` de ruta, o `undefined` si no tiene. */
export function tituloDeRuta(manejador: unknown): string | undefined {
  if (typeof manejador !== 'object' || manejador === null) return undefined;
  const { titulo } = manejador as Partial<ManejadorRuta>;
  return typeof titulo === 'string' ? titulo : undefined;
}

/**
 * Lee el subtítulo de un `handle` de ruta, o `undefined` si no tiene. Con
 * `empresa` y un `subtituloConEmpresa` en el handle, devuelve el que arma esa
 * función; en cualquier otro caso, el `subtitulo` estático.
 */
export function subtituloDeRuta(
  manejador: unknown,
  empresa?: string,
): string | undefined {
  if (typeof manejador !== 'object' || manejador === null) return undefined;
  const { subtitulo, subtituloConEmpresa } =
    manejador as Partial<ManejadorRuta>;
  if (empresa !== undefined && typeof subtituloConEmpresa === 'function') {
    return subtituloConEmpresa(empresa);
  }
  return typeof subtitulo === 'string' ? subtitulo : undefined;
}

/**
 * Título del documento de un `handle`: el `tituloDocumento` si la ruta lo
 * declara; si no, `<titulo> · Cuadra`; `undefined` si no hay ninguno.
 */
export function tituloDocumentoDeRuta(manejador: unknown): string | undefined {
  if (typeof manejador !== 'object' || manejador === null) return undefined;
  const { tituloDocumento } = manejador as Partial<ManejadorRuta>;
  if (typeof tituloDocumento === 'string') return tituloDocumento;
  const titulo = tituloDeRuta(manejador);
  return titulo ? `${titulo} · Cuadra` : undefined;
}
