import { z } from 'zod';
import { solicitudLoginPlataforma } from '@/shared/api/contratos/plataforma';

/**
 * Esquema del formulario de acceso de plataforma, derivado del contrato
 * `solicitudLoginPlataforma` (no es una segunda definición): cambia solo los
 * mensajes en español y recorta el correo. La contraseña viaja tal cual.
 */
export const esquemaLoginPlataforma = solicitudLoginPlataforma.extend({
  email: z.string().trim().pipe(z.email('Escribe un correo válido')),
  password: z.string().min(1, 'Escribe tu contraseña'),
});

export type ValoresLoginPlataforma = z.infer<typeof esquemaLoginPlataforma>;
