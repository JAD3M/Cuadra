/**
 * Textos de las pantallas de plataforma (mockup `Plataforma.dc.html`). Los
 * avisos se indexan por el motivo por el que se llegó a `/plataforma/login`.
 */
export const AVISOS_PLATAFORMA = {
  sesion_terminada: 'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
  sesion_cerrada: 'Cerraste sesión.',
} as const;

export type MotivoAvisoPlataforma = keyof typeof AVISOS_PLATAFORMA;

export const TEXTOS_PLATAFORMA = {
  marca: 'Cuadra',
  chip: 'Plataforma',
  titularPanel: 'Operación de la plataforma.',
  apoyoPanel:
    'Acceso interno del dueño de Cuadra. Aquí no hay datos de ninguna empresa.',
  etiquetaAcceso: 'Acceso interno',
  tituloAcceso: 'Entrar a la plataforma',
  cerrarSesion: 'Cerrar sesión',
  tituloEmpresas: 'Empresas',
  subtituloEmpresas:
    'Todas las empresas de la plataforma, con su nombre y su RFC.',
  listaEmpresas: 'Lista de empresas',
  vacioTitulo: 'Aún no hay empresas',
  vacioDetalle: 'Cuando haya empresas, aparecerán aquí con su nombre y su RFC.',
  columnaRazonSocial: 'Razón social',
  columnaRfc: 'RFC',
} as const;

/** Alta de empresa (mockup `Plataforma.dc.html`, historia 1.4). */
export const TEXTOS_ALTA_EMPRESA = {
  crear: 'Crear empresa',
  creando: 'Creando…',
  titulo: 'Nueva empresa',
  cancelar: 'Cancelar',
  etiquetaRazonSocial: 'Razón social',
  etiquetaRfc: 'RFC',
  ayudaRfc: '12 o 13 caracteres. Se guarda en mayúsculas y sin espacios.',
  razonVacia: 'Escribe la razón social',
  rfcVacio: 'Escribe el RFC',
  razonInvalida:
    'La razón social no puede ir vacía ni pasar de 255 caracteres.',
  rfcFormato:
    'El RFC no tiene un formato válido: debe tener 12 o 13 caracteres (3 o 4 letras, fecha AAMMDD y homoclave).',
  rfcGenerico:
    'Este RFC es genérico (público en general o extranjero) y no puede usarse para una empresa.',
  duplicadoTitulo: 'Ese RFC ya pertenece a otra empresa',
  duplicadoDetalle: 'No se creó nada. Revisa el RFC e inténtalo de nuevo.',
  creadaTitulo: 'Empresa creada',
  creadaDetalle: (razonSocial: string) =>
    `${razonSocial} ya aparece en la lista.`,
} as const;

/** Invitar al administrador (mockup `Plataforma.dc.html`, historia 1.5). */
export const TEXTOS_INVITAR = {
  columnaAcciones: 'Acciones',
  boton: 'Invitar administrador',
  etiquetaBoton: (razonSocial: string) =>
    `Invitar administrador de ${razonSocial}`,
  titulo: (razonSocial: string) => `Invitar administrador de ${razonSocial}`,
  etiquetaCorreo: 'Correo del administrador',
  ayudaCorreo: 'La persona recibirá un enlace válido por 7 días.',
  correoInvalido: 'Escribe un correo válido.',
  enviar: 'Enviar invitación',
  enviando: 'Enviando…',
  cancelar: 'Cancelar',
  enviadaTitulo: (correo: string) => `Invitación enviada a ${correo}.`,
  enviadaDetalle: 'El enlace vence en 7 días.',
  sinServicioTitulo: 'No se pudo enviar el correo.',
  sinServicioDetalle: 'Inténtalo de nuevo.',
  limiteTitulo: 'Demasiadas invitaciones.',
  limiteDetalle: 'Espera unos minutos e inténtalo de nuevo.',
} as const;

/** Bancos y vista previa (mockup `Plataforma.dc.html`, historia 3.6). */
export const TEXTOS_BANCOS = {
  titulo: 'Bancos',
  descripcion:
    'Aquí decides cuándo un banco deja de pedir vista previa. Se cuentan las cargas aceptadas de todas las empresas.',
  lista: 'Lista de bancos',
  columnaBanco: 'Banco',
  columnaAceptadas: 'Cargas aceptadas',
  columnaEstado: 'Estado',
  columnaAcciones: 'Acciones',
  obligatoria: 'Vista previa obligatoria',
  levantadaEl: (fecha: string) => `Levantada el ${fecha}`,
  sinAcciones: 'Sin acciones',
  faltan: (n: number) =>
    `Faltan ${n} ${n === 1 ? 'carga aceptada' : 'cargas aceptadas'}`,
  boton: 'Levantar vista previa',
  etiquetaBoton: (banco: string) => `Levantar la vista previa de ${banco}`,
  confirmarTitulo: (banco: string) => `Levantar la vista previa de ${banco}`,
  confirmarTexto: (banco: string) =>
    `Desde ahora, los PDF de ${banco} de todas las empresas pasarán directo a conciliación, sin vista previa. El cuadre de saldos sigue aplicando. Esto no se puede deshacer desde aquí.`,
  levantando: 'Levantando…',
  cancelar: 'Cancelar',
  levantadaTitulo: (banco: string) => `Vista previa de ${banco} levantada.`,
  levantadaDetalle: 'Quedó registrada con tu usuario y la fecha.',
  yaLevantadaTitulo: 'Ese banco ya estaba levantado.',
  yaLevantadaDetalle: 'No se cambió nada.',
  sinEvidenciaTitulo: 'Todavía no hay evidencia suficiente.',
} as const;

/** Separación de funciones por empresa (mockup `Plataforma.dc.html`, historia 5.5). */
export const TEXTOS_SEPARACION = {
  columna: 'Separación de funciones',
  activa: 'Activa',
  desactivada: 'Desactivada',
  botonDesactivar: 'Desactivar separación',
  botonActivar: 'Activar separación',
  etiquetaDesactivar: (razonSocial: string) =>
    `Desactivar la separación de funciones de ${razonSocial}`,
  etiquetaActivar: (razonSocial: string) =>
    `Activar la separación de funciones de ${razonSocial}`,
  formularioDesactivar: 'Desactivar separación de funciones',
  formularioActivar: 'Activar separación de funciones',
  tituloDesactivar: (razonSocial: string) =>
    `Desactivar la separación de funciones de ${razonSocial}`,
  tituloActivar: (razonSocial: string) =>
    `Volver a activar la separación de funciones de ${razonSocial}`,
  textoDesactivar:
    'Quien suba una carga de esta empresa podrá confirmar sus propias conciliaciones, y todos sus usuarios verán un aviso en la bandeja y en la bitácora. Solo afecta a esta empresa.',
  textoActivar:
    'La empresa volverá a impedir que quien sube una carga confirme sus propias conciliaciones, y el aviso de la bandeja y de la bitácora desaparece.',
  etiquetaMotivo: 'Motivo',
  ayudaMotivo:
    'Obligatorio, hasta 500 caracteres. Queda en la bitácora de la plataforma y en la de la empresa.',
  motivoVacio: 'Escribe el motivo del cambio.',
  guardando: 'Guardando…',
  cancelar: 'Cancelar',
  desactivadaTitulo: 'Separación de funciones desactivada.',
  activadaTitulo: 'Separación de funciones activada de nuevo.',
  cambiadaDetalle: (razonSocial: string) =>
    `${razonSocial}. Quedó en la bitácora de la plataforma y en la de la empresa, con tu usuario, la fecha y el motivo.`,
  yaEstabaTitulo: 'La separación de funciones ya estaba en ese estado.',
  yaEstabaDetalle: 'No se cambió nada.',
} as const;
