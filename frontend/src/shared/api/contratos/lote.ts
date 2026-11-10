import { z } from 'zod';
import {
  RAZONES_OMISION_LOTE,
  RAZONES_OMISION_REAPERTURA,
} from '@/shared/dominio/tipos';

// Contrato de `POST /conciliaciones/lotes` (5.3). Valida solo lo que la
// pantalla usa. `loteId` es null cuando no se confirmó ninguna propuesta.

export const respuestaLote = z.object({
  loteId: z.guid().nullable(),
  confirmadas: z.array(z.guid()),
  omitidas: z.array(
    z.object({ id: z.guid(), razon: z.enum(RAZONES_OMISION_LOTE) }),
  ),
});

export type RespuestaLote = z.infer<typeof respuestaLote>;

// Contrato de `POST /conciliaciones/lotes/:loteId/reabrir` (5.8). Sin nada que
// reabrir sigue siendo 200 con `reabiertas` vacío.

export const respuestaReabrirLote = z.object({
  loteId: z.guid(),
  reabiertas: z.array(z.guid()),
  omitidas: z.array(
    z.object({ id: z.guid(), razon: z.enum(RAZONES_OMISION_REAPERTURA) }),
  ),
});

export type RespuestaReabrirLote = z.infer<typeof respuestaReabrirLote>;
