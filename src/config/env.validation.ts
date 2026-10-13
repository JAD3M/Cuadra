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
    /**
     * CU-17: sugerencia por IA. Todo opcional para que la app y el CI no
     * necesiten un secreto. Solo está activa con LLM_HABILITADO='true' y una
     * llave; sin llave, el módulo la deja inerte y avisa.
     */
    ANTHROPIC_API_KEY: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    // No z.coerce.boolean: 'false' es un string no vacío y daría true.
    LLM_HABILITADO: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    /**
     * CU-18: 'simulado' es un proveedor determinista para demos, sin modelo
     * ni llave. Se rechaza con NODE_ENV=production (ver el refine).
     */
    LLM_PROVEEDOR: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.enum(['anthropic', 'simulado']).default('anthropic'),
    ),
    LLM_MODEL: z.string().min(1).default('claude-sonnet-5-5'),
    /** Milisegundos que espera la API antes de dar la llamada por fallida. */
    LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15000),
    /** Tope de llamadas al modelo por corrida del worker. */
    LLM_MAX_LLAMADAS_POR_CORRIDA: z.coerce.number().int().min(1).default(20),
    /** Más candidatos que esto y el movimiento se omite (no se trunca). */
    LLM_CANDIDATOS_MAX: z.coerce.number().int().min(1).default(10),
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
  )
  // Una sugerencia simulada en producción parecería real: se rechaza aunque
  // LLM_HABILITADO sea false, porque es la intención de la configuración.
  .refine(
    (env) =>
      !(env.NODE_ENV === 'production' && env.LLM_PROVEEDOR === 'simulado'),
    {
      path: ['LLM_PROVEEDOR'],
      message: "'simulado' no esta permitido con NODE_ENV=production",
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
