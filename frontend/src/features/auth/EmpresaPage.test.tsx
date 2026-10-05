import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useEffect } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RutaAnonima, RutaProtegida, RutaSeleccion } from '@/app/rutas';
import { crearQueryClient, reintentarConsulta } from '@/shared/api';
import { crearAlmacenTokens } from '@/shared/sesion/almacenTokens';
import { ESTADO_INICIAL, crearTienda, reducir } from '@/shared/sesion/maquina';
import { SessionProvider } from '@/shared/sesion/SessionProvider';
import type { AccionesSesion, SessionState } from '@/shared/sesion';
import {
  SessionStateProvider,
  useSessionActions,
  useSessionContext,
} from '@/shared/sesion';
import { ThemeProvider } from '@/shared/tema';
import {
  CONTEXTO_SESION,
  EMPRESAS_DISPONIBLES,
  RESPUESTA_LOGIN,
  USUARIO,
} from '@/test/fixtures';
import { CREDENCIALES, EMPRESA_A, EMPRESA_B } from '@/test/montarSesion';
import { servidor } from '@/test/servidor';
import { AVISOS } from './components/textos';
import { EmpresaPage } from './EmpresaPage';
import { LoginPage } from './LoginPage';

let acciones: AccionesSesion;
let historial: SessionState['status'][];

function Captura() {
  const estado = useSessionContext();
  const actuales = useSessionActions();
  useEffect(() => {
    acciones = actuales;
    if (historial.at(-1) !== estado.status) historial.push(estado.status);
  });
  return null;
}

function error(status: number) {
  return HttpResponse.json(
    { statusCode: status, error: 'x', message: 'texto del servidor' },
    { status },
  );
}

function responderLogin(cuerpo: object = RESPUESTA_LOGIN) {
  servidor.use(http.post('/api/auth/login', () => HttpResponse.json(cuerpo)));
}

function eleccionesPeticiones() {
  const cabeceras: (string | null)[] = [];
  servidor.events.on('request:start', ({ request }) => {
    if (
      request.method === 'POST' &&
      new URL(request.url).pathname.startsWith('/api/auth/empresa/')
    ) {
      cabeceras.push(request.headers.get('Authorization'));
    }
  });
  return cabeceras;
}

afterEach(() => {
  servidor.events.removeAllListeners();
  vi.restoreAllMocks();
});

/**
 * Monta el árbol real (guardas, páginas y `SessionProvider` con MSW) y deja
 * la sesión en `selecting`. En modo `cambio` primero entra a la sesión con la
 * empresa A y luego pide cambiarla.
 */
async function montar(
  modo: 'login' | 'cambio' = 'login',
  volverA?: { pathname: string; search?: string },
) {
  const consultas = crearQueryClient();
  consultas.setDefaultOptions({
    queries: {
      retry: reintentarConsulta,
      retryDelay: 0,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  });
  historial = [];
  const almacen = crearAlmacenTokens();
  const tienda = crearTienda(reducir, ESTADO_INICIAL);
  const router = createMemoryRouter(
    [
      {
        element: <RutaAnonima />,
        children: [{ path: '/login', element: <LoginPage /> }],
      },
      {
        element: <RutaSeleccion />,
        children: [{ path: '/empresa', element: <EmpresaPage /> }],
      },
      {
        element: <RutaProtegida />,
        children: [
          { path: '/bandeja', element: <p>Bandeja</p> },
          { path: '/casos/9', element: <p>Detalle del caso</p> },
        ],
      },
    ],
    { initialEntries: ['/login'] },
  );
  const vista = render(
    <QueryClientProvider client={consultas}>
      <ThemeProvider>
        <SessionProvider almacen={almacen} tienda={tienda}>
          <Captura />
          <RouterProvider router={router} />
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );

  await act(() => acciones.iniciarSesion(CREDENCIALES));
  if (modo === 'cambio') {
    await act(() => acciones.elegirEmpresa(EMPRESA_A));
    await screen.findByText('Bandeja');
    await waitFor(() => expect(tienda.obtener().fase).toBe('sesion'));
    await waitFor(() =>
      expect(consultas.getQueryData(['sesion', 1, 'contexto'])).toBeTruthy(),
    );
    await act(() => acciones.cambiarEmpresa());
    await act(() =>
      router.navigate('/empresa', volverA ? { state: { volverA } } : undefined),
    );
  }
  await screen.findByRole('heading', { level: 1, name: 'Elige empresa' });
  return { ...vista, router, tienda, almacen, consultas };
}

const tarjeta = (nombre: RegExp | string) =>
  screen.getByRole('button', { name: nombre });

describe('EmpresaPage: estructura', () => {
  it('es el paso 2: un main, un h1, el control de tema y la lista', async () => {
    await montar();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Paso 2 de 2')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('enfoca el h1 al entrar', async () => {
    await montar();
    const titulo = screen.getByRole('heading', { level: 1 });
    expect(titulo).toHaveAttribute('tabindex', '-1');
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it('saluda con la primera palabra del nombre y el número de empresas', async () => {
    await montar();
    expect(
      screen.getByText('Hola, Jorge. Tienes acceso a dos empresas.'),
    ).toBeInTheDocument();
  });

  it('cada empresa muestra razón social, RFC y sus roles etiquetados', async () => {
    await montar();
    const primera = tarjeta(/Ferreteria del Bajio SA de CV/);
    expect(primera).toHaveTextContent('FDB190215QK4');
    expect(primera).toHaveTextContent('Administrador');
    expect(primera).toHaveTextContent('Contador');
    expect(tarjeta(/Abarrotes del Norte/)).toHaveTextContent('Revisor');
  });

  it('un usuario con una sola empresa ve el paso y no se elige solo', async () => {
    responderLogin({
      ...RESPUESTA_LOGIN,
      empresas: [EMPRESAS_DISPONIBLES[1]],
    });
    const elecciones = eleccionesPeticiones();
    await montar();
    expect(
      screen.getByText('Hola, Jorge. Tienes acceso a una empresa.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /SA de CV/ })).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 30));
    expect(elecciones).toEqual([]);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it.each([
    [['revisor', 'admin', 'contador']],
    [['contador', 'revisor', 'admin']],
    [['revisor', 'contador', 'admin']],
  ])('ordena los roles %j como admin, contador, revisor', async (roles) => {
    responderLogin({
      ...RESPUESTA_LOGIN,
      empresas: [{ ...EMPRESAS_DISPONIBLES[0], roles }],
    });
    await montar();
    const chips = within(tarjeta(/Ferreteria/))
      .getAllByText(/Administrador|Contador|Revisor/)
      .map((chip) => chip.textContent);
    expect(chips).toEqual(['Administrador', 'Contador', 'Revisor']);
  });
});

describe('EmpresaPage: elegir empresa', () => {
  it('canjea el token de selección y deja la sesión en marcha', async () => {
    const elecciones = eleccionesPeticiones();
    const { router, tienda } = await montar();
    await userEvent.setup().click(tarjeta(/Ferreteria/));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
    expect(elecciones).toEqual(['Bearer token-de-seleccion']);
    expect(tienda.obtener().fase).toBe('sesion');
  });

  it('con Enter también elige', async () => {
    const { tienda } = await montar();
    const usuario = userEvent.setup();
    tarjeta(/Ferreteria/).focus();
    await usuario.keyboard('{Enter}');
    await waitFor(() => expect(tienda.obtener().fase).toBe('sesion'));
  });

  it('mientras la petición está en curso anuncia "Entrando…", inactiva el resto y un segundo clic no sale', async () => {
    let soltar: () => void = () => {};
    const espera = new Promise<void>((r) => (soltar = r));
    let peticiones = 0;
    servidor.use(
      http.post('/api/auth/empresa/:id', async () => {
        peticiones += 1;
        await espera;
        return HttpResponse.json({ token: 'token-de-sesion' });
      }),
    );
    await montar();
    const usuario = userEvent.setup();
    await usuario.click(tarjeta(/Ferreteria/));

    await waitFor(() =>
      expect(tarjeta(/Ferreteria/)).toHaveTextContent('Entrando…'),
    );
    expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true');
    expect(tarjeta(/Abarrotes/)).toHaveAttribute('aria-disabled', 'true');
    await usuario.click(tarjeta(/Ferreteria/));
    await usuario.click(tarjeta(/Abarrotes/));
    expect(peticiones).toBe(1);

    await act(async () => soltar());
    await screen.findByText('Bandeja');
    expect(peticiones).toBe(1);
  });
});

describe('EmpresaPage: fallos al elegir', () => {
  it('con un 403 avisa, enfoca la alerta y deja la lista refrescada', async () => {
    servidor.use(
      http.post('/api/auth/empresa/:id', () => error(403)),
      http.get('/api/auth/empresas', () =>
        HttpResponse.json([EMPRESAS_DISPONIBLES[1]]),
      ),
    );
    const { router, tienda } = await montar();
    await userEvent.setup().click(tarjeta(/Ferreteria/));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Ya no tienes acceso a esta empresa.');
    expect(alerta).toHaveTextContent('Elige otra de la lista.');
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(document.body.textContent).not.toContain('texto del servidor');
    expect(router.state.location.pathname).toBe('/empresa');
    expect(tienda.obtener().fase).toBe('selecting');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText(/Ferreteria/)).not.toBeInTheDocument();
    expect(
      screen.getByText('Hola, Jorge. Tienes acceso a una empresa.'),
    ).toBeInTheDocument();
  });

  it('tras un 403 se puede elegir otra empresa y la alerta desaparece', async () => {
    servidor.use(
      http.post('/api/auth/empresa/:id', ({ params }) =>
        params.id === EMPRESA_A
          ? error(403)
          : HttpResponse.json({ token: 'token-de-sesion' }),
      ),
    );
    const { tienda } = await montar();
    const usuario = userEvent.setup();
    await usuario.click(tarjeta(/Ferreteria/));
    await screen.findByRole('alert');
    await usuario.click(tarjeta(/Abarrotes/));
    await waitFor(() => expect(tienda.obtener().fase).toBe('sesion'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('con un 403 y la lista vacía vuelve al paso 1 con el aviso de sin empresas', async () => {
    servidor.use(
      http.post('/api/auth/empresa/:id', () => error(403)),
      http.get('/api/auth/empresas', () => HttpResponse.json([])),
    );
    const { router } = await montar();
    await userEvent.setup().click(tarjeta(/Ferreteria/));

    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('status')).toHaveTextContent(AVISOS.sin_empresas);
    expect(screen.getByLabelText('Correo')).toHaveValue(CREDENCIALES.email);
  });

  it('con un 401 va a /login con el aviso de selección vencida y el correo', async () => {
    servidor.use(http.post('/api/auth/empresa/:id', () => error(401)));
    const { router } = await montar();
    await userEvent.setup().click(tarjeta(/Ferreteria/));

    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('status')).toHaveTextContent(
      AVISOS.seleccion_vencida,
    );
    expect(screen.getByLabelText('Correo')).toHaveValue(CREDENCIALES.email);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['un error 500', () => error(500)],
    ['un fallo de red', () => HttpResponse.error()],
    ['una respuesta fuera de contrato', () => HttpResponse.json({ otro: 1 })],
  ])(
    'con %s muestra el mensaje de conexión y conserva la lista',
    async (_nombre, respuesta) => {
      servidor.use(http.post('/api/auth/empresa/:id', respuesta));
      const { tienda, router } = await montar();
      await userEvent.setup().click(tarjeta(/Ferreteria/));

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
      expect(alerta).toHaveTextContent('Inténtalo de nuevo.');
      await waitFor(() => expect(alerta).toHaveFocus());
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
      expect(tarjeta(/Ferreteria/)).not.toHaveAttribute('aria-disabled');
      expect(tienda.obtener().fase).toBe('selecting');
      expect(router.state.location.pathname).toBe('/empresa');
    },
  );

  it('un rol desconocido es un fallo de contrato en el login: alerta de conexión y sin lista', async () => {
    responderLogin({
      ...RESPUESTA_LOGIN,
      empresas: [{ ...EMPRESAS_DISPONIBLES[0], roles: ['superuser'] }],
    });
    const consultas = crearQueryClient();
    const router = createMemoryRouter(
      [
        {
          element: <RutaAnonima />,
          children: [{ path: '/login', element: <LoginPage /> }],
        },
        {
          element: <RutaSeleccion />,
          children: [{ path: '/empresa', element: <EmpresaPage /> }],
        },
      ],
      { initialEntries: ['/login'] },
    );
    const tienda = crearTienda(reducir, ESTADO_INICIAL);
    render(
      <QueryClientProvider client={consultas}>
        <ThemeProvider>
          <SessionProvider almacen={crearAlmacenTokens()} tienda={tienda}>
            <RouterProvider router={router} />
          </SessionProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    );
    const usuario = userEvent.setup();
    await usuario.type(screen.getByLabelText('Correo'), CREDENCIALES.email);
    await usuario.type(screen.getByLabelText('Contraseña'), 'secreta-1');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(router.state.location.pathname).toBe('/login');
    expect(tienda.obtener().fase).toBe('anonymous');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('EmpresaPage: Cambiar de cuenta', () => {
  it('vuelve a /login con el correo vacío y enfocado', async () => {
    const { router, tienda, almacen } = await montar();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '← Cambiar de cuenta' }));

    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    expect(router.state.location.pathname).toBe('/login');
    expect(tienda.obtener().fase).toBe('anonymous');
    expect(almacen.seleccion()).toBeNull();
    const correo = screen.getByLabelText('Correo');
    expect(correo).toHaveValue('');
    await waitFor(() => expect(correo).toHaveFocus());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('no se puede volver a /empresa después', async () => {
    const { router } = await montar();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '← Cambiar de cuenta' }));
    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });

    await act(() => router.navigate('/empresa'));
    expect(router.state.location.pathname).toBe('/login');
    expect(
      screen.queryByRole('heading', { name: 'Elige empresa' }),
    ).not.toBeInTheDocument();
  });
});

describe('EmpresaPage: cambio de empresa', () => {
  it('saluda con la empresa activa, sin repetir el saludo del login', async () => {
    await montar('cambio');
    expect(
      screen.getByText(
        'Estás en Ferreteria del Bajio SA de CV. Elige la empresa a la que quieres cambiar.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Tienes acceso/)).not.toBeInTheDocument();
  });

  it('el enlace dice "← Volver sin cambiar de empresa" y no "Cambiar de cuenta"', async () => {
    await montar('cambio');
    expect(
      screen.getByRole('button', { name: '← Volver sin cambiar de empresa' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '← Cambiar de cuenta' }),
    ).not.toBeInTheDocument();
  });

  it('abandonar vuelve a la sesión viva sin pasar por loading ni pedir nada (sin destino: /bandeja)', async () => {
    const elecciones = eleccionesPeticiones();
    const { router, tienda, almacen } = await montar('cambio');
    const epoca = tienda.obtener().epoca;
    const antes = historial.length;
    await userEvent
      .setup()
      .click(
        screen.getByRole('button', { name: '← Volver sin cambiar de empresa' }),
      );

    await screen.findByText('Bandeja');
    expect(router.state.location.pathname).toBe('/bandeja');
    expect(tienda.obtener().fase).toBe('sesion');
    expect(tienda.obtener().epoca).toBe(epoca);
    expect(almacen.sesion()).toBe('token-de-sesion');
    expect(historial.slice(antes)).not.toContain('loading');
    expect(elecciones).toEqual(['Bearer token-de-seleccion']);
  });

  it('abandonar vuelve a la pantalla exacta que se dejó, aún con la sesión', async () => {
    const { router, tienda } = await montar('cambio', {
      pathname: '/casos/9',
      search: '?x=1',
    });
    const antes = historial.length;
    await userEvent
      .setup()
      .click(
        screen.getByRole('button', { name: '← Volver sin cambiar de empresa' }),
      );

    await screen.findByText('Detalle del caso');
    expect(router.state.location.pathname).toBe('/casos/9');
    expect(router.state.location.search).toBe('?x=1');
    expect(tienda.obtener().fase).toBe('sesion');
    expect(historial.slice(antes)).not.toContain('loading');
    expect(historial.slice(antes)).not.toContain('anonymous');
  });

  it('un destino de retorno hostil se ignora y se vuelve a /bandeja', async () => {
    const { router } = await montar('cambio', { pathname: '//evil.com' });
    await userEvent
      .setup()
      .click(
        screen.getByRole('button', { name: '← Volver sin cambiar de empresa' }),
      );
    await screen.findByText('Bandeja');
    expect(router.state.location.pathname).toBe('/bandeja');
  });

  it('elegir la empresa activa equivale a abandonar y vuelve a la pantalla que se dejó', async () => {
    const elecciones = eleccionesPeticiones();
    const { tienda, router } = await montar('cambio', {
      pathname: '/casos/9',
    });
    const antes = elecciones.length;
    await userEvent.setup().click(tarjeta(/Ferreteria/));
    await screen.findByText('Detalle del caso');
    expect(router.state.location.pathname).toBe('/casos/9');
    expect(tienda.obtener().fase).toBe('sesion');
    expect(elecciones.length).toBe(antes);
  });

  it('elegir otra empresa va a /bandeja aunque haya un destino de retorno y vacía la caché de la anterior', async () => {
    const { router, tienda, consultas } = await montar('cambio', {
      pathname: '/casos/9',
    });
    consultas.setQueryData(['dato-ajeno'], 'privado');
    await userEvent.setup().click(tarjeta(/Abarrotes/));
    await waitFor(() => expect(tienda.obtener().epoca).toBe(2));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
    expect(consultas.getQueryData(['dato-ajeno'])).toBeUndefined();
    expect(tienda.obtener()).toMatchObject({
      fase: 'sesion',
      empresaId: EMPRESA_B,
    });
  });

  it('un 401 al elegir pide volver a ingresar con el aviso de reingreso', async () => {
    const { router } = await montar('cambio');
    servidor.use(http.post('/api/auth/empresa/:id', () => error(401)));
    await userEvent.setup().click(tarjeta(/Abarrotes/));

    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('status')).toHaveTextContent(AVISOS.reingreso);
    expect(screen.getByLabelText('Correo')).toHaveValue(CREDENCIALES.email);
  });

  it('un fallo de red al elegir deja el cambio abierto y se puede abandonar', async () => {
    const { tienda } = await montar('cambio');
    servidor.use(
      http.post('/api/auth/empresa/:id', () => HttpResponse.error()),
    );
    const usuario = userEvent.setup();
    await usuario.click(tarjeta(/Abarrotes/));
    await screen.findByRole('alert');
    expect(tienda.obtener()).toMatchObject({ fase: 'selecting' });
    await usuario.click(
      screen.getByRole('button', { name: '← Volver sin cambiar de empresa' }),
    );
    await waitFor(() => expect(tienda.obtener().fase).toBe('sesion'));
  });
});

describe('EmpresaPage: privacidad', () => {
  it('ningún token queda en el DOM, la ruta ni la caché', async () => {
    const { router, consultas } = await montar();
    await userEvent.setup().click(tarjeta(/Ferreteria/));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
    const rastro = [
      JSON.stringify(router.state),
      JSON.stringify(window.history.state),
      JSON.stringify(consultas.getQueryCache().getAll()),
      JSON.stringify(consultas.getMutationCache().getAll()),
      document.body.innerHTML,
    ].join('\n');
    expect(rastro).not.toContain('token-de-seleccion');
    expect(rastro).not.toContain('token-de-sesion');
    expect(CONTEXTO_SESION.empresa.id).toBe(EMPRESA_A);
  });

  it('la consola queda en silencio en todo el flujo', async () => {
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (m) => vi.spyOn(console, m).mockImplementation(() => {}),
    );
    servidor.use(http.post('/api/auth/empresa/:id', () => error(403)));
    await montar();
    await userEvent.setup().click(tarjeta(/Ferreteria/));
    await screen.findByRole('alert');
    for (const espia of espias) expect(espia).not.toHaveBeenCalled();
  });
});

describe('EmpresaPage: saludo neutro', () => {
  it('lee la empresa activa del estado, no de la caché de consultas', () => {
    const inertes = new Proxy({} as AccionesSesion, {
      get: () => () => {},
    });
    const consultas = crearQueryClient();
    // Un contexto ajeno en la caché no debe influir en el saludo.
    consultas.setQueryData(['sesion', 1, 'contexto'], {
      empresa: { razonSocial: 'Empresa de la caché' },
    });
    render(
      <QueryClientProvider client={consultas}>
        <ThemeProvider>
          <SessionStateProvider
            acciones={inertes}
            estado={{
              status: 'selecting',
              origen: 'cambio',
              usuario: USUARIO,
              empresas: [],
              empresaActual: {
                id: 'e-1',
                razonSocial: 'Empresa del estado SA',
                rfc: 'AAA010101AAA',
              },
            }}
          >
            <EmpresaPage />
          </SessionStateProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    );
    expect(
      screen.getByText(
        'Estás en Empresa del estado SA. Elige la empresa a la que quieres cambiar.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Empresa de la caché/)).not.toBeInTheDocument();
  });

  it('en un cambio sin la empresa activa en el estado el saludo no nombra empresa', () => {
    const inertes = new Proxy({} as AccionesSesion, {
      get: () => () => {},
    });
    render(
      <QueryClientProvider client={crearQueryClient()}>
        <ThemeProvider>
          <SessionStateProvider
            acciones={inertes}
            estado={{
              status: 'selecting',
              origen: 'cambio',
              usuario: USUARIO,
              empresas: [],
            }}
          >
            <EmpresaPage />
          </SessionStateProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    );
    expect(
      screen.getByText('Elige la empresa a la que quieres cambiar.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Estás en/)).not.toBeInTheDocument();
  });
});
