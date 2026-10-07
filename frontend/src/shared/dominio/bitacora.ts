// Espejo de los motivos que el backend guarda en `datos.motivo` de un evento
// `acceso_denegado` (src/bitacora/accesos-denegados.ts). El frontend no importa
// código del backend: copia los valores y tests/dominio/bitacoraEspejo.test.ts
// falla si el código de allá cambia. Al cambiar el backend, actualiza este
// archivo.

/** Tenía membresía y rol, pero ninguno de los que exigía el endpoint. */
export const MOTIVO_ROL_INSUFICIENTE = 'rol_insuficiente';

/** Ya no es miembro de la empresa (sin roles en ella). */
export const MOTIVO_SIN_MEMBRESIA = 'sin_membresia';
