import { z } from 'zod';
import { ROLES } from '@/shared/dominio';

// Contratos de la pantalla de Usuarios (historia 2.3). Se derivan de
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

export type SolicitudInvitarUsuario = z.infer<typeof solicitudInvitarUsuario>;
export type InvitacionUsuarioEnviada = z.infer<typeof invitacionUsuarioEnviada>;
