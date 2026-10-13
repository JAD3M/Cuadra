import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Rol } from '../entities/tipos';
import type {
  Scope as ScopeSesion,
  UsuarioAutenticado,
} from '../../auth/tipos';

export const LLAVE_PUBLICO = 'auth:publico';
export const LLAVE_SCOPE = 'auth:scope';
export const LLAVE_ROLES = 'auth:roles';

/** Deja pasar sin sesión. Solo para login, logout y health: todo lo demás la exige. */
export const Publico = () => SetMetadata(LLAVE_PUBLICO, true);

/**
 * Qué tipos de sesión acepta el endpoint: 'seleccion' (sin empresa elegida),
 * 'sesion' (con empresa) o ambos. Sin este decorador se exige `'sesion'`:
 * olvidarlo debe cerrar la puerta, no abrirla.
 *
 * Un endpoint que acepta 'seleccion' no opera sobre una empresa, así que
 * `RolesGuard` no exige membresía en la empresa de la sesión (elegir o
 * cambiar de empresa debe seguir posible aunque se haya perdido la actual).
 */
export const Scope = (...scopes: ScopeSesion[]) =>
  SetMetadata(LLAVE_SCOPE, scopes);

/** Autoriza si cualquiera de los roles del usuario en la empresa está aquí (D-08). */
export const Roles = (...roles: Rol[]) => SetMetadata(LLAVE_ROLES, roles);

/** La petición ya pasó por `SesionCookieGuard`, así que `user` siempre existe. */
export interface SolicitudAutenticada extends Request {
  user: UsuarioAutenticado;
}

export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): UsuarioAutenticado =>
    contexto.switchToHttp().getRequest<SolicitudAutenticada>().user,
);
