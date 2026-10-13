import type { Redis } from 'ioredis';

/**
 * Ayudas de los specs para el límite de intentos (historia 1.2). Cada spec
 * fija su propio `COLA_PREFIJO`, así que borrar `${prefijo}:rl:*` no toca a
 * otras suites ni a BullMQ.
 */

/** Llaves de límite del prefijo con su valor, para afirmar el contador. */
export async function leerLimites(
  cliente: Redis,
  prefijo: string,
): Promise<Record<string, string>> {
  const resultado: Record<string, string> = {};
  let cursor = '0';
  do {
    const [siguiente, llaves] = await cliente.scan(
      cursor,
      'MATCH',
      `${prefijo}:rl:*`,
      'COUNT',
      100,
    );
    cursor = siguiente;
    for (const llave of llaves) {
      const valor = await cliente.get(llave);
      if (valor !== null) resultado[llave] = valor;
    }
  } while (cursor !== '0');
  return resultado;
}

/** Borra los contadores del prefijo (SCAN + DEL). */
export async function limpiarLimites(
  cliente: Redis,
  prefijo: string,
): Promise<void> {
  const llaves = Object.keys(await leerLimites(cliente, prefijo));
  if (llaves.length > 0) await cliente.del(...llaves);
}
