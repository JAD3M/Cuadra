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
    'Todas las empresas de la plataforma, con su RFC y su estado.',
  listaEmpresas: 'Lista de empresas',
  vacioTitulo: 'Aún no hay empresas',
  vacioDetalle:
    'Cuando haya empresas, aparecerán aquí con su nombre, su RFC y su estado.',
} as const;
