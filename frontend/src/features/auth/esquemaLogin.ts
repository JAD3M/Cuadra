import { z } from 'zod';
import { solicitudLogin } from '@/shared/api/contratos';

/**
 * Esquema del formulario de acceso. Se deriva del contrato `solicitudLogin`
 * (no es una segunda definición): conserva sus claves y cambia solo lo que el
 * formulario necesita, que son los mensajes en español y recortar el correo
 * (pegar un correo con espacios al final no debe fallar). La contraseña viaja
 * tal cual, sin recortar: un espacio puede ser parte de ella.
 *
 * Vive fuera de `components/` porque importa el contrato, y los componentes
 * de presentación no importan `@/shared/api`.
 */
export const esquemaLogin = solicitudLogin.extend({
  email: z.string().trim().pipe(z.email('Escribe un correo válido')),
  password: z.string().min(1, 'Escribe tu contraseña'),
});

export type ValoresLogin = z.infer<typeof esquemaLogin>;
