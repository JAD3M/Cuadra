import { validateEnv } from './env.validation';

const VALIDO = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://cuadra:cuadra@localhost:5432/cuadra',
  DATABASE_APP_URL: 'postgresql://cuadra_app:cuadra_app@localhost:5432/cuadra',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'un-secreto-de-al-menos-16',
};

describe('validateEnv (CU-01.3)', () => {
  it('acepta una configuración completa y aplica los defaults', () => {
    const env = validateEnv(VALIDO);
    expect(env.PORT).toBe(3000);
    expect(env.COLA_PREFIJO).toBe('cuadra');
  });

  it.each(['DATABASE_URL', 'DATABASE_APP_URL', 'REDIS_URL', 'JWT_SECRET'])(
    'falta %s: truena nombrándola',
    (variable) => {
      const incompleto: Record<string, string> = { ...VALIDO };
      delete incompleto[variable];
      expect(() => validateEnv(incompleto)).toThrow(
        new RegExp(`Configuración inválida:[\\s\\S]*${variable}`),
      );
    },
  );

  it('rechaza que la app use el mismo rol que el dueño del esquema', () => {
    expect(() =>
      validateEnv({ ...VALIDO, DATABASE_APP_URL: VALIDO.DATABASE_URL }),
    ).toThrow(/DATABASE_APP_URL/);
  });
});
