import { type EstadoBandeja } from './bandeja';
import { ROLES, type Rol } from './tipos';

/**
 * Texto visible de cada rol. Es un `Record<Rol, string>`: si el backend agrega
 * un rol, el espejo lo trae y esta tabla deja de compilar hasta etiquetarlo.
 */
export const ETIQUETAS_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  contador: 'Contador',
  revisor: 'Revisor',
};

/**
 * Texto visible de cada estado de la bandeja. Es un
 * `Record<EstadoBandeja, string>`: si el backend agrega un estado, esta tabla
 * deja de compilar hasta etiquetarlo.
 */
export const ETIQUETAS_ESTADO_BANDEJA: Record<EstadoBandeja, string> = {
  sugerencia: 'Sugerencia',
  sin_match: 'Sin match',
  conciliado: 'Conciliado',
};

/**
 * Ordena los roles como en `ROLES` (admin, contador, revisor) sin importar el
 * orden de entrada. No modifica el arreglo recibido. No deduplica: la
 * multiplicidad de la entrada se conserva (el contrato del backend no repite
 * roles y el diseño no define otra cosa).
 */
export function ordenarRoles(roles: readonly Rol[]): Rol[] {
  return [...roles].sort((a, b) => ROLES.indexOf(a) - ROLES.indexOf(b));
}
