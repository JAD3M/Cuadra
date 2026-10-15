import { z } from 'zod';
import { ROLES } from '@/shared/dominio';

// Contratos de la pantalla de Usuarios (historias 2.3 y 2.4). Se derivan de
// src/usuarios/dto/usuarios.dto.ts. Aquí no hay montos ni tokens.

const rol = z.enum(ROLES);

/**
 * Cuerpo de `POST /usuarios/invitaciones`: el correo y uno o más roles de la
 * empresa. Una lista vacía o un rol que no está en el espejo no valen.
 */
export const solicitudInvitarUsuario = z.object({
  email: z.string().min(1),
  roles: z.array(rol).min(1),
});

/**
 * Respuesta de invitar. Es idéntica exista o no la cuenta: la pantalla no
 * deriva nada de ella (muestra lo que la persona escribió), solo la valida.
 */
export const invitacionUsuarioEnviada = z.object({
  email: z.string(),
  roles: z.array(rol),
});

/**
 * Una fila de `GET /usuarios/invitaciones` (historia 2.4): nunca trae el
 * token. `vencida` la decide el servidor; `invitadaPor` es nulo cuando la
 * creó la plataforma.
 */
export const invitacionPendiente = z.object({
  id: z.guid(),
  email: z.string().min(1),
  roles: z.array(rol).min(1),
  creadaEn: z.iso.datetime(),
  venceEn: z.iso.datetime(),
  vencida: z.boolean(),
  invitadaPor: z.string().nullable(),
});

/** `GET /usuarios/invitaciones`: las pendientes, la más reciente primero. */
export const invitacionesPendientes = z.array(invitacionPendiente);

/** `POST /usuarios/invitaciones/:id/reenviar` (201), igual que invitar. */
export const invitacionReenviada = invitacionUsuarioEnviada;

/** `POST /usuarios/invitaciones/:id/cancelar` (200). */
export const invitacionCancelada = z.object({ email: z.string() });

/**
 * Una fila de `GET /usuarios` (historia 2.5), de `UsuarioListadoDto`: una
 * persona de la empresa, activa o con invitación pendiente. `id` es el del
 * usuario si está activa y el de la invitación si está pendiente;
 * `invitacionId`, `venceEn`, `creadaEn` e `invitadaPor` solo vienen en las
 * pendientes. Nunca trae el token.
 */
export const usuarioListado = z.object({
  id: z.guid(),
  email: z.string().min(1),
  nombre: z.string().nullable(),
  roles: z.array(rol),
  estado: z.enum(['activo', 'pendiente']),
  invitacionId: z.guid().nullable(),
  vencida: z.boolean(),
  venceEn: z.iso.datetime().nullable(),
  creadaEn: z.iso.datetime().nullable(),
  invitadaPor: z.string().nullable(),
});

/** `GET /usuarios`: una fila por persona, ordenada por correo. */
export const usuariosListado = z.array(usuarioListado);

export type UsuarioListado = z.infer<typeof usuarioListado>;
export type InvitacionPendiente = z.infer<typeof invitacionPendiente>;
export type InvitacionReenviada = z.infer<typeof invitacionReenviada>;
export type InvitacionCancelada = z.infer<typeof invitacionCancelada>;
export type SolicitudInvitarUsuario = z.infer<typeof solicitudInvitarUsuario>;
export type InvitacionUsuarioEnviada = z.infer<typeof invitacionUsuarioEnviada>;
