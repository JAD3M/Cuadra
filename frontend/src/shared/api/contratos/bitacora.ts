import { z } from 'zod';
import { ACCIONES_BITACORA, LIMITE_MAXIMO } from '@/shared/dominio';

// Contratos de `GET /bitacora` y `GET /bitacora/usuarios` (CU-26). Se derivan
// de src/bitacora/dto/bitacora.dto.ts, pero validan SOLO lo que la pantalla
// usa: un campo que nadie lee no debe poder romper toda la bitácora con un
// `ContratoError`. Por eso `ip`, `userAgent` y el correo del usuario NO se
// declaran: zod los descarta al parsear y nunca llegan a la pantalla (D8).
// Los conteos son enteros y ningún valor pasa por `number` fuera de ellos: los
// montos viven dentro de `datos` como cadenas decimales y los interpreta
// `detalleEvento`, no este contrato.

/**
 * Un evento de la bitácora. La acción se valida contra el espejo (el servidor
 * la restringe con un CHECK): una desconocida falla en la frontera. `datos` es
 * un objeto de valores sin tipar o `null`; toda su forma se revisa en
 * `detalleEvento`, que nunca lanza.
 */
export const eventoBitacora = z.object({
  id: z.guid(),
  entidad: z.string().min(1),
  entidadId: z.guid(),
  accion: z.enum(ACCIONES_BITACORA),
  datos: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.iso.datetime(),
  /** `null` cuando el actor fue el sistema o el usuario ya no existe. */
  usuario: z.object({ nombre: z.string().min(1) }).nullable(),
});

export const respuestaListadoBitacora = z.object({
  datos: z.array(eventoBitacora),
  pagina: z.int().min(1),
  limite: z.int().min(1).max(LIMITE_MAXIMO),
  total: z.int().min(0),
});

/** Las personas del filtro de usuario: sin correo, solo id y nombre. */
export const usuarioBitacora = z.object({
  id: z.guid(),
  nombre: z.string().min(1),
});

export const respuestaUsuariosBitacora = z.object({
  datos: z.array(usuarioBitacora),
});

export type EventoBitacora = z.infer<typeof eventoBitacora>;
export type RespuestaListadoBitacora = z.infer<typeof respuestaListadoBitacora>;
export type UsuarioBitacora = z.infer<typeof usuarioBitacora>;
export type RespuestaUsuariosBitacora = z.infer<
  typeof respuestaUsuariosBitacora
>;
