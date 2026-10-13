import type { Redis } from 'ioredis';

/**
 * Reserva atómica: suma uno y fija la caducidad solo si la llave es nueva (o
 * quedó sin caducidad). Devuelve `[conteo, ms que faltan]`.
 */
const RESERVAR = `
local n = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {n, ttl}
`;

/**
 * Devuelve una reserva. Nunca deja el contador en negativo ni toca la
 * caducidad: sin llave (la ventana ya venció) no hace nada, y al llegar a
 * cero la borra.
 */
const DEVOLVER = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
local n = redis.call('DECR', KEYS[1])
if n <= 0 then redis.call('DEL', KEYS[1]) end
return n
`;

export interface Reserva {
  /** Intentos contados en la ventana, contando este. */
  intentos: number;
  /** Segundos que faltan para que la ventana venza (al menos 1). */
  restanteS: number;
}

export async function reservar(
  cliente: Redis,
  clave: string,
  ventanaS: number,
): Promise<Reserva> {
  const [intentos, restanteMs] = (await cliente.eval(
    RESERVAR,
    1,
    clave,
    String(ventanaS * 1000),
  )) as [number, number];
  return { intentos, restanteS: Math.max(1, Math.ceil(restanteMs / 1000)) };
}

export async function devolver(cliente: Redis, clave: string): Promise<void> {
  await cliente.eval(DEVOLVER, 1, clave);
}

/** Reservas vivas de cada petición: la guarda el guard y la lee el interceptor. */
export const reservasPorSolicitud = new WeakMap<object, string>();
