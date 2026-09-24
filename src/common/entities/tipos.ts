// src/common/entities/tipos.ts
// Los estados viajan como VARCHAR con CHECK, no como ENUM de Postgres:
// agregar un valor es un ALTER ... DROP/ADD CONSTRAINT reversible dentro de
// una transacción, mientras que ALTER TYPE ... ADD VALUE no se puede revertir.

export const ROLES = ['admin', 'contador', 'revisor'] as const;
export type Rol = (typeof ROLES)[number];

export const TIPOS_CARGA = ['cfdi', 'estado_cuenta'] as const;
export type TipoCarga = (typeof TIPOS_CARGA)[number];

export const ESTADOS_CARGA = [
  'pendiente',
  'procesando',
  'procesada',
  'fallida',
] as const;
export type EstadoCarga = (typeof ESTADOS_CARGA)[number];

export const ESTADOS_CFDI = ['abierta', 'conciliada', 'cancelada'] as const;
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

export const ACCIONES_BITACORA = [
  'crear',
  'actualizar',
  'eliminar',
  'cargar',
  'confirmar',
  'rechazar',
] as const;
export type AccionBitacora = (typeof ACCIONES_BITACORA)[number];

/** `'a' | 'b'` -> `'a', 'b'`, para escribir los CHECK sin repetir literales. */
export function listaSql(valores: readonly string[]): string {
  return valores.map((v) => `'${v}'`).join(', ');
}
