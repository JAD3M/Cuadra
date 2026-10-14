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
