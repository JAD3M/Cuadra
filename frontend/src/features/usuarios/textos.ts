import { ERROR_CONEXION, ERROR_SIN_PERMISO } from '@/features/bandeja/textos';

// Textos de la pantalla de Usuarios (mockup `Usuarios.dc.html` y
// `UsuariosClaro.dc.html`). Los nombres y descripciones de los roles salen de
// `shared/dominio`; aquí solo va lo propio de la pantalla.

/** Título del documento y del encabezado de la página. */
export const TITULO_DOCUMENTO = 'Usuarios · Cuadra';
export const TITULO_PAGINA = 'Usuarios';
export const SUBTITULO_PAGINA =
  'Invita a personas a tu empresa y define qué puede hacer cada una.';

export { ERROR_SIN_PERMISO };

export const FORMULARIO = {
  titulo: 'Invitar a una persona',
  etiquetaCorreo: 'Correo',
  marcadorCorreo: 'nombre@empresa.mx',
  correoInvalido: 'Escribe un correo válido, por ejemplo nombre@empresa.mx.',
  rolesTitulo: 'Roles',
  rolesAyuda: 'Elige al menos uno. Puedes combinar varios.',
  rolesVacio: 'Elige al menos un rol.',
  enviar: 'Enviar invitación',
  enviando: 'Enviando invitación…',
  /** Solo para lectores de pantalla mientras el POST está en curso. */
  enviandoEstado: 'Enviando la invitación',
  vigencia: 'El enlace vence en 7 días y sirve una sola vez.',
} as const;

/** Lo mismo exista o no la cuenta de ese correo: no revela cuentas. */
export const CONFIRMACION = {
  titulo: 'Si el correo es válido, la persona recibirá una invitación.',
  correo: 'Correo',
  roles: 'Roles',
  otra: 'Invitar a otra persona',
} as const;

/** Alertas de un envío fallido, por clase. Nunca llevan texto del servidor. */
export const ALERTAS_INVITAR = {
  limite: {
    titulo: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  },
  envio: {
    titulo: 'No se pudo enviar el correo. Inténtalo de nuevo.',
  },
  conexion: {
    titulo: ERROR_CONEXION.titulo,
    detalle: ERROR_CONEXION.detalle,
  },
  otro: {
    titulo: 'No se pudo completar la solicitud.',
    detalle: 'Inténtalo de nuevo en unos minutos.',
  },
} as const;
