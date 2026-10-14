// src/config/env.validation.ts
import { z } from 'zod';

/**
 * Valor de `trust proxy` de Express: `false` (apagado), `true` (confía en
 * todos los saltos) o un número de saltos. Acepta lo ya interpretado o el
 * texto de la variable; lo demás es apagado.
 */
export function interpretarTrustProxy(valor: unknown): boolean | number {
  if (typeof valor === 'number' && Number.isInteger(valor) && valor > 0) {
    return valor;
  }
  if (valor === true || valor === 'true') return true;
  if (typeof valor === 'string' && /^[1-9]\d*$/.test(valor)) {
    return Number(valor);
  }
  return false;
}

function vacioComoFaltante<T extends z.ZodType>(esquema: T) {
  return z.preprocess((v) => (v === '' ? undefined : v), esquema);
}

const VARIABLES_CORREO = [
  'CORREO_SMTP_HOST',
  'CORREO_SMTP_PORT',
  'CORREO_SMTP_USUARIO',
  'CORREO_SMTP_PASSWORD',
  'CORREO_REMITENTE',
] as const;

/**
 * AD-17: contraseñas que traen el repositorio, el compose de desarrollo o el
 * ejemplo de variables. Con NODE_ENV=production no sirven; una vacía tampoco.
 */
const CONTRASENAS_POR_DEFECTO = new Set([
  'cuadra',
  'cuadra_app',
  'cambia-esta-contrasena',
]);

function contrasenaDeUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url).password);
  } catch {
    return '';
  }
}

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),
    PORT: z.coerce.number().default(3000),
    /** Dueño del esquema: migraciones y seed. Nunca la usa la app. */
    DATABASE_URL: z.string().url(),
    /** Rol `cuadra_app`, sin BYPASSRLS: con esta corre la app (CU-04b). */
    DATABASE_APP_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    /**
     * AD-6: el único origen que la API acepta. Origen exacto (esquema, host
     * y puerto si no es el de por defecto): sin ruta, sin barra final y
     * nunca `*`.
     */
    ORIGEN_AUTORIZADO: z.string().refine(
      (valor) => {
        try {
          const url = new URL(valor);
          return (
            ['http:', 'https:'].includes(url.protocol) &&
            url.origin === valor &&
            !valor.includes('*')
          );
        } catch {
          return false;
        }
      },
      {
        message:
          'debe ser un origen exacto (https://dominio[:puerto]), sin ruta ni barra final ni *',
      },
    ),
    /**
     * AD-15: de dónde sale `req.ip`. Apagada por defecto. Un número son los
     * saltos de proxy de confianza (lo recomendado: 1 detrás de un proxy);
     * 'true' confía en todos los saltos de X-Forwarded-For y deja a cualquier
     * cliente falsear su IP, solo para entornos cerrados.
     *
     * `configurarApp` vuelve a pasar el valor por `interpretarTrustProxy`: una
     * app montada sin `validate` (un módulo de prueba) deja la variable como
     * texto crudo, y así ambos caminos dan el mismo resultado.
     */
    TRUST_PROXY: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z
        .union([z.enum(['true', 'false']), z.string().regex(/^[1-9]\d*$/)])
        .default('false')
        .transform(interpretarTrustProxy),
    ),
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
    /**
     * Historia 1.5: correo saliente. Todo opcional (sin ellas se usa el
     * adaptador simulado); en producción deben venir las cinco (ver el
     * superRefine). Una cadena vacía cuenta como faltante.
     */
    CORREO_SMTP_HOST: vacioComoFaltante(z.string().min(1).optional()),
    CORREO_SMTP_PORT: vacioComoFaltante(
      z.coerce.number().int().min(1).max(65535).optional(),
    ),
    CORREO_SMTP_USUARIO: vacioComoFaltante(z.string().min(1).optional()),
    CORREO_SMTP_PASSWORD: vacioComoFaltante(z.string().min(1).optional()),
    CORREO_REMITENTE: vacioComoFaltante(z.string().min(1).optional()),
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
  )
  // En producción el correo no puede quedar simulado: se nombran TODAS las
  // variables faltantes, nunca sus valores.
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    for (const variable of ['DATABASE_URL', 'DATABASE_APP_URL'] as const) {
      const contrasena = contrasenaDeUrl(env[variable]);
      if (contrasena === '' || CONTRASENAS_POR_DEFECTO.has(contrasena)) {
        ctx.addIssue({
          code: 'custom',
          path: [variable],
          message:
            'la contraseña está vacía o es una de las de desarrollo; con NODE_ENV=production debe ser propia',
        });
      }
    }
    for (const variable of VARIABLES_CORREO) {
      if (env[variable] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [variable],
          message: 'es obligatoria con NODE_ENV=production',
        });
      }
    }
  });

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
