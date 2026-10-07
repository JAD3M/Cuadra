// Textos de la tabla de la bitácora (Bitacora.dc.html). Los componentes
// importan estas constantes en vez de escribir texto propio.

/** Nombre accesible de la tabla (se publica como `caption` oculto). */
export const NOMBRE_TABLA = 'Eventos de la bitácora';

/** Encabezados de columna, en el orden de la maqueta. */
export const COLUMNAS = {
  cuando: 'Cuándo',
  usuario: 'Usuario',
  accion: 'Acción',
  entidad: 'Entidad',
  detalle: 'Detalle',
} as const;

/** Autor de un evento sin usuario: lo hizo el sistema o la persona ya no existe. */
export const SISTEMA = 'Sistema';

/** Texto oculto del relleno de la primera carga. */
export const CARGANDO = 'Cargando la bitácora';
