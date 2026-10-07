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

/** Encabezado de la página (Bitacora.dc.html). */
export const TITULO_PAGINA = 'Bitácora';
export const SUBTITULO_PAGINA =
  'Quién hizo qué y cuándo. Solo lectura, nadie la edita.';

/** Nombre accesible de la sección de resultados (encabezado oculto). */
export const EVENTOS = 'Eventos';

/** Formulario de filtros. Las opciones de entidad y acción son las de la API. */
export const FILTROS = {
  nombre: 'Filtros de la bitácora',
  entidad: 'Entidad',
  accion: 'Acción',
  usuario: 'Usuario',
  desde: 'Desde',
  hasta: 'Hasta',
  todas: 'Todas',
  todos: 'Todos',
} as const;

/** Aviso bajo «Hasta» cuando el rango está invertido: no se envía nada. */
export const RANGO_INVERTIDO = '«Desde» no puede ser posterior a «Hasta».';

/** Aviso bajo «Usuario» cuando la lista de personas no se pudo leer. */
export const USUARIOS_ERROR = 'No se pudo cargar la lista de usuarios.';
