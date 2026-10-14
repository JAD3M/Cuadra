import type { MotivoRecuperacionInvalida } from '@/shared/api/contratos/recuperacion';

/**
 * Textos de la recuperación de contraseña (mockup `Recuperar.dc.html`,
 * historia 1.6). El largo mínimo es el de la política v1, que comparte con
 * las invitaciones; el servidor decide.
 */
export { LARGO_MINIMO_CONTRASENA } from '@/features/invitaciones/textos';

export const TEXTOS_RECUPERACION = {
  etiqueta: 'Recuperar acceso',
  titulo: '¿Olvidaste tu contraseña?',
  apoyo:
    'Escribe tu correo. Si hay una cuenta con él, te enviaremos un enlace para crear una contraseña nueva. El enlace dura 1 hora.',
  etiquetaCorreo: 'Correo',
  correoInvalido: 'Escribe un correo válido',
  enviarEnlace: 'Enviar enlace',
  enviando: 'Enviando…',
  volverAlLogin: '← Volver a iniciar sesión',
  etiquetaNueva: 'Nueva contraseña',
  tituloNueva: 'Elige una contraseña nueva',
  apoyoNueva:
    'Al guardarla cerraremos tus sesiones abiertas en todos tus dispositivos.',
  etiquetaContrasena: 'Contraseña nueva',
  ayudaContrasena: 'Mínimo 12 caracteres.',
  contrasenaCorta: 'La contraseña debe tener al menos 12 caracteres.',
  guardar: 'Guardar contraseña',
  guardando: 'Guardando…',
  irAIniciarSesion: 'Ir a iniciar sesión',
  pedirNuevo: 'Pedir un enlace nuevo',
  olvidaste: '¿Olvidaste tu contraseña?',
} as const;

/** Estados terminales de las dos pantallas, con su título y su texto. */
export type EstadoTerminalRecuperacion =
  'enviado' | 'exito' | MotivoRecuperacionInvalida | 'cuenta_desactivada';

export const TERMINALES_RECUPERACION: Record<
  EstadoTerminalRecuperacion,
  { titulo: string; texto: string }
> = {
  enviado: {
    titulo: 'Revisa tu correo',
    texto:
      'Si hay una cuenta con ese correo, te enviamos un enlace. Dura 1 hora y solo se puede usar una vez.',
  },
  exito: {
    titulo: 'Contraseña actualizada',
    texto:
      'Cerramos tus sesiones abiertas. Inicia sesión con tu contraseña nueva.',
  },
  usada: {
    titulo: 'Este enlace ya se usó',
    texto:
      'Si ya cambiaste tu contraseña, inicia sesión. Si no, pide un enlace nuevo.',
  },
  caducada: {
    titulo: 'Este enlace caducó',
    texto: 'Los enlaces duran 1 hora. Pide uno nuevo.',
  },
  reemplazada: {
    titulo: 'Este enlace fue reemplazado',
    texto: 'Usa el enlace del correo más reciente o pide uno nuevo.',
  },
  desconocida: {
    titulo: 'No encontramos este enlace',
    texto: 'Revisa que el enlace esté completo o pide uno nuevo.',
  },
  cuenta_desactivada: {
    titulo: 'Esta cuenta está desactivada',
    texto:
      'No se puede restablecer la contraseña de esta cuenta. Contacta a quien la administra.',
  },
};
