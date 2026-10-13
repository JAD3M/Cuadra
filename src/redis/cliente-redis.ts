import { Logger } from '@nestjs/common';
import { Redis, type RedisOptions } from 'ioredis';

/** Token del cliente ioredis compartido (contadores, límites de la historia 1.2). */
export const CLIENTE_REDIS = Symbol('CLIENTE_REDIS');

/** Espera máxima para conectar y para que un comando responda. */
const CONEXION_MS = 2000;
const COMANDO_MS = 1000;
/** Tope del espaciado entre reconexiones: se recupera sola si Redis vuelve. */
const REINTENTO_MAX_MS = 2000;

/**
 * Cliente que falla rápido: sin cola offline ni reintentos de comando, para
 * que una ruta con límite responda 503 en vez de colgarse (falla cerrada).
 * Reconecta en segundo plano con un espaciado acotado.
 *
 * Es `lazyConnect`: quien lo crea llama a `connect()`. Los errores se
 * registran por el `Logger` de Nest sin la URL, que puede llevar contraseña.
 * `opciones` existe para los tests (p. ej. un `disconnectTimeout` más corto).
 */
export function crearClienteRedis(
  url: string,
  opciones: RedisOptions = {},
): Redis {
  const logger = new Logger('Redis');
  const cliente = new Redis(url, {
    lazyConnect: true,
    connectTimeout: CONEXION_MS,
    commandTimeout: COMANDO_MS,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (intentos) => Math.min(intentos * 200, REINTENTO_MAX_MS),
    ...opciones,
  });
  // Un aviso por caída, no uno por reintento.
  let avisado = false;
  cliente.on('error', (error: Error) => {
    if (avisado) return;
    avisado = true;
    logger.warn(`Sin conexión con Redis: ${error.message}`);
  });
  cliente.on('ready', () => {
    if (avisado) logger.log('Redis disponible de nuevo');
    avisado = false;
  });
  return cliente;
}
