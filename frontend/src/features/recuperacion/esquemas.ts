import { z } from 'zod';
import { LARGO_MINIMO_CONTRASENA, TEXTOS_RECUPERACION } from './textos';

/**
 * Formulario de pedir el enlace: correo recortado (pegarlo con espacios no
 * debe fallar) y con forma de correo. Es comodidad del navegador: el
 * servidor decide y responde igual exista o no la cuenta.
 */
export const esquemaSolicitar = z.object({
  email: z.string().trim().pipe(z.email(TEXTOS_RECUPERACION.correoInvalido)),
});

/**
 * Formulario de la contraseña nueva: al menos 12 caracteres tal cual (un
 * espacio puede ser parte de ella). Comodidad del navegador.
 */
export const esquemaRestablecer = z.object({
  password: z
    .string()
    .min(LARGO_MINIMO_CONTRASENA, TEXTOS_RECUPERACION.contrasenaCorta),
});

export type ValoresSolicitar = z.infer<typeof esquemaSolicitar>;
export type ValoresRestablecer = z.infer<typeof esquemaRestablecer>;
