import { z } from 'zod';

// Contratos de las invitaciones (historias 1.5 y 2.4). Se derivan de
// src/plataforma/dto/plataforma.dto.ts y src/invitaciones/dto/invitaciones.dto.ts.
// Los objetos ignoran claves desconocidas; lo que falta falla en voz alta.
// Aquí no hay montos ni tokens: el token viaja solo en la URL.

const texto = z.string().min(1);

/** Cuerpo de `POST /plataforma/empresas/:id/invitaciones`. */
export const solicitudInvitarAdmin = z.object({ email: z.string().min(1) });

/**
 * Respuesta de invitar. Es idéntica exista o no la cuenta: la pantalla no
 * deriva nada de ella, solo la valida.
 */
export const invitacionEnviada = z.object({ email: z.string() });

export const MOTIVOS_INVITACION_INVALIDA = [
  'usada',
  'caducada',
  'reemplazada',
  'cancelada',
  'desconocida',
] as const;

export const motivoInvitacionInvalida = z.enum(MOTIVOS_INVITACION_INVALIDA);

/**
 * `GET /auth/invitaciones/:token`: siempre 200 con la misma forma. Vigente
 * trae la empresa y si hay que elegir contraseña; inválida solo el motivo.
 */
export const estadoInvitacion = z.discriminatedUnion('estado', [
  z.object({
    estado: z.literal('vigente'),
    motivo: z.null(),
    empresa: texto,
    requierePassword: z.boolean(),
  }),
  z.object({
    estado: z.literal('invalida'),
    motivo: motivoInvitacionInvalida,
    empresa: z.null(),
    requierePassword: z.null(),
  }),
]);

/** Cuerpo de `POST /auth/invitaciones/:token/aceptar`. */
export const solicitudAceptarInvitacion = z.object({
  nombre: z.string().optional(),
  password: z.string().optional(),
});

/** Respuesta de aceptar; la sesión viaja en la cookie `httpOnly`. */
export const invitacionAceptada = z.object({
  companyId: z.guid(),
  razonSocial: texto,
  cuentaNueva: z.boolean(),
});

export type SolicitudInvitarAdmin = z.infer<typeof solicitudInvitarAdmin>;
export type InvitacionEnviada = z.infer<typeof invitacionEnviada>;
export type MotivoInvitacionInvalida = z.infer<typeof motivoInvitacionInvalida>;
export type EstadoInvitacion = z.infer<typeof estadoInvitacion>;
export type SolicitudAceptarInvitacion = z.infer<
  typeof solicitudAceptarInvitacion
>;
export type InvitacionAceptada = z.infer<typeof invitacionAceptada>;
