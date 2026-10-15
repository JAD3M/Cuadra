import type { Rol } from '../../common/entities/tipos';

/**
 * FR-53 / AD-11. La única matriz de permisos: qué rol de empresa puede cada
 * cosa. Se evalúa en el servidor (`RolesGuard`); el frontend solo tiene un
 * espejo (frontend/src/shared/dominio/permisos.ts) y una prueba de deriva.
 *
 * Nombres: `seccion.accion`. Las filas de acciones que todavía no tienen
 * endpoint (descartar, reabrir, verificar la muestra, comentar) ya están: la
 * historia que las construya solo las usa.
 */
export const PERMISOS = [
  // Secciones.
  'bandeja.ver',
  'cargas.ver',
  'tolerancia.ver',
  'bitacora.ver',
  'usuarios.ver',
  // Acciones.
  'cargas.cargar',
  'conciliaciones.resolver',
  'movimientos.descartar',
  'movimientos.deshacer_descarte',
  'conciliaciones.comentar',
  'conciliaciones.reabrir',
  'muestra.verificar',
  'tolerancia.editar',
  'usuarios.gestionar',
  // Dueño de Cuadra (no es rol de empresa).
  'plataforma.administrar',
] as const;
export type Permiso = (typeof PERMISOS)[number];

/**
 * Permisos del dueño: los evalúa la sesión `plataforma` (AD-5), no
 * `RolesGuard`. Se declaran aquí para que la matriz sea una sola.
 */
export const PERMISOS_DUENO = ['plataforma.administrar'] as const;

/** Permisos que se pueden declarar con `@Permiso` en un endpoint de empresa. */
export type PermisoEmpresa = Exclude<Permiso, (typeof PERMISOS_DUENO)[number]>;

/**
 * Acciones que contador y revisor solo ejercen sobre lo que ellos mismos
 * hicieron («solo lo que descartó / confirmó»). El guard solo comprueba el
 * rol; la historia que construya la acción verifica la autoría.
 *
 * `muestra.verificar` también queda condicionada (admin solo si no hay
 * revisor, [SUPUESTO] del PRD) y lo verifica la historia que la construya.
 */
export const PERMISOS_PROPIOS = [
  'movimientos.deshacer_descarte',
  'conciliaciones.reabrir',
] as const;

export const MATRIZ_PERMISOS: Record<Permiso, readonly Rol[]> = {
  'bandeja.ver': ['admin', 'contador', 'revisor', 'auditor'],
  'cargas.ver': ['admin', 'contador'],
  'tolerancia.ver': ['admin', 'contador'],
  'bitacora.ver': ['admin', 'contador', 'revisor', 'auditor'],
  'usuarios.ver': ['admin'],
  'cargas.cargar': ['admin', 'contador'],
  'conciliaciones.resolver': ['admin', 'contador', 'revisor'],
  'movimientos.descartar': ['admin', 'contador', 'revisor'],
  'movimientos.deshacer_descarte': ['admin', 'contador', 'revisor'],
  'conciliaciones.comentar': ['admin', 'contador', 'revisor'],
  'conciliaciones.reabrir': ['admin', 'contador', 'revisor'],
  'muestra.verificar': ['admin', 'revisor'],
  'tolerancia.editar': ['admin'],
  'usuarios.gestionar': ['admin'],
  'plataforma.administrar': [],
};

export function rolesConPermiso(permiso: Permiso): readonly Rol[] {
  return MATRIZ_PERMISOS[permiso];
}
