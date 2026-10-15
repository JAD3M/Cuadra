import type { Rol } from './tipos';

// Espejo de src/auth/permisos/matriz.ts (backend, FR-53 / AD-11). El frontend
// no importa código del backend: copia los valores y
// tests/dominio/derivaPermisos.test.ts falla si la matriz cambia de permisos,
// de filas, de roles o de orden. El servidor decide; esto solo permite a la
// pantalla (historia 2.2) mostrar u ocultar lo que el servidor ya rechazaría.
// Al cambiar el backend, actualiza este archivo; el orden importa.

export const PERMISOS = [
  'bandeja.ver',
  'cargas.ver',
  'tolerancia.ver',
  'bitacora.ver',
  'usuarios.ver',
  'cargas.cargar',
  'conciliaciones.resolver',
  'movimientos.descartar',
  'movimientos.deshacer_descarte',
  'conciliaciones.comentar',
  'conciliaciones.reabrir',
  'muestra.verificar',
  'tolerancia.editar',
  'usuarios.gestionar',
  'plataforma.administrar',
] as const;
export type Permiso = (typeof PERMISOS)[number];

/** Del dueño de Cuadra: los evalúa la sesión de plataforma, no un rol de empresa. */
export const PERMISOS_DUENO = ['plataforma.administrar'] as const;

/** «Solo lo que hizo»: el rol alcanza, pero la acción verifica la autoría. */
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

/** Roles de empresa que tienen el permiso (vacío para los del dueño). */
export function rolesConPermiso(permiso: Permiso): readonly Rol[] {
  return MATRIZ_PERMISOS[permiso];
}
