import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { PermisoEmpresa } from '../../auth/permisos/matriz';
import type {
  Scope as ScopeSesion,
  UsuarioAutenticado,
} from '../../auth/tipos';

export const LLAVE_PUBLICO = 'auth:publico';
export const LLAVE_SCOPE = 'auth:scope';
export const LLAVE_PERMISO = 'auth:permiso';

/** Deja pasar sin sesión. Solo para login, logout y health: todo lo demás la exige. */
export const Publico = () => SetMetadata(LLAVE_PUBLICO, true);

/**
 * Qué tipos de sesión acepta el endpoint: 'seleccion' (sin empresa elegida),
 * 'sesion' (con empresa) o ambos. Sin este decorador se exige `'sesion'`:
 * olvidarlo debe cerrar la puerta, no abrirla.
 *
 * 'plataforma' (AD-5) es el mundo del dueño de Cuadra: toda ruta bajo
 * `/plataforma` lo declara, y solo una sesión de tipo `plataforma` la
 * alcanza. No se mezcla con los otros dos en una misma ruta.
 *
 * Un endpoint que acepta 'seleccion' y no declara `@Permiso` no opera sobre
 * una empresa, así que `RolesGuard` no exige membresía en la de la sesión
 * (elegir o cambiar de empresa debe seguir posible aunque se haya perdido la
 * actual). Si además declara `@Permiso`, sí opera sobre ella: se exigen
 * membresía y rol como en cualquier endpoint.
 */
export const Scope = (...scopes: ScopeSesion[]) =>
  SetMetadata(LLAVE_SCOPE, scopes);

/**
 * AD-11. El permiso de la matriz (src/auth/permisos/matriz.ts) que exige el
 * endpoint. `RolesGuard` autoriza si cualquiera de los roles del usuario en la
 * empresa lo tiene (D-08). Todo endpoint de empresa lo declara: una prueba de
 * arquitectura falla si falta (junto con @Publico o @Scope).
 */
export const Permiso = (permiso: PermisoEmpresa) =>
  SetMetadata(LLAVE_PERMISO, permiso);

/** La petición ya pasó por `SesionCookieGuard`, así que `user` siempre existe. */
export interface SolicitudAutenticada extends Request {
  user: UsuarioAutenticado;
}

export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): UsuarioAutenticado =>
    contexto.switchToHttp().getRequest<SolicitudAutenticada>().user,
);
