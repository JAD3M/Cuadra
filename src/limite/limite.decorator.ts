import { SetMetadata } from '@nestjs/common';

/** Llave de los metadatos que lee `LimiteGuard` con `Reflector`. */
export const LLAVE_LIMITE = 'cuadra:limite';

export interface OpcionesLimite {
  /** Intentos fallidos permitidos dentro de la ventana. */
  intentos: number;
  /** Duración de la ventana, en segundos. */
  ventanaS: number;
  /**
   * Cuenta también las respuestas 2xx: con `true` el intento reservado no se
   * devuelve al terminar bien, así que cada envío exitoso consume el tope. Es
   * para rutas que producen un efecto externo (invitar manda un correo) y no
   * deben dispararse sin fin. Por defecto, `false`: solo cuentan los fallos.
   */
  contarExitos?: boolean;
}

/**
 * Límite de intentos fallidos por IP (AD-15, historia 1.2). Se declara en la
 * ruta o en el controlador y no necesita más código:
 *
 * ```ts
 * @Post('recuperar')
 * @Publico()
 * @Limite({ intentos: 5, ventanaS: 60 })
 * recuperar(@Body() dto: RecuperarDto) { ... }
 * ```
 *
 * - Cuenta los intentos que no terminan en 2xx (401, 400, 403...). Uno
 *   correcto no consume: se reserva antes del handler y se devuelve al
 *   terminar bien, así que adivinar en paralelo no esquiva el tope.
 * - Con `contarExitos: true` el intento tampoco se devuelve en un 2xx: la
 *   ruta cuenta cada petición, buena o mala.
 * - Con el tope superado responde 429 con `Retry-After`; con Redis caído
 *   responde 503 (falla cerrada).
 * - Cada ruta lleva su contador: la clave usa controlador y handler, no la
 *   URL, para que un id en la ruta no cree llaves sin fin.
 * - El guard y el interceptor son globales y los registra `AuthModule` con
 *   `PROVEEDORES_LIMITE`, antes de `SesionCookieGuard`; por eso corren
 *   también en rutas `@Publico()`.
 */
export function Limite(
  opciones: OpcionesLimite,
): MethodDecorator & ClassDecorator {
  if (!Number.isInteger(opciones.intentos) || opciones.intentos < 1) {
    throw new Error('@Limite: "intentos" debe ser un entero mayor que cero');
  }
  if (!Number.isInteger(opciones.ventanaS) || opciones.ventanaS < 1) {
    throw new Error('@Limite: "ventanaS" debe ser un entero mayor que cero');
  }
  return SetMetadata(LLAVE_LIMITE, opciones);
}
