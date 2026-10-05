import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { contextoSesion } from '@/shared/api/contratos';
import { CONTEXTO_SESION } from '@/test/fixtures';
import { servidor } from '@/test/servidor';
import { api, configurarCliente, crearClienteApi } from './client';
import { ApiError, ContratoError, NetworkError } from './errores';

/** Registra la cabecera Authorization de la última petición recibida. */
function espiarAutorizacion() {
  const vistas: (string | null)[] = [];
  servidor.use(
    http.get('/api/auth/contexto', ({ request }) => {
      vistas.push(request.headers.get('Authorization'));
      return HttpResponse.json(CONTEXTO_SESION);
    }),
  );
  return vistas;
}

function responder403(ruta: string) {
  servidor.use(
    http.get(ruta, () =>
      HttpResponse.json(
        { statusCode: 403, error: 'Forbidden', message: 'Sin acceso' },
        { status: 403 },
      ),
    ),
  );
}

describe('token', () => {
  it('no envía Authorization cuando el proveedor devuelve null', async () => {
    const vistas = espiarAutorizacion();
    const cliente = crearClienteApi({ proveedorToken: () => null });
    await cliente.fetch('/auth/contexto');
    expect(vistas).toEqual([null]);
  });

  it('no envía Authorization si no hay proveedor', async () => {
    const vistas = espiarAutorizacion();
    await crearClienteApi().fetch('/auth/contexto');
    expect(vistas).toEqual([null]);
  });

  it('envía Authorization: Bearer cuando el proveedor devuelve un token', async () => {
    const vistas = espiarAutorizacion();
    const cliente = crearClienteApi({ proveedorToken: () => 't' });
    await cliente.fetch('/auth/contexto');
    expect(vistas).toEqual(['Bearer t']);
  });

  it('el token de la llamada tiene prioridad sobre el proveedor', async () => {
    const vistas = espiarAutorizacion();
    const cliente = crearClienteApi({ proveedorToken: () => 'sesion' });
    await cliente.fetch('/auth/contexto', { token: 'seleccion' });
    expect(vistas).toEqual(['Bearer seleccion']);
  });

  it('token null en la llamada fuerza una petición sin Authorization', async () => {
    const vistas = espiarAutorizacion();
    const cliente = crearClienteApi({ proveedorToken: () => 'sesion' });
    await cliente.fetch('/auth/contexto', { token: null });
    expect(vistas).toEqual([null]);
  });

  it('el token nunca aparece en la URL pedida', async () => {
    const urls: string[] = [];
    const cliente = crearClienteApi({
      proveedorToken: () => 'secreto',
      fetchImpl: (entrada) => {
        urls.push(String(entrada));
        return Promise.resolve(Response.json({}));
      },
    });
    await cliente.fetch('/auth/contexto');
    expect(urls).toEqual(['/api/auth/contexto']);
  });
});

describe('ruta y petición', () => {
  it('antepone la base relativa /api', async () => {
    const urls: string[] = [];
    const cliente = crearClienteApi({
      fetchImpl: (entrada) => {
        urls.push(String(entrada));
        return Promise.resolve(Response.json({}));
      },
    });
    await cliente.fetch('/auth/login');
    expect(urls).toEqual(['/api/auth/login']);
  });

  it('acepta otra base relativa y ignora una barra final', async () => {
    const urls: string[] = [];
    const cliente = crearClienteApi({
      baseUrl: '/v2/',
      fetchImpl: (entrada) => {
        urls.push(String(entrada));
        return Promise.resolve(Response.json({}));
      },
    });
    await cliente.fetch('/x');
    expect(urls).toEqual(['/v2/x']);
  });

  it.each(['https://evil.example/x', '//evil.example/x', 'auth/contexto', ''])(
    'rechaza la ruta no relativa %j antes de pedir nada',
    async (ruta) => {
      const fetchImpl = vi.fn<typeof fetch>();
      const cliente = crearClienteApi({ proveedorToken: () => 't', fetchImpl });
      await expect(cliente.fetch(ruta)).rejects.toBeInstanceOf(TypeError);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('envía el cuerpo como JSON con su Content-Type', async () => {
    let recibido: unknown;
    let tipo: string | null = null;
    servidor.use(
      http.post('/api/auth/login', async ({ request }) => {
        tipo = request.headers.get('Content-Type');
        recibido = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    await api.fetch('/auth/login', {
      method: 'POST',
      body: { email: 'a@b.mx', password: 'x' },
    });
    expect(tipo).toBe('application/json');
    expect(recibido).toEqual({ email: 'a@b.mx', password: 'x' });
  });

  it('devuelve el JSON sin validar cuando no hay schema', async () => {
    expect(await api.fetch('/auth/contexto')).toEqual(CONTEXTO_SESION);
  });

  it('una respuesta sin cuerpo da undefined', async () => {
    servidor.use(
      http.get('/api/vacio', () => new HttpResponse(null, { status: 204 })),
    );
    expect(await api.fetch('/vacio')).toBeUndefined();
  });
});

describe('contrato', () => {
  it('devuelve los datos tipados cuando la respuesta cumple el schema', async () => {
    const datos = await api.fetch('/auth/contexto', { schema: contextoSesion });
    expect(datos.empresa.rfc).toBe(CONTEXTO_SESION.empresa.rfc);
  });

  it('una respuesta que no cumple el schema es ContratoError, no datos', async () => {
    servidor.use(
      http.get('/api/auth/contexto', () =>
        HttpResponse.json({ ...CONTEXTO_SESION, roles: ['superuser'] }),
      ),
    );
    const error = await api
      .fetch('/auth/contexto', { schema: contextoSesion })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContratoError);
    expect((error as ContratoError).detalle?.issues.length).toBeGreaterThan(0);
  });

  it('un 2xx cuyo cuerpo no es JSON es ContratoError', async () => {
    servidor.use(
      http.get('/api/auth/contexto', () => HttpResponse.text('<html>')),
    );
    await expect(api.fetch('/auth/contexto')).rejects.toBeInstanceOf(
      ContratoError,
    );
  });

  it('un cuerpo vacío no cumple un schema de objeto', async () => {
    servidor.use(
      http.get('/api/vacio', () => new HttpResponse(null, { status: 204 })),
    );
    await expect(
      api.fetch('/vacio', { schema: z.object({}) }),
    ).rejects.toBeInstanceOf(ContratoError);
  });
});

describe('errores', () => {
  it('un 400 con message en arreglo es ApiError con todos los mensajes', async () => {
    servidor.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { statusCode: 400, error: 'Bad Request', message: ['a', 'b'] },
          { status: 400 },
        ),
      ),
    );
    const error = await api
      .fetch('/auth/login', { method: 'POST' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).mensajes).toEqual(['a', 'b']);
  });

  it('un 502 con HTML es ApiError 502', async () => {
    servidor.use(
      http.get('/api/auth/contexto', () =>
        HttpResponse.html('<h1>Bad Gateway</h1>', { status: 502 }),
      ),
    );
    const error = await api.fetch('/auth/contexto').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(502);
    expect((error as ApiError).mensajes).toEqual([]);
  });

  it('un fallo de red es NetworkError y no ApiError', async () => {
    servidor.use(http.get('/api/auth/contexto', () => HttpResponse.error()));
    const error = await api.fetch('/auth/contexto').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect(error).not.toBeInstanceOf(ApiError);
  });

  it('no reintenta: una petición fallida se hace una sola vez', async () => {
    let llamadas = 0;
    servidor.use(
      http.get('/api/auth/contexto', () => {
        llamadas += 1;
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'x' },
          { status: 500 },
        );
      }),
    );
    await expect(api.fetch('/auth/contexto')).rejects.toBeInstanceOf(ApiError);
    expect(llamadas).toBe(1);
  });
});

describe('fin de sesión', () => {
  it('un 403 en /auth/contexto llama al hook una vez y lanza ApiError', async () => {
    responder403('/api/auth/contexto');
    const alTerminarSesion = vi.fn();
    const cliente = crearClienteApi({ alTerminarSesion });
    const error = await cliente
      .fetch('/auth/contexto')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(403);
    expect(alTerminarSesion).toHaveBeenCalledTimes(1);
    expect(alTerminarSesion).toHaveBeenCalledWith('sin_acceso');
  });

  it('un 403 con consulta en /auth/contexto también cuenta', async () => {
    responder403('/api/auth/contexto');
    const alTerminarSesion = vi.fn();
    const cliente = crearClienteApi({ alTerminarSesion });
    await expect(cliente.fetch('/auth/contexto?x=1')).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(alTerminarSesion).toHaveBeenCalledTimes(1);
  });

  it('un 403 en otra ruta no llama al hook', async () => {
    servidor.use(
      http.post('/api/auth/empresa/:id', () =>
        HttpResponse.json(
          { statusCode: 403, error: 'Forbidden', message: 'Sin roles' },
          { status: 403 },
        ),
      ),
    );
    const alTerminarSesion = vi.fn();
    const cliente = crearClienteApi({ alTerminarSesion });
    await expect(
      cliente.fetch('/auth/empresa/x', { method: 'POST' }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(alTerminarSesion).not.toHaveBeenCalled();
  });

  it('un 401 sin token del proveedor no llama al hook', async () => {
    servidor.use(
      http.get('/api/auth/contexto', () =>
        HttpResponse.json(
          { statusCode: 401, error: 'Unauthorized', message: 'x' },
          { status: 401 },
        ),
      ),
    );
    const alTerminarSesion = vi.fn();
    const cliente = crearClienteApi({ alTerminarSesion });
    await expect(cliente.fetch('/auth/contexto')).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(alTerminarSesion).not.toHaveBeenCalled();
  });

  it('sin hook registrado un 403 en /auth/contexto no rompe', async () => {
    responder403('/api/auth/contexto');
    await expect(
      crearClienteApi().fetch('/auth/contexto'),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

function responder401(ruta: string, contador?: { n: number }) {
  servidor.use(
    http.get(ruta, () => {
      if (contador) contador.n += 1;
      return HttpResponse.json(
        { statusCode: 401, error: 'Unauthorized', message: 'x' },
        { status: 401 },
      );
    }),
  );
}

describe('fin de sesión por 401', () => {
  it('con el token del proveedor llama al hook una vez y lanza ApiError', async () => {
    responder401('/api/auth/contexto');
    const alTerminarSesion = vi.fn();
    const cliente = crearClienteApi({
      proveedorToken: () => 'sesion',
      alTerminarSesion,
    });
    const error = await cliente
      .fetch('/auth/contexto')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(401);
    expect(alTerminarSesion).toHaveBeenCalledTimes(1);
    expect(alTerminarSesion).toHaveBeenCalledWith('sesion_expirada');
  });

  it('con un token por llamada (selección) no llama al hook', async () => {
    responder401('/api/auth/contexto');
    const alTerminarSesion = vi.fn();
    const cliente = crearClienteApi({
      proveedorToken: () => 'sesion',
      alTerminarSesion,
    });
    await expect(
      cliente.fetch('/auth/contexto', { token: 'seleccion' }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(alTerminarSesion).not.toHaveBeenCalled();
  });

  it('con token: null (login) no llama al hook', async () => {
    responder401('/api/auth/contexto');
    const alTerminarSesion = vi.fn();
    const cliente = crearClienteApi({
      proveedorToken: () => 'sesion',
      alTerminarSesion,
    });
    await expect(
      cliente.fetch('/auth/contexto', { token: null }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(alTerminarSesion).not.toHaveBeenCalled();
  });

  it('sin token del proveedor (null o vacío) no llama al hook', async () => {
    responder401('/api/auth/contexto');
    for (const token of [null, '']) {
      const alTerminarSesion = vi.fn();
      const cliente = crearClienteApi({
        proveedorToken: () => token,
        alTerminarSesion,
      });
      await expect(cliente.fetch('/auth/contexto')).rejects.toBeInstanceOf(
        ApiError,
      );
      expect(alTerminarSesion).not.toHaveBeenCalled();
    }
  });

  it('si el token rotó mientras la llamada estaba en vuelo no llama al hook', async () => {
    let vigente = 'sesion-vieja';
    servidor.use(
      http.get('/api/auth/contexto', () => {
        // La sesión cambia antes de que llegue la respuesta.
        vigente = 'sesion-nueva';
        return HttpResponse.json(
          { statusCode: 401, error: 'Unauthorized', message: 'x' },
          { status: 401 },
        );
      }),
    );
    const alTerminarSesion = vi.fn();
    const cliente = crearClienteApi({
      proveedorToken: () => vigente,
      alTerminarSesion,
    });
    await expect(cliente.fetch('/auth/contexto')).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(alTerminarSesion).not.toHaveBeenCalled();
  });

  it('tres 401 simultáneos terminan la sesión una sola vez', async () => {
    responder401('/api/auth/contexto');
    let vigente: string | null = 'sesion';
    // El hook real limpia el almacén: los 401 siguientes ven otro token.
    const alTerminarSesion = vi.fn(() => {
      vigente = null;
    });
    const cliente = crearClienteApi({
      proveedorToken: () => vigente,
      alTerminarSesion,
    });
    const resultados = await Promise.allSettled([
      cliente.fetch('/auth/contexto'),
      cliente.fetch('/auth/contexto'),
      cliente.fetch('/auth/contexto'),
    ]);
    expect(resultados.every((r) => r.status === 'rejected')).toBe(true);
    expect(alTerminarSesion).toHaveBeenCalledTimes(1);
  });

  it('un 403 en /auth/contexto solo notifica sin_acceso, nunca sesion_expirada', async () => {
    responder403('/api/auth/contexto');
    const alTerminarSesion = vi.fn();
    const cliente = crearClienteApi({
      proveedorToken: () => 'sesion',
      alTerminarSesion,
    });
    await expect(cliente.fetch('/auth/contexto')).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(alTerminarSesion).toHaveBeenCalledTimes(1);
    expect(alTerminarSesion).toHaveBeenCalledWith('sin_acceso');
  });

  it('un 403 en otra ruta con token del proveedor no llama al hook', async () => {
    responder403('/api/casos');
    const alTerminarSesion = vi.fn();
    const cliente = crearClienteApi({
      proveedorToken: () => 'sesion',
      alTerminarSesion,
    });
    await expect(cliente.fetch('/casos')).rejects.toBeInstanceOf(ApiError);
    expect(alTerminarSesion).not.toHaveBeenCalled();
  });

  it('sin hook registrado un 401 no rompe', async () => {
    responder401('/api/auth/contexto');
    const cliente = crearClienteApi({ proveedorToken: () => 'sesion' });
    await expect(cliente.fetch('/auth/contexto')).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('un 401 hace exactamente una petición (sin reintento ni refresco)', async () => {
    const contador = { n: 0 };
    responder401('/api/auth/contexto', contador);
    const cliente = crearClienteApi({
      proveedorToken: () => 'sesion',
      alTerminarSesion: vi.fn(),
    });
    await expect(cliente.fetch('/auth/contexto')).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(contador.n).toBe(1);
  });

  it('un fallo de red con token del proveedor no termina la sesión', async () => {
    servidor.use(http.get('/api/auth/contexto', () => HttpResponse.error()));
    const alTerminarSesion = vi.fn();
    const cliente = crearClienteApi({
      proveedorToken: () => 'sesion',
      alTerminarSesion,
    });
    // `HttpResponse.error()` llega como NetworkError a través del shim de fetch.
    await expect(cliente.fetch('/auth/contexto')).rejects.toBeInstanceOf(
      NetworkError,
    );
    expect(alTerminarSesion).not.toHaveBeenCalled();
  });
});

describe('configurarCliente (singleton)', () => {
  it('registra los hooks sobre el cliente único y se pueden retirar', async () => {
    const vistas = espiarAutorizacion();
    configurarCliente({ proveedorToken: () => 'sesion' });
    try {
      await api.fetch('/auth/contexto');
      expect(vistas).toEqual(['Bearer sesion']);
    } finally {
      configurarCliente({
        proveedorToken: undefined,
        alTerminarSesion: undefined,
      });
    }
    await api.fetch('/auth/contexto');
    expect(vistas).toEqual(['Bearer sesion', null]);
  });
});

describe('cancelación (AbortSignal bajo jsdom + MSW)', () => {
  it('pasa la señal al fetch y una cancelación se propaga sin volverse NetworkError', async () => {
    servidor.use(
      http.get('/api/lento', async () => {
        await delay(1000);
        return HttpResponse.json({});
      }),
    );
    const controlador = new AbortController();
    const pendiente = api.fetch('/lento', { signal: controlador.signal });
    controlador.abort();
    const error = await pendiente.catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(NetworkError);
    expect((error as Error).name).toBe('AbortError');
  });

  it('una señal ya cancelada falla sin tocar la red', async () => {
    const error = await api
      .fetch('/auth/contexto', { signal: AbortSignal.abort() })
      .catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(NetworkError);
    expect((error as Error).name).toBe('AbortError');
  });

  it('una señal sin cancelar no estorba a la petición', async () => {
    const controlador = new AbortController();
    expect(
      await api.fetch('/auth/contexto', { signal: controlador.signal }),
    ).toEqual(CONTEXTO_SESION);
  });
});
