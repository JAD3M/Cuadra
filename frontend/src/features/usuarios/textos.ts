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

/**
 * «Personas de tu empresa» (mockup `Usuarios.dc.html`, vistas `usuarios*`).
 * Los avisos de error de fila reutilizan `ALERTAS_INVITAR`; el 409 usa el
 * texto del servidor y `noPendiente` es solo el respaldo cuando no lo manda.
 */
export const PERSONAS = {
  titulo: 'Personas de tu empresa',
  ayuda:
    'Quién tiene acceso y con qué roles. Las invitaciones aún sin aceptar muestran su estado.',
  tabla: 'Tabla de personas de tu empresa',
  columnas: {
    correo: 'Correo',
    roles: 'Roles',
    estado: 'Estado',
    enviada: 'Enviada',
    invitadaPor: 'Invitada por',
    acciones: 'Acciones',
  },
  /** Estado de una persona con cuenta. */
  activo: 'Activo',
  /** Estado de una invitación vigente; `dias` ya viene como «N día(s)». */
  pendiente: (dias: string) => `Pendiente · vence en ${dias}`,
  vencida: 'Vencida',
  /** Enviada e Invitada por de una persona activa. */
  sinDato: '—',
  plataforma: 'Plataforma',
  cargando: 'Cargando personas',
  errorLista: 'No se pudo cargar la lista de personas.',
  reintentar: 'Reintentar',
  reenviar: 'Reenviar',
  cancelar: 'Cancelar',
  ariaReenviar: (correo: string) => `Reenviar invitación a ${correo}`,
  ariaCancelar: (correo: string) => `Cancelar invitación a ${correo}`,
  confirmarGrupo: 'Confirmar cancelación',
  confirmarSi: 'Sí, cancelar',
  confirmarVolver: 'Volver',
  noPendiente: 'Esta invitación ya no está pendiente.',
  reenviada: (correo: string) =>
    `Invitación reenviada a ${correo}. El enlace anterior ya no sirve.`,
  cancelada: (correo: string) => `Invitación a ${correo} cancelada.`,
} as const;

/**
 * Editar roles y quitar acceso (historia 2.6, mockup `Usuarios.dc.html`).
 * `roles` ya viene como lista legible («Contador, Revisor»).
 */
export const ROLES_PERSONA = {
  cambiar: 'Cambiar roles',
  quitar: 'Quitar acceso',
  guardar: 'Guardar cambios',
  guardarYQuitar: 'Guardar y quitar acceso',
  cancelar: 'Cancelar',
  confirmarSi: 'Sí, quitar acceso',
  volver: 'Volver',
  sinRolesAviso:
    'Sin ningún rol, la persona pierde el acceso a tu empresa. Conserva sus roles en otras empresas.',
  aplicaSiguiente: 'El cambio aplica en su siguiente petición.',
  confirmarQuitar: (correo: string) =>
    `¿Quitar el acceso de ${correo} a tu empresa? Lo pierde de inmediato y sus sesiones en ella dejan de servir. Conserva sus roles en otras empresas.`,
  ultimoAdmin:
    'No se puede quitar ni degradar al único administrador. Asigna el rol de administrador a otra persona primero.',
  errorGuardar: 'No se pudo guardar el cambio. Inténtalo de nuevo.',
  errorQuitar: 'No se pudo quitar el acceso. Inténtalo de nuevo.',
  rolesGuardados: (correo: string, roles: string) =>
    `Roles de ${correo} actualizados: ${roles}. El cambio aplica en su siguiente petición.`,
  accesoQuitado: (correo: string) =>
    `Acceso de ${correo} a tu empresa quitado. Ya no puede entrar a ella.`,
} as const;
