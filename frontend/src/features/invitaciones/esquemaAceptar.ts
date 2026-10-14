import { z } from 'zod';
import { LARGO_MINIMO_CONTRASENA, TEXTOS_INVITACION } from './textos';

/**
 * Formulario de una cuenta nueva: nombre sin espacios en los bordes y no
 * vacío, contraseña de al menos 12 caracteres tal cual (un espacio puede ser
 * parte de ella). Es comodidad del navegador: el servidor decide.
 */
export const esquemaCuentaNueva = z.object({
  nombre: z.string().trim().min(1, TEXTOS_INVITACION.nombreVacio),
  password: z
    .string()
    .min(LARGO_MINIMO_CONTRASENA, TEXTOS_INVITACION.contrasenaCorta),
});

/**
 * Cuenta existente: el formulario no tiene campos y no valida nada; tiene la
 * misma forma que el de la cuenta nueva solo para compartir el tipo.
 */
export const esquemaCuentaExistente = z.object({
  nombre: z.string(),
  password: z.string(),
});

export type ValoresCuentaNueva = z.infer<typeof esquemaCuentaNueva>;
