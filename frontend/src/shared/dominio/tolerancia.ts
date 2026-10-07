import type { AccionBitacora, EntidadBitacora, Rol } from './tipos';

// Espejo de lo que el backend define para la tolerancia de monto fuera de
// src/common/entities/tipos.ts (CU-25). El frontend no importa código del
// backend: copia los valores y tests/dominio/toleranciaEspejo.test.ts falla si
// el código de allá cambia. Al cambiar el backend, actualiza este archivo.

/** src/companies/dto/tolerancia.dto.ts: tope de la tolerancia (MXN), como texto. */
export const TOLERANCIA_MAXIMA = '100';

/** Decimales que admite el servidor (NUMERIC(18,4)). */
export const DECIMALES_TOLERANCIA = 4;

/** El regex exacto del DTO: sin signo, punto decimal, hasta 4 decimales. */
export const PATRON_TOLERANCIA = /^\d+(\.\d{1,4})?$/;

/** Roles que cambian la tolerancia: el `@Roles` del PUT /empresa/tolerancia. */
export const ROLES_QUE_EDITAN_TOLERANCIA = [
  'admin',
] as const satisfies readonly Rol[];

/** Lo que audita src/companies/tolerancia.service.ts en la bitácora. */
export const ENTIDAD_EMPRESA = 'companies' as const satisfies EntidadBitacora;
export const ACCION_ACTUALIZAR = 'actualizar' as const satisfies AccionBitacora;
export const CAMPO_TOLERANCIA = 'tolerancia_monto';
