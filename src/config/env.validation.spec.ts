import { validateEnv } from './env.validation';

const VALIDO = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://cuadra:cuadra@localhost:5432/cuadra',
  DATABASE_APP_URL: 'postgresql://cuadra_app:cuadra_app@localhost:5432/cuadra',
  REDIS_URL: 'redis://localhost:6379',
  ORIGEN_AUTORIZADO: 'http://localhost:5173',
};

describe('validateEnv (CU-01.3)', () => {
  it('acepta una configuración completa y aplica los defaults', () => {
    const env = validateEnv(VALIDO);
    expect(env.PORT).toBe(3000);
    expect(env.COLA_PREFIJO).toBe('cuadra');
  });

  it.each([
    'DATABASE_URL',
    'DATABASE_APP_URL',
    'REDIS_URL',
    'ORIGEN_AUTORIZADO',
  ])('falta %s: truena nombrándola', (variable) => {
    const incompleto: Record<string, string> = { ...VALIDO };
    delete incompleto[variable];
    expect(() => validateEnv(incompleto)).toThrow(
      new RegExp(`Configuración inválida:[\\s\\S]*${variable}`),
    );
  });

  it('rechaza que la app use el mismo rol que el dueño del esquema', () => {
    expect(() =>
      validateEnv({ ...VALIDO, DATABASE_APP_URL: VALIDO.DATABASE_URL }),
    ).toThrow(/DATABASE_APP_URL/);
  });

  describe('origen autorizado y proxy (historia 1.2)', () => {
    it('acepta un origen exacto: esquema, host y puerto opcional', () => {
      for (const origen of [
        'http://localhost:5173',
        'https://cuadra.example',
        'https://app.cuadra.example:8443',
      ]) {
        expect(
          validateEnv({ ...VALIDO, ORIGEN_AUTORIZADO: origen })
            .ORIGEN_AUTORIZADO,
        ).toBe(origen);
      }
    });

    it.each([
      '*',
      '',
      'localhost:5173',
      'cuadra.example',
      'https://cuadra.example/',
      'https://cuadra.example/app',
      'https://cuadra.example?x=1',
      'https://cuadra.example:443',
      'ftp://cuadra.example',
      'https://*.cuadra.example',
    ])('ORIGEN_AUTORIZADO=%p se rechaza nombrándola', (valor) => {
      expect(() =>
        validateEnv({ ...VALIDO, ORIGEN_AUTORIZADO: valor }),
      ).toThrow(/ORIGEN_AUTORIZADO/);
    });

    it('TRUST_PROXY ausente o vacío significa apagado', () => {
      expect(validateEnv(VALIDO).TRUST_PROXY).toBe(false);
      expect(validateEnv({ ...VALIDO, TRUST_PROXY: '' }).TRUST_PROXY).toBe(
        false,
      );
    });

    it("TRUST_PROXY acepta 'true', 'false' y un número de saltos", () => {
      expect(validateEnv({ ...VALIDO, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(
        true,
      );
      expect(validateEnv({ ...VALIDO, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(
        false,
      );
      expect(validateEnv({ ...VALIDO, TRUST_PROXY: '2' }).TRUST_PROXY).toBe(2);
    });

    it.each(['0', '-1', '1.5', 'si', 'TRUE', 'loopback', '10.0.0.1'])(
      'TRUST_PROXY=%p se rechaza nombrándola',
      (valor) => {
        expect(() => validateEnv({ ...VALIDO, TRUST_PROXY: valor })).toThrow(
          /TRUST_PROXY/,
        );
      },
    );
  });

  describe('sugerencia por IA (CU-17)', () => {
    it('arranca sin ninguna variable de LLM y con todo apagado', () => {
      const env = validateEnv(VALIDO);
      expect(env.ANTHROPIC_API_KEY).toBeUndefined();
      expect(env.LLM_HABILITADO).toBe(false);
      expect(env.LLM_MODEL).toBe('claude-sonnet-5-5');
      expect(env.LLM_TIMEOUT_MS).toBe(15000);
      expect(env.LLM_MAX_LLAMADAS_POR_CORRIDA).toBe(20);
      expect(env.LLM_CANDIDATOS_MAX).toBe(10);
    });

    it('una ANTHROPIC_API_KEY vacía cuenta como ausente', () => {
      expect(
        validateEnv({ ...VALIDO, ANTHROPIC_API_KEY: '' }).ANTHROPIC_API_KEY,
      ).toBeUndefined();
      expect(
        validateEnv({ ...VALIDO, ANTHROPIC_API_KEY: 'sk-x' }).ANTHROPIC_API_KEY,
      ).toBe('sk-x');
    });

    it("LLM_HABILITADO: 'true' es true y 'false' es false (no coerce.boolean)", () => {
      expect(
        validateEnv({ ...VALIDO, LLM_HABILITADO: 'true' }).LLM_HABILITADO,
      ).toBe(true);
      expect(
        validateEnv({ ...VALIDO, LLM_HABILITADO: 'false' }).LLM_HABILITADO,
      ).toBe(false);
    });

    it.each(['1', 'si', 'TRUE', ''])(
      'LLM_HABILITADO=%p se rechaza nombrándola',
      (valor) => {
        expect(() => validateEnv({ ...VALIDO, LLM_HABILITADO: valor })).toThrow(
          /LLM_HABILITADO/,
        );
      },
    );

    it('convierte y acota los números', () => {
      const env = validateEnv({
        ...VALIDO,
        LLM_TIMEOUT_MS: '2500',
        LLM_MAX_LLAMADAS_POR_CORRIDA: '3',
        LLM_CANDIDATOS_MAX: '5',
        LLM_MODEL: 'otro-modelo',
      });
      expect(env.LLM_TIMEOUT_MS).toBe(2500);
      expect(env.LLM_MAX_LLAMADAS_POR_CORRIDA).toBe(3);
      expect(env.LLM_CANDIDATOS_MAX).toBe(5);
      expect(env.LLM_MODEL).toBe('otro-modelo');
    });

    it.each([
      ['LLM_TIMEOUT_MS', '999'],
      ['LLM_TIMEOUT_MS', 'abc'],
      ['LLM_MAX_LLAMADAS_POR_CORRIDA', '0'],
      ['LLM_CANDIDATOS_MAX', '0'],
      ['LLM_CANDIDATOS_MAX', '2.5'],
    ])('%s=%p se rechaza', (variable, valor) => {
      expect(() => validateEnv({ ...VALIDO, [variable]: valor })).toThrow(
        new RegExp(variable),
      );
    });

    describe('LLM_PROVEEDOR (CU-18)', () => {
      it('por defecto es anthropic y la cadena vacía cuenta como ausente', () => {
        expect(validateEnv(VALIDO).LLM_PROVEEDOR).toBe('anthropic');
        expect(
          validateEnv({ ...VALIDO, LLM_PROVEEDOR: '' }).LLM_PROVEEDOR,
        ).toBe('anthropic');
      });

      it('simulado es válido en desarrollo y test, sin llave', () => {
        for (const NODE_ENV of ['development', 'test']) {
          const env = validateEnv({
            ...VALIDO,
            NODE_ENV,
            LLM_PROVEEDOR: 'simulado',
            LLM_HABILITADO: 'true',
          });
          expect(env.LLM_PROVEEDOR).toBe('simulado');
          expect(env.ANTHROPIC_API_KEY).toBeUndefined();
        }
      });

      it.each(['true', 'false'])(
        'production + simulado se rechaza nombrando LLM_PROVEEDOR (LLM_HABILITADO=%s)',
        (habilitado) => {
          expect(() =>
            validateEnv({
              ...VALIDO,
              NODE_ENV: 'production',
              LLM_PROVEEDOR: 'simulado',
              LLM_HABILITADO: habilitado,
            }),
          ).toThrow(/LLM_PROVEEDOR: 'simulado' no esta permitido/);
        },
      );

      it('un valor desconocido se rechaza nombrándola', () => {
        expect(() =>
          validateEnv({ ...VALIDO, LLM_PROVEEDOR: 'openai' }),
        ).toThrow(/LLM_PROVEEDOR/);
      });

      it('anthropic habilitado sin llave conserva el comportamiento de CU-17', () => {
        const env = validateEnv({
          ...VALIDO,
          LLM_PROVEEDOR: 'anthropic',
          LLM_HABILITADO: 'true',
        });
        expect(env.LLM_HABILITADO).toBe(true);
        expect(env.ANTHROPIC_API_KEY).toBeUndefined();
      });

      it('anthropic en production sigue permitido', () => {
        expect(
          validateEnv({
            ...VALIDO,
            NODE_ENV: 'production',
            DATABASE_URL:
              'postgresql://cuadra:Xk29-largo-y-unico@db:5432/cuadra',
            DATABASE_APP_URL:
              'postgresql://cuadra_app:Qw81-otra-larga-unica@db:5432/cuadra',
            CORREO_SMTP_HOST: 'smtp.example',
            CORREO_SMTP_PORT: '587',
            CORREO_SMTP_USUARIO: 'usuario',
            CORREO_SMTP_PASSWORD: 'secreto',
            CORREO_REMITENTE: 'no-responder@cuadra.example',
          }).LLM_PROVEEDOR,
        ).toBe('anthropic');
      });
    });

    it('no existe LLM_FALLBACK_SERVIDOR: no hay respaldo del lado del servidor', () => {
      const env = validateEnv({ ...VALIDO, LLM_FALLBACK_SERVIDOR: 'true' });
      expect(env).not.toHaveProperty('LLM_FALLBACK_SERVIDOR');
    });
  });
  describe('correo (historia 1.5)', () => {
    const CORREO = {
      CORREO_SMTP_HOST: 'smtp.example',
      CORREO_SMTP_PORT: '587',
      CORREO_SMTP_USUARIO: 'usuario',
      CORREO_SMTP_PASSWORD: 'secreto',
      CORREO_REMITENTE: 'no-responder@cuadra.example',
    };
    const PRODUCCION = {
      ...VALIDO,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://cuadra:Xk29-largo-y-unico@db:5432/cuadra',
      DATABASE_APP_URL:
        'postgresql://cuadra_app:Qw81-otra-larga-unica@db:5432/cuadra',
    };

    it('fuera de producción no exige ninguna', () => {
      expect(() => validateEnv(VALIDO)).not.toThrow();
      expect(() =>
        validateEnv({ ...VALIDO, NODE_ENV: 'development' }),
      ).not.toThrow();
    });

    it('producción con todas: las acepta y convierte el puerto', () => {
      const env = validateEnv({ ...PRODUCCION, ...CORREO });
      expect(env.CORREO_SMTP_PORT).toBe(587);
    });

    it('producción sin ninguna: nombra todas', () => {
      let mensaje = '';
      try {
        validateEnv(PRODUCCION);
      } catch (e) {
        mensaje = (e as Error).message;
      }
      for (const variable of Object.keys(CORREO)) {
        expect(mensaje).toContain(variable);
      }
    });

    it('producción con una faltante: nombra solo esa y no imprime valores', () => {
      const parcial: Record<string, string> = { ...PRODUCCION, ...CORREO };
      delete parcial.CORREO_SMTP_USUARIO;
      let mensaje = '';
      try {
        validateEnv(parcial);
      } catch (e) {
        mensaje = (e as Error).message;
      }
      expect(mensaje).toContain('CORREO_SMTP_USUARIO');
      expect(mensaje).not.toContain('CORREO_SMTP_HOST');
      expect(mensaje).not.toContain('secreto');
    });

    it('trata la cadena vacía como faltante', () => {
      expect(() =>
        validateEnv({ ...PRODUCCION, ...CORREO, CORREO_SMTP_PASSWORD: '' }),
      ).toThrow(/CORREO_SMTP_PASSWORD/);
    });
  });
  describe('credenciales por defecto (historia 1.7)', () => {
    const CORREO = {
      CORREO_SMTP_HOST: 'smtp.example',
      CORREO_SMTP_PORT: '587',
      CORREO_SMTP_USUARIO: 'usuario',
      CORREO_SMTP_PASSWORD: 'secreto',
      CORREO_REMITENTE: 'no-responder@cuadra.example',
    };
    const PRODUCCION = {
      ...VALIDO,
      ...CORREO,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://cuadra:Xk29-largo-y-unico@db:5432/cuadra',
      DATABASE_APP_URL:
        'postgresql://cuadra_app:Qw81-otra-larga-unica@db:5432/cuadra',
    };

    it('producción con contraseñas propias: se acepta', () => {
      expect(() => validateEnv(PRODUCCION)).not.toThrow();
    });

    it.each([
      ['DATABASE_URL', 'cuadra'],
      ['DATABASE_URL', 'cambia-esta-contrasena'],
      ['DATABASE_APP_URL', 'cuadra_app'],
      ['DATABASE_APP_URL', 'cambia-esta-contrasena'],
      ['DATABASE_APP_URL', 'cuadra'],
    ])(
      'producción con %s con la contraseña por defecto %s: la nombra',
      (variable, clave) => {
        const url = new URL(PRODUCCION[variable as 'DATABASE_URL']);
        url.password = clave;
        let mensaje = '';
        try {
          validateEnv({ ...PRODUCCION, [variable]: url.toString() });
        } catch (e) {
          mensaje = (e as Error).message;
        }
        expect(mensaje).toMatch(
          new RegExp(`Configuración inválida:[\\s\\S]*${variable}`),
        );
        expect(mensaje).not.toContain(clave === 'cuadra' ? 'xx' : clave);
      },
    );

    it('producción sin contraseña: se rechaza', () => {
      expect(() =>
        validateEnv({
          ...PRODUCCION,
          DATABASE_URL: 'postgresql://cuadra@db:5432/cuadra',
        }),
      ).toThrow(/DATABASE_URL/);
    });

    it('el mensaje no imprime la contraseña', () => {
      let mensaje = '';
      try {
        validateEnv({
          ...PRODUCCION,
          DATABASE_URL: 'postgresql://cuadra:cambia-esta-contrasena@db/cuadra',
        });
      } catch (e) {
        mensaje = (e as Error).message;
      }
      expect(mensaje).toContain('DATABASE_URL');
      expect(mensaje).not.toContain('cambia-esta-contrasena');
    });

    it.each(['development', 'test'])(
      'en %s las contraseñas de desarrollo siguen valiendo',
      (NODE_ENV) => {
        expect(() => validateEnv({ ...VALIDO, NODE_ENV })).not.toThrow();
      },
    );
  });
});
