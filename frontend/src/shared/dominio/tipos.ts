// Espejo de src/common/entities/tipos.ts (backend). El frontend no importa
// código del backend: copia los valores y tests/dominio/deriva.test.ts falla
// si alguna lista cambia de valores, de orden o si el backend agrega una.
// Al cambiar el backend, actualiza este archivo; el orden importa.

export const ROLES = ['admin', 'contador', 'revisor', 'auditor'] as const;
export type Rol = (typeof ROLES)[number];

export const TIPOS_CARGA = ['cfdi', 'estado_cuenta'] as const;
export type TipoCarga = (typeof TIPOS_CARGA)[number];

export const ESTADOS_CARGA = [
  'pendiente',
  'procesando',
  'procesada',
  'con_errores',
  'fallida',
  'pendiente_vista_previa',
  'rechazada',
] as const;
export type EstadoCarga = (typeof ESTADOS_CARGA)[number];

export const ESTADOS_CFDI = [
  'abierta',
  'parcialidades',
  'conciliada',
  'cancelada',
] as const;
export type EstadoCfdi = (typeof ESTADOS_CFDI)[number];

/** c_TipoDeComprobante del SAT: Ingreso, Egreso, Traslado, Nómina, Pago. */
export const TIPOS_COMPROBANTE = ['I', 'E', 'T', 'N', 'P'] as const;
export type TipoComprobante = (typeof TIPOS_COMPROBANTE)[number];

export const ESTADOS_MOVIMIENTO = [
  'abierto',
  'conciliado',
  'descartado',
  'pendiente_revision',
] as const;
export type EstadoMovimiento = (typeof ESTADOS_MOVIMIENTO)[number];

export const ESTADOS_CONCILIACION = [
  'propuesta',
  'confirmada',
  'rechazada',
] as const;
export type EstadoConciliacion = (typeof ESTADOS_CONCILIACION)[number];

export const ORIGENES_CONCILIACION = ['regla', 'llm', 'manual'] as const;
export type OrigenConciliacion = (typeof ORIGENES_CONCILIACION)[number];

export const REGLAS_SIN_MATCH = [
  'referencia_ambigua',
  'referencia_cfdi_ocupado',
  'referencia_cfdi_no_compatible',
  'sin_candidato_monto',
  'monto_multiples_candidatos',
  'monto_candidato_ocupado',
  'cfdi_multiples_movimientos',
] as const;
export type ReglaSinMatch = (typeof REGLAS_SIN_MATCH)[number];

export const REGLA_LLM_SUGERENCIA = 'llm_sugerencia';

export const RESULTADOS_SUGERENCIA = ['propuesta', 'sin_sugerencia'] as const;
export type ResultadoSugerencia = (typeof RESULTADOS_SUGERENCIA)[number];

export const ACCIONES_BITACORA = [
  'crear',
  'actualizar',
  'eliminar',
  'cargar',
  'confirmar',
  'rechazar',
  'acceso_denegado',
  'invitar',
  'reenviar_invitacion',
  'cancelar_invitacion',
  'cambiar_rol',
  'quitar_rol',
] as const;
export type AccionBitacora = (typeof ACCIONES_BITACORA)[number];

export const ENTIDADES_BITACORA = [
  'conciliaciones',
  'companies',
  'cargas',
] as const;
export type EntidadBitacora = (typeof ENTIDADES_BITACORA)[number];

export const ACCIONES_BITACORA_PLATAFORMA = [
  'acceso_denegado',
  'iniciar_sesion_plataforma',
  'cerrar_sesion_plataforma',
  'crear_empresa',
  'invitar',
  'restablecer_contrasena',
] as const;
export type AccionBitacoraPlataforma =
  (typeof ACCIONES_BITACORA_PLATAFORMA)[number];
