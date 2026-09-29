// src/common/entities/tipos.ts
// Los estados viajan como VARCHAR con CHECK, no como ENUM de Postgres:
// agregar un valor es un ALTER ... DROP/ADD CONSTRAINT reversible dentro de
// una transacción, mientras que ALTER TYPE ... ADD VALUE no se puede revertir.

export const ROLES = ['admin', 'contador', 'revisor'] as const;
export type Rol = (typeof ROLES)[number];

export const TIPOS_CARGA = ['cfdi', 'estado_cuenta'] as const;
export type TipoCarga = (typeof TIPOS_CARGA)[number];

/**
 * CU-08. 'con_errores': terminó con al menos un XML inválido. 'fallida': el
 * sistema agotó los reintentos (infraestructura), nunca por los XML.
 */
export const ESTADOS_CARGA = [
  'pendiente',
  'procesando',
  'procesada',
  'con_errores',
  'fallida',
] as const;
export type EstadoCarga = (typeof ESTADOS_CARGA)[number];

/**
 * 'parcialidades': PPD recién leído (CU-05). Se paga en partes y exige
 * complementos de pago, así que no se concilia igual que una PUE 'abierta'.
 */
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
] as const;
export type EstadoMovimiento = (typeof ESTADOS_MOVIMIENTO)[number];

export const ESTADOS_CONCILIACION = [
  'propuesta',
  'confirmada',
  'rechazada',
] as const;
export type EstadoConciliacion = (typeof ESTADOS_CONCILIACION)[number];

/**
 * Quién propuso el cruce. El motor de reglas y el LLM solo llegan a
 * 'propuesta'; cerrar un caso siempre lo hace una persona.
 */
export const ORIGENES_CONCILIACION = ['regla', 'llm', 'manual'] as const;
export type OrigenConciliacion = (typeof ORIGENES_CONCILIACION)[number];

/**
 * Por qué un movimiento abierto no recibió propuesta (CU-13). Son códigos
 * estables: se guardan tal cual y nunca se renombran. Namespace aparte de
 * `ReglaConciliacion`, que nombra la regla de una propuesta.
 */
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

/**
 * 'acceso_denegado' (CU-03.3): un 403 por rol o por membresía. `entidad` es
 * 'companies' y `entidad_id` la empresa a la que se intentó entrar.
 */
export const ACCIONES_BITACORA = [
  'crear',
  'actualizar',
  'eliminar',
  'cargar',
  'confirmar',
  'rechazar',
  'acceso_denegado',
] as const;
export type AccionBitacora = (typeof ACCIONES_BITACORA)[number];

/** `'a' | 'b'` -> `'a', 'b'`, para escribir los CHECK sin repetir literales. */
export function listaSql(valores: readonly string[]): string {
  return valores.map((v) => `'${v}'`).join(', ');
}
