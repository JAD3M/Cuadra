import type { MotivoInvitacionInvalida } from '@/shared/api/contratos/invitaciones';

/**
 * Textos de la página pública de invitación (mockup `Invitacion.dc.html`,
 * historia 1.5).
 */
export const TEXTOS_INVITACION = {
  etiqueta: 'Invitación',
  titulo: (empresa: string) => `Te invitaron a administrar ${empresa}`,
  cuentaNueva: 'Crea tu cuenta para entrar a Cuadra como administrador.',
  cuentaExistente:
    'Ya tienes una cuenta con este correo. No vamos a cambiar tu contraseña.',
  etiquetaNombre: 'Nombre',
  nombreVacio: 'Escribe tu nombre.',
  etiquetaContrasena: 'Contraseña',
  ayudaContrasena: 'Mínimo 12 caracteres.',
  contrasenaCorta: 'La contraseña debe tener al menos 12 caracteres.',
  crearYEntrar: 'Crear cuenta y entrar',
  aceptarYEntrar: 'Aceptar y entrar',
  entrando: 'Entrando…',
  irAIniciarSesion: 'Ir a iniciar sesión',
} as const;

/** Largo mínimo de la contraseña de una cuenta nueva (el servidor decide). */
export const LARGO_MINIMO_CONTRASENA = 12;

/** Motivos por los que el enlace no se puede usar, con su título y su texto. */
export type MotivoTerminal = MotivoInvitacionInvalida | 'sin_cuenta_inactiva';

export const TERMINALES: Record<
  MotivoTerminal,
  { titulo: string; texto: string }
> = {
  usada: {
    titulo: 'Esta invitación ya se usó',
    texto: 'Si ya creaste tu cuenta, inicia sesión.',
  },
  caducada: {
    titulo: 'Esta invitación caducó',
    texto: 'Pide al dueño de la plataforma que te envíe una nueva.',
  },
  reemplazada: {
    titulo: 'Esta invitación fue reemplazada',
    texto: 'Usa el enlace de la invitación más reciente que recibiste.',
  },
  cancelada: {
    titulo: 'Esta invitación fue cancelada',
    texto: 'Pide a un administrador que te invite de nuevo.',
  },
  desconocida: {
    titulo: 'No encontramos esta invitación',
    texto: 'Revisa que el enlace esté completo.',
  },
  sin_cuenta_inactiva: {
    titulo: 'Esta cuenta está desactivada',
    texto: 'Contacta al dueño de la plataforma.',
  },
};
