import { config as cargarEnv } from 'dotenv';

/**
 * AD-16/AD-17: quién consume las colas BullMQ.
 *
 * - Producción: el proceso `worker` (`node dist/worker`) consume; la API solo
 *   encola. Sin PROCESAR_COLAS, la API de producción NO procesa.
 * - Desarrollo y pruebas: sin PROCESAR_COLAS, el proceso procesa en línea.
 *   Los specs de integración levantan la app con los procesadores en el mismo
 *   proceso y no dependen de un worker aparte.
 * - PROCESAR_COLAS='true'|'false' manda sobre ambos valores por defecto. El
 *   proceso worker lo fija en 'true' (ver modo-worker.ts).
 *
 * Se decide al cargar los módulos (los `providers` de Nest son estáticos), así
 * que se lee `process.env` directo, cargando antes el `.env` sin pisar lo ya
 * definido: ConfigModule corre después de que se importan los módulos.
 */
export function procesarColas(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.PROCESAR_COLAS === 'true') return true;
  if (env.PROCESAR_COLAS === 'false') return false;
  return env.NODE_ENV !== 'production';
}

/** Los procesadores que este proceso debe registrar (ninguno en la API). */
export function procesadoresDeColas<T>(...procesadores: T[]): T[] {
  cargarEnv({ quiet: true });
  return procesarColas() ? procesadores : [];
}
