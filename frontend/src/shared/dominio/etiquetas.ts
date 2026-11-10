import { type EstadoBandeja } from './bandeja';
import {
  type AccionBitacora,
  type EstadoCarga,
  type TipoCarga,
  type MotivoBloqueo,
  type MotivoRevision,
  type OrigenConciliacion,
  type RazonOmisionLote,
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
 * Marca de presentación, no un estado de dominio: una decisión confirmada cuya
 * factura se canceló después (`requiereRevision` del backend). Se pinta con el
 * tono ámbar de `sin_match` y el texto lleva el significado.
 */
export const ETIQUETA_REQUIERE_REVISION = 'Requiere revisión';

/**
 * Por qué la decisión pide revisión (5.1). El servidor manda el código y solo
 * si la factura está cancelada; el texto vive aquí.
 */
export const ROTULO_MOTIVO_REVISION = 'Motivo:';
export const ETIQUETAS_MOTIVO_REVISION: Record<MotivoRevision, string> = {
  cfdi_cancelado: 'la factura se canceló',
};
export const GLIFO_REQUIERE_REVISION = '⚠';

/**
 * Por qué ESTA persona no puede confirmar una propuesta (5.3). El servidor
 * manda el código; el texto vive aquí.
 */
export const ETIQUETAS_MOTIVO_BLOQUEO: Record<MotivoBloqueo, string> = {
  separacion_de_funciones:
    'No puedes confirmarla: subiste su CFDI o su estado de cuenta. Debe confirmarla otra persona.',
};

/**
 * Por qué una propuesta marcada en un lote se dejó fuera (5.3). Un
 * `Record<RazonOmisionLote, string>`: si el backend agrega una razón, esta
 * tabla deja de compilar hasta explicarla.
 */
export const ETIQUETAS_RAZON_OMISION_LOTE: Record<RazonOmisionLote, string> = {
  no_existe: 'Ya no existe.',
  ya_resuelta: 'Otra persona ya la resolvió.',
  cfdi_no_abierto: 'Su factura ya no está abierta.',
  movimiento_no_abierto: 'Su movimiento ya no está abierto.',
  separacion_de_funciones:
    'Subiste su CFDI o su estado de cuenta: debe confirmarla otra persona.',
  choca_con_otra_del_lote:
    'Choca con otra marcada (misma factura o mismo movimiento): confírmala a mano.',
  cambio_concurrente: 'Cambió mientras se confirmaba: revísala de nuevo.',
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
  desactivar_separacion: 'Separación de funciones cambiada',
  descartar: 'Movimiento descartado',
  deshacer_descarte: 'Descarte deshecho',
  reabrir: 'Confirmación reabierta',
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
 * Texto visible de cada estado de una carga (K1: los estados del
 * backend). Compila de forma exhaustiva sobre el espejo.
 */
export const ETIQUETAS_ESTADO_CARGA: Record<EstadoCarga, string> = {
  pendiente: 'Pendiente',
  procesando: 'Procesando',
  procesada: 'Procesada',
  con_errores: 'Con filas rechazadas',
  fallida: 'Fallida',
  pendiente_vista_previa: 'Pendiente de vista previa',
  rechazada: 'Rechazada',
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
