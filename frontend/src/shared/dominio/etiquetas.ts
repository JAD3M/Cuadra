import { type EstadoBandeja } from './bandeja';
import {
  type AccionBitacora,
  type EstadoCarga,
  type TipoCarga,
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
  auditor: 'Auditor',
};

/**
 * Qué puede hacer cada rol, en una frase (mockup `Usuarios.dc.html`, lista de
 * roles del formulario de invitar). Es un `Record<Rol, string>`: si el backend
 * agrega un rol, esta tabla deja de compilar hasta describirlo. Es texto de
 * ayuda: lo que cada rol puede hacer lo decide la matriz del servidor.
 */
export const DESCRIPCIONES_ROL: Record<Rol, string> = {
  admin: 'Todo: cargas, confirmar y rechazar, tolerancia, bitácora y usuarios.',
  contador:
    'Sube cargas, confirma y rechaza casos; ve la tolerancia sin cambiarla.',
  revisor: 'Confirma y rechaza casos y consulta la bitácora; no sube cargas.',
  auditor: 'Solo lectura de la bandeja y la bitácora.',
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
 * Texto visible de cada acción de la bitácora en el historial de un caso
 * (maqueta Detalle.dc.html). `crear` es la propuesta del motor: el historial
 * le agrega la etiqueta del CFDI. Es
 * un `Record<AccionBitacora, string>`: si el backend agrega una acción, esta
 * tabla deja de compilar hasta etiquetarla. Una acción desconocida que llegue
 * en una respuesta se muestra tal cual; esta tabla no la inventa.
 */
export const ETIQUETAS_ACCION_BITACORA: Record<AccionBitacora, string> = {
  crear: 'El motor propuso el CFDI',
  actualizar: 'Actualizada',
  eliminar: 'Eliminada',
  cargar: 'Cargada',
  confirmar: 'Confirmada',
  rechazar: 'Rechazada',
  acceso_denegado: 'Acceso denegado',
  invitar: 'Invitación enviada',
  reenviar_invitacion: 'Invitación reenviada',
  cancelar_invitacion: 'Invitación cancelada',
  cambiar_rol: 'Rol cambiado',
  quitar_rol: 'Rol quitado',
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
 * Texto visible de cada estado de una carga (K1: cinco estados, los del
 * backend). Compila de forma exhaustiva sobre el espejo.
 */
export const ETIQUETAS_ESTADO_CARGA: Record<EstadoCarga, string> = {
  pendiente: 'Pendiente',
  procesando: 'Procesando',
  procesada: 'Procesada',
  con_errores: 'Con errores',
  fallida: 'Fallida',
};

/** Texto visible de cada tipo de carga (maqueta Cargas.dc.html). */
export const ETIQUETAS_TIPO_CARGA: Record<TipoCarga, string> = {
  cfdi: 'CFDI',
  estado_cuenta: 'Estado de cuenta',
};

/**
 * Ordena los roles como en `ROLES` (admin, contador, revisor, auditor) sin importar el
 * orden de entrada. No modifica el arreglo recibido. No deduplica: la
 * multiplicidad de la entrada se conserva (el contrato del backend no repite
 * roles y el diseño no define otra cosa).
 */
export function ordenarRoles(roles: readonly Rol[]): Rol[] {
  return [...roles].sort((a, b) => ROLES.indexOf(a) - ROLES.indexOf(b));
}
