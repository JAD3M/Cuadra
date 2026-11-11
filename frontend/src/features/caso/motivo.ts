import { MOTIVO_MAXIMO } from '@/shared/dominio';

/** Largo máximo de un comentario (5.9); el servidor recorta y lo vuelve a validar. */
export const COMENTARIO_MAXIMO = 1000;

// Reglas del motivo del rechazo. El backend cuenta puntos de código (un emoji
// vale uno), por eso aquí también: contar `length` (unidades UTF-16) rechazaría
// textos que el servidor acepta. Todo es entero: nada de proporciones.

/** Puntos de código del texto tal cual lo escribió la persona (B8). */
export function contarCaracteres(texto: string): number {
  return Array.from(texto).length;
}

/**
 * Valida con el texto recortado, como el servidor: los espacios de las orillas
 * no cuentan. El contador, en cambio, muestra el largo bruto.
 */
export function excedeLimite(
  texto: string,
  maximo: number = MOTIVO_MAXIMO,
): boolean {
  return contarCaracteres(texto.trim()) > maximo;
}

/** El texto recortado para enviar, o `undefined` si no quedó nada. */
export function motivoParaEnvio(texto: string): string | undefined {
  const recortado = texto.trim();
  return recortado === '' ? undefined : recortado;
}
