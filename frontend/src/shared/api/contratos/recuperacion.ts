import { z } from 'zod';

// Contratos de la recuperación de contraseña (historia 1.6). Se derivan de
// src/recuperacion/dto/recuperacion.dto.ts. Los objetos ignoran claves
// desconocidas; lo que falta falla en voz alta. El token viaja solo en la URL.

/** Cuerpo de `POST /auth/recuperacion`. */
export const solicitudRecuperacion = z.object({ email: z.string().min(1) });

/**
 * Respuesta de pedir el enlace: el mismo texto exista o no la cuenta. La
 * pantalla no deriva nada de ella, solo la valida.
 */
export const solicitudRecibida = z.object({ mensaje: z.string() });

export const MOTIVOS_RECUPERACION_INVALIDA = [
  'usada',
  'caducada',
  'reemplazada',
  'desconocida',
] as const;

export const motivoRecuperacionInvalida = z.enum(MOTIVOS_RECUPERACION_INVALIDA);

/**
 * `GET /auth/recuperacion/:token`: siempre 200 con la misma forma. Vigente no
 * trae datos de la cuenta; inválida trae solo el motivo.
 */
export const estadoRecuperacion = z.discriminatedUnion('estado', [
  z.object({ estado: z.literal('vigente'), motivo: z.null() }),
  z.object({
    estado: z.literal('invalida'),
    motivo: motivoRecuperacionInvalida,
  }),
]);

/** Cuerpo de `POST /auth/recuperacion/:token`. */
export const solicitudRestablecer = z.object({ password: z.string() });

/** Respuesta de restablecer; no abre sesión. */
export const contrasenaRestablecida = z.object({ mensaje: z.string() });

export type SolicitudRecuperacion = z.infer<typeof solicitudRecuperacion>;
export type SolicitudRecibida = z.infer<typeof solicitudRecibida>;
export type MotivoRecuperacionInvalida = z.infer<
  typeof motivoRecuperacionInvalida
>;
export type EstadoRecuperacion = z.infer<typeof estadoRecuperacion>;
export type SolicitudRestablecer = z.infer<typeof solicitudRestablecer>;
export type ContrasenaRestablecida = z.infer<typeof contrasenaRestablecida>;
