import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useEffect } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { z } from 'zod';
import { afterEach, describe, expect, it } from 'vitest';
import { RutaAnonima, RutaProtegida, RutaSeleccion } from '@/app/rutas';
import { EmpresaPage } from '@/features/auth/EmpresaPage';
import { AVISOS } from '@/features/auth/components/textos';
import { LoginPage } from '@/features/auth/LoginPage';
import { api, crearQueryClient, mensajeDeError } from '@/shared/api';
import { reintentarConsulta } from '@/shared/api';
import { crearAlmacenTokens } from '@/shared/sesion/almacenTokens';
import { ESTADO_INICIAL, crearTienda, reducir } from '@/shared/sesion/maquina';
import { SessionProvider } from '@/shared/sesion/SessionProvider';
import {
  useSessionActions,
  useSessionContext,
  type AccionesSesion,
  type SessionState,
} from '@/shared/sesion';
import { ThemeProvider } from '@/shared/tema';
import { CONTEXTO_SESION, EMPRESAS_DISPONIBLES } from '@/test/fixtures';
import { CREDENCIALES, EMPRESA_A, EMPRESA_B } from '@/test/montarSesion';
import { servidor } from '@/test/servidor';
import { ShellLayout } from './ShellLayout';

let acciones: AccionesSesion;
let historial: SessionState['status'][];
/** Lo que la página de prueba llegó a mostrar, en orden. */
let vistos: string[];
let solicitudes: string[];

function Captura() {
  const estado = useSessionContext();
  const actuales = useSessionActions();
  useEffect(() => {
    acciones = actuales;
    if (historial.at(-1) !== estado.status) historial.push(estado.status);
  });
  return null;
}

/**
 * Página interna de prueba: pide `/prueba` con el token de sesión y muestra
 * el dato o el mensaje de error, como lo haría una pantalla real.
 */
function Prueba() {
  const consulta = useQuery({
    queryKey: ['prueba'],
    queryFn: () =>
      api.fetch('/prueba', { schema: z.object({ dato: z.string() }) }),
    retry: false,
  });
  const texto = consulta.data
    ? consulta.data.dato
    : consulta.error
      ? (mensajeDeError(consulta.error, 'general')?.titulo ?? '')
      : 'Cargando prueba';
  useEffect(() => {
    vistos.push(texto);
  }, [texto]);
  return <p data-testid="prueba">{texto}</p>;
}

function tokenDe(request: Request) {
  return request.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
}

/** Un token distinto por empresa; los datos y el contexto lo reflejan. */
function servidorPorEmpresa() {
  servidor.use(
    http.post('/api/auth/empresa/:id', ({ params }) =>
      HttpResponse.json({ token: `token-de-sesion-${String(params.id)}` }),
    ),
    http.get('/api/auth/contexto', ({ request }) => {
      const empresa = tokenDe(request).endsWith(EMPRESA_B)
        ? EMPRESAS_DISPONIBLES[1]
        : EMPRESAS_DISPONIBLES[0];
      return HttpResponse.json({
        ...CONTEXTO_SESION,
        empresa: {
          id: empresa?.id,
          razonSocial: empresa?.razonSocial,
          rfc: empresa?.rfc,
        },
      });
    }),
    http.get('/api/prueba', ({ request }) =>
      HttpResponse.json({ dato: `datos de ${tokenDe(request)}` }),
    ),
  );
}

function fallo(status: number) {
  return HttpResponse.json(
    { statusCode: status, error: 'x', message: 'texto del servidor' },
    { status },
  );
}

afterEach(() => {
  servidor.events.removeAllListeners();
});

/**
 * Árbol real: guardas, páginas de acceso, `ShellLayout` y `SessionProvider`
 * con MSW. Inicia sesión con la empresa A y espera la pantalla interna.
 */
async function montar(ruta = '/bandeja') {
  historial = [];
  vistos = [];
  solicitudes = [];
  servidor.events.on('request:start', ({ request }) => {
    solicitudes.push(`${request.method} ${new URL(request.url).pathname}`);
  });
  const consultas = crearQueryClient();
  consultas.setDefaultOptions({
    queries: {
      retry: reintentarConsulta,
      retryDelay: 0,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  });
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
          {
            element: <ShellLayout />,
            children: [
              {
                path: '/bandeja',
                element: <Prueba />,
                handle: { titulo: 'Bandeja' },
              },
              {
                path: '/casos/9',
                element: <Prueba />,
                handle: { titulo: 'Detalle del caso' },
              },
            ],
          },
        ],
      },
    ],
    { initialEntries: [ruta] },
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
  return { ...vista, router, tienda, almacen, consultas };
}

async function entrarConEmpresa(id: string = EMPRESA_A) {
  await act(() => acciones.iniciarSesion(CREDENCIALES));
  await act(() => acciones.elegirEmpresa(id));
  await waitFor(() => expect(historial.at(-1)).toBe('ready'));
  await screen.findByTestId('prueba');
}

const interruptor = () =>
  screen.getByRole('button', { name: /Cambiar de empresa/ });
const tarjeta = (nombre: RegExp | string) =>
  screen.getByRole('button', { name: nombre });

describe('ShellLayout con la sesión real: cambio de empresa', () => {
  it('abandonar vuelve a la pantalla exacta, con la sesión viva, sin loading y sin pedir el contexto otra vez', async () => {
    servidorPorEmpresa();
    const { router, tienda } = await montar();
    await entrarConEmpresa();
    // El primer acceso fue a /login → /empresa → /bandeja.
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
    await act(() => router.navigate('/casos/9?x=1'));
    await screen.findByTestId('prueba');
    const epoca = tienda.obtener().epoca;
    const antes = historial.length;
    const contextos = () =>
      solicitudes.filter((s) => s === 'GET /api/auth/contexto').length;
    const previos = contextos();

    await userEvent.setup().click(interruptor());
    await screen.findByRole('heading', { level: 1, name: 'Elige empresa' });
    expect(router.state.location.pathname).toBe('/empresa');
    expect(router.state.location.state).toEqual({
      volverA: { pathname: '/casos/9', search: '?x=1' },
    });
    expect(
      screen.getByText(
        'Estás en Ferreteria del Bajio SA de CV. Elige la empresa a la que quieres cambiar.',
      ),
    ).toBeInTheDocument();

    await userEvent
      .setup()
      .click(
        screen.getByRole('button', { name: '← Volver sin cambiar de empresa' }),
      );
    await screen.findByTestId('prueba');
    // Vuelve a la pantalla exacta que se dejó, no a /bandeja.
    expect(router.state.location.pathname).toBe('/casos/9');
    expect(router.state.location.search).toBe('?x=1');
    expect(historial.slice(antes)).not.toContain('loading');
    expect(historial.slice(antes)).not.toContain('anonymous');
    expect(tienda.obtener()).toMatchObject({ fase: 'sesion', epoca });
    expect(contextos()).toBe(previos);
    expect(screen.getByRole('banner')).toHaveTextContent(
      'Ferreteria del Bajio',
    );
  });

  it('Atrás desde /empresa durante un cambio vuelve al paso de empresa, nunca a una página en blanco, y abandonar regresa a la pantalla de origen sin pedir el contexto', async () => {
    servidorPorEmpresa();
    const { router, tienda } = await montar();
    await entrarConEmpresa();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
    await act(() => router.navigate('/casos/9?x=1'));
    await screen.findByTestId('prueba');
    const epoca = tienda.obtener().epoca;
    const contextos = () =>
      solicitudes.filter((s) => s === 'GET /api/auth/contexto').length;
    const previos = contextos();

    await userEvent.setup().click(interruptor());
    await screen.findByRole('heading', { level: 1, name: 'Elige empresa' });
    expect(router.state.location.pathname).toBe('/empresa');

    // Atrás: la ruta interna con el cambio en curso redirige al paso.
    await act(() => router.navigate(-1));
    await screen.findByRole('heading', { level: 1, name: 'Elige empresa' });
    expect(router.state.location.pathname).toBe('/empresa');
    expect(router.state.location.search).toBe('');
    expect(router.state.location.state).toEqual({
      volverA: { pathname: '/casos/9', search: '?x=1' },
    });
    expect(
      screen.getByText(
        'Estás en Ferreteria del Bajio SA de CV. Elige la empresa a la que quieres cambiar.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(tienda.obtener()).toMatchObject({ epoca });

    await userEvent
      .setup()
      .click(
        screen.getByRole('button', { name: '← Volver sin cambiar de empresa' }),
      );
    await screen.findByTestId('prueba');
    expect(router.state.location.pathname).toBe('/casos/9');
    expect(router.state.location.search).toBe('?x=1');
    expect(historial.at(-1)).toBe('ready');
    expect(tienda.obtener()).toMatchObject({ fase: 'sesion', epoca });
    expect(contextos()).toBe(previos);
    expect(screen.getByRole('banner')).toHaveTextContent(
      'Ferreteria del Bajio',
    );
  });

  it('cambiar a otra empresa va a /bandeja y los datos de A no aparecen bajo B', async () => {
    servidorPorEmpresa();
    const { router, consultas } = await montar();
    await entrarConEmpresa();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
    expect(screen.getByTestId('prueba')).toHaveTextContent(
      `datos de token-de-sesion-${EMPRESA_A}`,
    );
    expect(consultas.getQueryData(['prueba'])).toBeDefined();

    await userEvent.setup().click(interruptor());
    await screen.findByRole('heading', { level: 1, name: 'Elige empresa' });
    // Empezar el cambio no toca la caché de la empresa activa.
    expect(consultas.getQueryData(['prueba'])).toBeDefined();
    const antes = vistos.length;

    await userEvent.setup().click(tarjeta(/Abarrotes/));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
    await waitFor(() =>
      expect(screen.getByTestId('prueba')).toHaveTextContent(
        `datos de token-de-sesion-${EMPRESA_B}`,
      ),
    );
    expect(vistos.slice(antes).join('|')).not.toContain(EMPRESA_A);
    expect(screen.getByRole('banner')).toHaveTextContent('Abarrotes del Norte');
    expect(
      (consultas.getQueryData(['prueba']) as { dato: string }).dato,
    ).toContain(EMPRESA_B);
  });

  it('un 401 durante el cambio termina la sesión con el aviso de expiración', async () => {
    servidorPorEmpresa();
    const { router } = await montar();
    await entrarConEmpresa();
    await userEvent.setup().click(interruptor());
    await screen.findByRole('heading', { level: 1, name: 'Elige empresa' });

    servidor.use(http.get('/api/prueba', () => fallo(401)));
    await act(async () => {
      await api.fetch('/prueba').catch(() => undefined);
    });
    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('status')).toHaveTextContent(
      AVISOS.sesion_expirada,
    );
  });

  it('un 401 al pedir la lista lleva a /login con el aviso de reingreso y el correo', async () => {
    servidorPorEmpresa();
    const { router } = await montar();
    await entrarConEmpresa();
    servidor.use(http.get('/api/auth/empresas', () => fallo(401)));
    await userEvent.setup().click(interruptor());
    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('status')).toHaveTextContent(AVISOS.reingreso);
    expect(screen.getByLabelText('Correo')).toHaveValue(CREDENCIALES.email);
  });

  it('un fallo de red al pedir la lista avisa y deja la sesión lista', async () => {
    servidorPorEmpresa();
    const { router, tienda } = await montar();
    await entrarConEmpresa();
    servidor.use(http.get('/api/auth/empresas', () => HttpResponse.error()));
    await userEvent.setup().click(interruptor());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
    expect(router.state.location.pathname).toBe('/bandeja');
    expect(historial.at(-1)).toBe('ready');
    expect(tienda.obtener().fase).toBe('sesion');
    expect(screen.getByTestId('prueba')).toBeInTheDocument();
  });

  it('un 5xx al pedir la lista también deja la sesión lista', async () => {
    servidorPorEmpresa();
    await montar();
    await entrarConEmpresa();
    servidor.use(http.get('/api/auth/empresas', () => fallo(503)));
    await userEvent.setup().click(interruptor());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
    expect(historial.at(-1)).toBe('ready');
  });
});

describe('ShellLayout con la sesión real: cierre de sesión', () => {
  it('lleva a /login con «Cerraste sesión.», sin petición, sin destino y con la caché vacía', async () => {
    servidorPorEmpresa();
    const { router, consultas, almacen } = await montar();
    await entrarConEmpresa();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
    const antes = solicitudes.length;

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    expect(router.state.location.pathname).toBe('/login');
    // Ni destino guardado ni nada más en el estado del enrutador.
    expect(router.state.location.state).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(
      AVISOS.cierre_voluntario,
    );
    expect(solicitudes.slice(antes)).toEqual([]);
    // Puede quedar la consulta del contexto, desactivada y sin datos.
    expect(consultas.getQueryData(['prueba'])).toBeUndefined();
    expect(
      consultas
        .getQueryCache()
        .getAll()
        .filter((consulta) => consulta.state.data !== undefined),
    ).toEqual([]);
    expect(almacen.sesion()).toBeNull();
    expect(almacen.seleccion()).toBeNull();
  });

  it('Atrás y volver a la ruta interna no muestran contenido protegido', async () => {
    servidorPorEmpresa();
    const { router } = await montar();
    await entrarConEmpresa();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    const vistosAntes = vistos.length;

    await act(() => router.navigate(-1));
    await act(() => router.navigate('/bandeja'));
    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    expect(screen.queryByTestId('prueba')).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(vistos.length).toBe(vistosAntes);
  });

  it('el cierre no afirma haber revocado el token', async () => {
    servidorPorEmpresa();
    const { container } = await montar();
    await entrarConEmpresa();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    expect(container.textContent).not.toMatch(/revoc/i);
  });
});

describe('ShellLayout con la sesión real: errores de la API en pantallas internas', () => {
  it('un 403 fuera de /auth/contexto mantiene la sesión y muestra el permiso denegado', async () => {
    servidorPorEmpresa();
    servidor.use(http.get('/api/prueba', () => fallo(403)));
    const { router, tienda } = await montar();
    await act(() => acciones.iniciarSesion(CREDENCIALES));
    await act(() => acciones.elegirEmpresa(EMPRESA_A));
    await waitFor(() =>
      expect(screen.getByTestId('prueba')).toHaveTextContent(
        'No tienes permiso para esta acción.',
      ),
    );
    expect(router.state.location.pathname).toBe('/bandeja');
    expect(tienda.obtener().fase).toBe('sesion');
    expect(historial.at(-1)).toBe('ready');
    expect(screen.queryByText('texto del servidor')).toBeNull();
    expect(solicitudes.filter((s) => s === 'GET /api/prueba')).toHaveLength(1);
  });

  async function expirarYVolver(empresa: string) {
    servidorPorEmpresa();
    const usuario = userEvent.setup();
    const { router } = await montar('/casos/9');
    // Anónimo en una ruta interna: va a /login recordando el destino.
    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    await usuario.type(screen.getByLabelText('Correo'), CREDENCIALES.email);
    await usuario.type(
      screen.getByLabelText('Contraseña'),
      CREDENCIALES.password,
    );
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { level: 1, name: 'Elige empresa' });
    await usuario.click(tarjeta(/Ferreteria/));
    await screen.findByTestId('prueba');
    // Un acceso nuevo (sin sesión previa) vuelve al destino pedido.
    expect(router.state.location.pathname).toBe('/casos/9');

    // La sesión expira en medio de una consulta de la pantalla.
    servidor.use(http.get('/api/prueba', () => fallo(401)));
    await act(async () => {
      await api.fetch('/prueba').catch(() => undefined);
    });
    await screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });
    expect(screen.getByRole('status')).toHaveTextContent(
      AVISOS.sesion_expirada,
    );
    expect(router.state.location.state).toMatchObject({
      from: { pathname: '/casos/9' },
    });

    await usuario.type(screen.getByLabelText('Correo'), CREDENCIALES.email);
    await usuario.type(
      screen.getByLabelText('Contraseña'),
      CREDENCIALES.password,
    );
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { level: 1, name: 'Elige empresa' });
    servidor.use(
      http.get('/api/prueba', ({ request }) =>
        HttpResponse.json({ dato: `datos de ${tokenDe(request)}` }),
      ),
    );
    await usuario.click(
      tarjeta(empresa === EMPRESA_A ? /Ferreteria/ : /Abarrotes/),
    );
    await screen.findByTestId('prueba');
    return router;
  }

  it('tras expirar, la misma empresa vuelve a la pantalla de origen', async () => {
    const router = await expirarYVolver(EMPRESA_A);
    expect(router.state.location.pathname).toBe('/casos/9');
  });

  it('tras expirar, otra empresa va a /bandeja', async () => {
    const router = await expirarYVolver(EMPRESA_B);
    expect(router.state.location.pathname).toBe('/bandeja');
  });
});

describe('ShellLayout con la sesión real: encabezado', () => {
  it('con dos empresas muestra el botón con el nombre y el RFC de la activa', async () => {
    servidorPorEmpresa();
    await montar();
    await entrarConEmpresa();
    const boton = within(screen.getByRole('banner')).getByRole('button', {
      name: /Cambiar de empresa/,
    });
    expect(boton).toHaveTextContent('Ferreteria del Bajio SA de CV');
    expect(boton).toHaveTextContent('FDB190215QK4');
  });

  it('con una sola empresa la insignia es estática y no hay botón de cambio', async () => {
    servidorPorEmpresa();
    servidor.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json({
          token: 'token-de-seleccion',
          usuario: CONTEXTO_SESION.usuario,
          empresas: [EMPRESAS_DISPONIBLES[0]],
        }),
      ),
    );
    await montar();
    await entrarConEmpresa();
    expect(
      screen.queryByRole('button', { name: /Cambiar de empresa/ }),
    ).toBeNull();
    expect(
      screen.getByRole('group', { name: 'Empresa activa' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument();
  });
});
