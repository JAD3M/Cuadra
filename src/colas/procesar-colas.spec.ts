import { procesarColas } from './procesar-colas';

describe('procesarColas (historia 1.7)', () => {
  it('sin la variable: procesa en desarrollo y pruebas, no en producción', () => {
    expect(procesarColas({ NODE_ENV: 'development' })).toBe(true);
    expect(procesarColas({ NODE_ENV: 'test' })).toBe(true);
    expect(procesarColas({ NODE_ENV: 'production' })).toBe(false);
    expect(procesarColas({})).toBe(true);
  });

  it('PROCESAR_COLAS manda sobre el valor por defecto', () => {
    expect(
      procesarColas({ NODE_ENV: 'production', PROCESAR_COLAS: 'true' }),
    ).toBe(true);
    expect(procesarColas({ NODE_ENV: 'test', PROCESAR_COLAS: 'false' })).toBe(
      false,
    );
  });
});

describe('registro de los procesadores (historia 1.7)', () => {
  const entorno = { ...process.env };

  afterEach(() => {
    process.env = { ...entorno };
    jest.resetModules();
  });

  function proveedoresDe(
    ruta: string,
    clase: string,
    env: Record<string, string>,
  ): string[] {
    Object.assign(process.env, env);
    let nombres: string[] = [];
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const modulo = require(ruta) as Record<string, new () => unknown>;
      const proveedores = Reflect.getMetadata(
        'providers',
        modulo[clase],
      ) as unknown[];
      nombres = proveedores.map((p) =>
        typeof p === 'function' ? p.name : 'factory',
      );
    });
    return nombres;
  }

  it.each([
    ['../cargas/cargas.module', 'CargasModule', 'ProcesadorCargas'],
    [
      '../sugerencias/sugerencias.module',
      'SugerenciasModule',
      'ProcesadorSugerencias',
    ],
  ])(
    '%s: la API de producción no registra el procesador',
    (ruta, modulo, procesador) => {
      const api = proveedoresDe(ruta, modulo, {
        NODE_ENV: 'production',
        PROCESAR_COLAS: 'false',
      });
      expect(api).not.toContain(procesador);
    },
  );

  it.each([
    ['../cargas/cargas.module', 'CargasModule', 'ProcesadorCargas'],
    [
      '../sugerencias/sugerencias.module',
      'SugerenciasModule',
      'ProcesadorSugerencias',
    ],
  ])(
    '%s: el worker y las pruebas sí lo registran',
    (ruta, modulo, procesador) => {
      expect(
        proveedoresDe(ruta, modulo, {
          NODE_ENV: 'production',
          PROCESAR_COLAS: 'true',
        }),
      ).toContain(procesador);
      expect(
        proveedoresDe(ruta, modulo, { NODE_ENV: 'test', PROCESAR_COLAS: '' }),
      ).toContain(procesador);
    },
  );
});
