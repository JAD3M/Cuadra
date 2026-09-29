// src/config/env.validation.ts
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().default(3000),
    /** Dueño del esquema: migraciones y seed. Nunca la usa la app. */
    DATABASE_URL: z.string().url(),
    /** Rol `cuadra_app`, sin BYPASSRLS: con esta corre la app (CU-04b). */
    DATABASE_APP_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    JWT_SECRET: z.string().min(16),
    /** CU-08: intentos por job antes de dar la carga por 'fallida'. */
    COLA_INTENTOS: z.coerce.number().int().min(1).default(5),
    /** Espera base del backoff exponencial: d, 2d, 4d, ... */
    COLA_ESPERA_MS: z.coerce.number().int().min(1).default(1000),
    /**
     * Prefijo de las llaves en Redis. Los tests usan otro: si no, el worker
     * de la api en Docker tomaría sus jobs y los buscaría en la base de
     * desarrollo.
     */
    COLA_PREFIJO: z
      .string()
      .regex(/^[a-z0-9_]+$/)
      .default('cuadra'),
  })
  // Con el mismo usuario, la app correría como dueño (superusuario en Docker)
  // y RLS no aplicaría, sin que nada falle.
  .refine(
    (env) =>
      new URL(env.DATABASE_APP_URL).username !==
      new URL(env.DATABASE_URL).username,
    {
      path: ['DATABASE_APP_URL'],
      message: 'debe usar un rol distinto al de DATABASE_URL',
    },
  );

export type Env = z.infer<typeof schema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const faltantes = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuración inválida:\n${faltantes}`);
  }
  return parsed.data;
}
