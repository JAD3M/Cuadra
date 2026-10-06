import { type EstadoBandeja } from './bandeja';
import {
  type AccionBitacora,
  type OrigenConciliacion,
  ROLES,
  type Rol,
} from './tipos';

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
 * Texto visible de cada acción de la bitácora en el historial de un caso. Es
 * un `Record<AccionBitacora, string>`: si el backend agrega una acción, esta
 * tabla deja de compilar hasta etiquetarla. Una acción desconocida que llegue
 * en una respuesta se muestra tal cual; esta tabla no la inventa.
 */
export const ETIQUETAS_ACCION_BITACORA: Record<AccionBitacora, string> = {
  crear: 'Propuesta creada',
  actualizar: 'Actualizada',
  eliminar: 'Eliminada',
  cargar: 'Cargada',
  confirmar: 'Confirmada',
  rechazar: 'Rechazada',
  acceso_denegado: 'Acceso denegado',
};

/**
 * Texto visible del origen de una conciliación (chip del encabezado del
 * caso). Compila de forma exhaustiva sobre el espejo.
 */
export const ETIQUETAS_ORIGEN_CONCILIACION: Record<OrigenConciliacion, string> =
  {
    regla: 'origen: regla',
    llm: 'origen: IA',
    manual: 'origen: manual',
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
