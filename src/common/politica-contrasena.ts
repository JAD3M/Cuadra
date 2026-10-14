import { BadRequestException } from '@nestjs/common';

/** Política de contraseña v1 (historias 1.5 y 1.6): un solo lugar. */
export const LARGO_MINIMO_PASSWORD = 12;
export const LARGO_MAXIMO_PASSWORD = 256;

/**
 * Mensaje de error en español si la contraseña no cumple la política, o
 * `null` si es válida. Lo ausente (no es cadena o está vacío) cuenta como
 * demasiado corto.
 */
export function mensajePasswordInvalida(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < LARGO_MINIMO_PASSWORD) {
    return `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`;
  }
  if (password.length > LARGO_MAXIMO_PASSWORD) {
    return `La contraseña no puede tener más de ${LARGO_MAXIMO_PASSWORD} caracteres.`;
  }
  return null;
}

/** Lanza 400 con el mensaje de la política; devuelve la contraseña validada. */
export function exigirPasswordValida(password: unknown): string {
  const mensaje = mensajePasswordInvalida(password);
  if (mensaje) throw new BadRequestException(mensaje);
  return password as string;
}
