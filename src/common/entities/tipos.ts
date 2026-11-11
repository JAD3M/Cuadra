// src/common/entities/tipos.ts
// Los estados viajan como VARCHAR con CHECK, no como ENUM de Postgres:
// agregar un valor es un ALTER ... DROP/ADD CONSTRAINT reversible dentro de
// una transacción, mientras que ALTER TYPE ... ADD VALUE no se puede revertir.

/** `auditor` (v2, FR-54) solo consulta: la matriz de permisos vive en src/auth/permisos. */
export const ROLES = ['admin', 'contador', 'revisor', 'auditor'] as const;
export type Rol = (typeof ROLES)[number];

export const TIPOS_CARGA = ['cfdi', 'estado_cuenta'] as const;
export type TipoCarga = (typeof TIPOS_CARGA)[number];

/**
 * CU-08. 'con_errores': terminó con al menos un XML inválido. 'fallida': el
 * sistema agotó los reintentos (infraestructura), nunca por los XML.
 * Historia 3.3. 'pendiente_vista_previa': el PDF cuadró y sus movimientos
 * esperan la vista previa. Es un estado concluido para el polling y el worker
 * no lo toma.
 * Historia 3.4. 'rechazada': la persona descartó la vista previa; sus
 * movimientos en espera se borraron y nada entró a conciliación.
 */
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
  'pendiente_revision',
] as const;
export type EstadoMovimiento = (typeof ESTADOS_MOVIMIENTO)[number];

export const ESTADOS_CONCILIACION = [
  'propuesta',
  'confirmada',
  'rechazada',
] as const;
export type EstadoConciliacion = (typeof ESTADOS_CONCILIACION)[number];

/** Ciclo de vida cerrado de una decisión (AD-4). */
export const ESTADOS_DECISION = [
  'propuesta',
  'confirmada',
  'rechazada',
  'reabierta',
  'descartada',
  'obsoleta',
] as const;
export type EstadoDecision = (typeof ESTADOS_DECISION)[number];

export const TIPOS_DECISION = ['conciliacion', 'descarte'] as const;
export type TipoDecision = (typeof TIPOS_DECISION)[number];

/**
 * Quién propuso el cruce. El motor de reglas y el LLM solo llegan a
 * 'propuesta'; cerrar un caso siempre lo hace una persona.
 */
export const ORIGENES_CONCILIACION = ['regla', 'llm', 'manual'] as const;
export type OrigenConciliacion = (typeof ORIGENES_CONCILIACION)[number];

/**
 * Qué anota `evidencia_sombra` (AD-10, solo agregar). La historia 6.1 solo
 * escribe 'habria_cerrado': una propuesta de la regla 1 exacta que Cuadra
 * habría cerrado sola. 'confirmo', 'rechazo', 'desmarco' y 'reabrio' los suma
 * la 6.2 junto con el CHECK de la tabla.
 */
export const EVENTOS_SOMBRA = ['habria_cerrado'] as const;
export type EventoSombra = (typeof EVENTOS_SOMBRA)[number];

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
  'moneda_no_soportada',
  'combinaciones_multiples',
  'candidatos_excedidos',
] as const;
export type ReglaSinMatch = (typeof REGLAS_SIN_MATCH)[number];

/**
 * Por qué una decisión confirmada quedó por revisar (5.1). Códigos estables:
 * se muestran tal cual y nunca se renombran. Hoy solo hay una causa; la
 * bandeja lo deduce de la factura, no de una columna.
 */
export const MOTIVOS_REVISION = ['cfdi_cancelado'] as const;
export type MotivoRevision = (typeof MOTIVOS_REVISION)[number];

/**
 * Por qué la persona que consulta no puede confirmar una propuesta de la
 * bandeja (5.3). Códigos estables. Hoy solo la separación de funciones (D-08):
 * quien subió el CFDI o el estado de cuenta no confirma su propio trabajo.
 */
export const MOTIVOS_BLOQUEO = ['separacion_de_funciones'] as const;
export type MotivoBloqueo = (typeof MOTIVOS_BLOQUEO)[number];

/**
 * Por qué una propuesta marcada en un lote se deja fuera (5.3). Códigos
 * estables; el texto lo pone la interfaz.
 */
export const RAZONES_OMISION_LOTE = [
  'no_existe',
  'ya_resuelta',
  'cfdi_no_abierto',
  'movimiento_no_abierto',
  'separacion_de_funciones',
  'choca_con_otra_del_lote',
  'cambio_concurrente',
] as const;
export type RazonOmisionLote = (typeof RAZONES_OMISION_LOTE)[number];

/**
 * Por qué un caso de un lote se deja fuera al reabrir el lote (5.8). Códigos
 * estables; el texto lo pone la interfaz.
 */
export const RAZONES_OMISION_REAPERTURA = [
  'ya_reabierta',
  'reconfirmada',
  'no_confirmada',
] as const;
export type RazonOmisionReapertura =
  (typeof RAZONES_OMISION_REAPERTURA)[number];

/**
 * Nivel de confianza de una propuesta del motor de reglas (CU-11, AC6).
 * Se deriva de la puntuación de su regla con `nivelDeConfianza`; nunca se
 * guarda ni se inventa fuera de ahí.
 */
export const NIVELES_CONFIANZA = ['alta', 'media', 'baja'] as const;
export type NivelConfianza = (typeof NIVELES_CONFIANZA)[number];

/** CU-17. `regla` de la conciliación que propone el modelo. */
export const REGLA_LLM_SUGERENCIA = 'llm_sugerencia';

/** CU-17. Qué salió de preguntarle al modelo por un movimiento. */
export const RESULTADOS_SUGERENCIA = ['propuesta', 'sin_sugerencia'] as const;
export type ResultadoSugerencia = (typeof RESULTADOS_SUGERENCIA)[number];

/**
 * 'acceso_denegado' (CU-03.3): un 403 por rol o por membresía. `entidad` es
 * 'companies' y `entidad_id` la empresa a la que se intentó entrar.
 * 'invitar' (historias 1.5 y 2.3): alguien invitó a una persona a la empresa.
 * `entidad` es 'companies'. Si invitó el dueño de la plataforma, `user_id`
 * queda nulo y el dueño va en `datos`; si invitó una persona administradora de
 * la empresa, `user_id` es esa persona y `datos` trae el correo y los roles.
 * 'reenviar_invitacion' y 'cancelar_invitacion' (historia 2.4): una persona
 * administradora reenvió o canceló una invitación pendiente. Misma forma que
 * 'invitar': `entidad` 'companies', `user_id` quien actuó y `datos` con
 * `invitacionId`, el correo y los roles.
 * 'cambiar_rol' y 'quitar_rol' (historia 2.6): una persona administradora
 * reemplazó los roles de alguien de su equipo o le quitó el acceso a la
 * empresa. `entidad` es 'companies', `user_id` quien actuó y `datos` trae
 * `usuarioId`, el correo y los roles: `antes` y `despues` en 'cambiar_rol',
 * `roles` (los quitados) en 'quitar_rol'.
 */
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
  'desactivar_separacion',
  'descartar',
  'deshacer_descarte',
  'reabrir',
  'comentar',
] as const;
export type AccionBitacora = (typeof ACCIONES_BITACORA)[number];

/**
 * Entidades que la aplicación escribe hoy en la bitácora: 'decisiones' (desde
 * la historia 4.2: crear, confirmar y rechazar), 'conciliaciones' (solo
 * historial de la v1, ya no se escribe) y 'companies' (actualizar la tolerancia y
 * acceso_denegado) y 'cargas' (cargar, historia 3.1: una entrada por carga
 * terminada, con `entidad_id` = la carga) y 'cfdi' (actualizar, historia 4.6: la
 * cancelación de una factura). Es la lista para la interfaz y la documentación; GET
 * /bitacora sigue aceptando cualquier `entidad` de hasta 64 caracteres.
 */
export const ENTIDADES_BITACORA = [
  'conciliaciones',
  'decisiones',
  'companies',
  'cargas',
  'cfdi',
] as const;
export type EntidadBitacora = (typeof ENTIDADES_BITACORA)[number];

/**
 * AD-7. Acciones de `bitacora_plataforma` (clase 3, solo el dueño de Cuadra).
 * Namespace aparte de `ACCIONES_BITACORA`, que es la de cada empresa. Un
 * valor nuevo exige migración del CHECK `ck_bitacora_plataforma_accion`.
 */
export const ACCIONES_BITACORA_PLATAFORMA = [
  'acceso_denegado',
  'iniciar_sesion_plataforma',
  'cerrar_sesion_plataforma',
  'crear_empresa',
  'invitar',
  'restablecer_contrasena',
  'levantar_vista_previa',
  'desactivar_separacion',
] as const;
export type AccionBitacoraPlataforma =
  (typeof ACCIONES_BITACORA_PLATAFORMA)[number];

/** `'a' | 'b'` -> `'a', 'b'`, para escribir los CHECK sin repetir literales. */
export function listaSql(valores: readonly string[]): string {
  return valores.map((v) => `'${v}'`).join(', ');
}
