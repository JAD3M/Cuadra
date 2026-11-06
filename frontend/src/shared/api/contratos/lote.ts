import { z } from 'zod';
import { RAZONES_OMISION_LOTE } from '@/shared/dominio/tipos';

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
