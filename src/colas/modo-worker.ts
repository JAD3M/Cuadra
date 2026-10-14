/**
 * Se importa primero en `worker.ts`: fija el modo antes de que se carguen los
 * módulos que registran los procesadores (ver procesar-colas.ts).
 */
process.env.PROCESAR_COLAS = 'true';
