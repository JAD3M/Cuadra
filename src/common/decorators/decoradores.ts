import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Rol } from '../entities/tipos';
import type { JwtPayload, UsuarioAutenticado } from '../../auth/tipos';

export const LLAVE_PUBLICO = 'auth:publico';
export const LLAVE_SCOPE = 'auth:scope';
export const LLAVE_ROLES = 'auth:roles';

/** Deja pasar sin token. Solo para login y health: todo lo demás exige uno. */
export const Publico = () => SetMetadata(LLAVE_PUBLICO, true);

/**
 * Qué tipo de token acepta el endpoint. Sin este decorador se exige
 * `'sesion'`: olvidarlo debe cerrar la puerta, no abrirla (mismo criterio
 * que el default corto de D-09).
 */
export const Scope = (scope: JwtPayload['scope']) =>
  SetMetadata(LLAVE_SCOPE, scope);

/** Autoriza si cualquiera de los roles del usuario en la empresa está aquí (D-08). */
export const Roles = (...roles: Rol[]) => SetMetadata(LLAVE_ROLES, roles);

/** La petición ya pasó por `JwtAuthGuard`, así que `user` siempre existe. */
export interface SolicitudAutenticada extends Request {
  user: UsuarioAutenticado;
}

export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): UsuarioAutenticado =>
    contexto.switchToHttp().getRequest<SolicitudAutenticada>().user,
);
