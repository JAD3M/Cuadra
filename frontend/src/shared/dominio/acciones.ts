import type { AccionBitacora } from './tipos';

// Espejo de las acciones de la bitácora que la pantalla del caso nombra
// (src/common/entities/tipos.ts). Ver tipos.ts: `ACCIONES_BITACORA` es la lista
// completa y tests/dominio/deriva.test.ts la compara con el backend.
// `satisfies` hace que tsc falle si el backend renombra una; el código del
// caso las usa por su constante y no las escribe como texto.
export const ACCION_CREAR = 'crear' satisfies AccionBitacora;
export const ACCION_CONFIRMAR = 'confirmar' satisfies AccionBitacora;
export const ACCION_RECHAZAR = 'rechazar' satisfies AccionBitacora;
export const ACCION_ACCESO_DENEGADO =
  'acceso_denegado' satisfies AccionBitacora;

/** Lo que una persona decide sobre una propuesta. */
export const ACCIONES_RESOLUCION = [ACCION_CONFIRMAR, ACCION_RECHAZAR] as const;
export type AccionResolucion = (typeof ACCIONES_RESOLUCION)[number];
