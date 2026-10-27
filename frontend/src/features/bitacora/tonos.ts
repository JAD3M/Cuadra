import type { AccionBitacora } from '@/shared/dominio';

/**
 * Tono del chip de cada acción (Bitacora.dc.html): confirmar como conciliado,
 * rechazar como sin match, cargar como sugerencia, actualizar con el violeta
 * de la IA, crear y eliminar neutros y el acceso denegado en peligro, con su
 * fondo propio (`--color-danger-chip`). El chip siempre lleva el nombre de la
 * acción: el color nunca es el único canal.
 */
export type TonoAccion =
  'conciliado' | 'sin_match' | 'sugerencia' | 'ia' | 'neutral' | 'denegado';

export const TONOS_ACCION: Readonly<Record<AccionBitacora, TonoAccion>> = {
  crear: 'neutral',
  actualizar: 'ia',
  eliminar: 'neutral',
  cargar: 'sugerencia',
  confirmar: 'conciliado',
  rechazar: 'sin_match',
  acceso_denegado: 'denegado',
  invitar: 'neutral',
  reenviar_invitacion: 'neutral',
  cancelar_invitacion: 'neutral',
  cambiar_rol: 'neutral',
  quitar_rol: 'neutral',
};
