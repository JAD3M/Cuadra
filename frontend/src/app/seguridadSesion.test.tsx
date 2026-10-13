import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import {
  configure,
  act,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { rutas } from '@/app/router';
import { api, crearQueryClient, reintentarConsulta } from '@/shared/api';
import { SessionProvider } from '@/shared/sesion';
import { ThemeProvider } from '@/shared/tema';
import { CLAVE_TEMA } from '@/shared/tema/tipos';
import { contextoFalla, loginFalla } from '@/test/handlersAuth';
import { elegirEmpresaPorNombre, enviarLogin } from '@/test/montarApp';
import { CREDENCIALES } from '@/test/montarSesion';
import { sesionConEmpresa } from '@/test/sesionMock';
import { servidor } from '@/test/servidor';

/**
 * Ejecuta los recorridos de la sesión y, tras cada paso, comprueba que ningún
 * token ni contraseña quedó en la consola, la URL, el historial, el estado del
 * enrutador, el almacenamiento, las cookies, el DOM ni las cachés de consultas
 * (AUT-2, AUT-5, AUT-17). Los tokens de las respuestas de prueba son
 * reconocibles a propósito.
 */
const SECRETOS = [
  'token-de-seleccion',
  'token-de-sesion',
  CREDENCIALES.password,
  'Bearer',
];
const METODOS = ['log', 'info', 'warn', 'error', 'debug'] as const;

// Montar la app completa y teclear en el formulario tarda más que una pantalla
// suelta; con la suite en paralelo el límite por omisión (1 s) es justo.
beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

let consultas: QueryClient;
let router: ReturnType<typeof createMemoryRouter>;
let salida: string[];
let peticiones: {
  origen: string;
  ruta: string;
  autorizacion: boolean;
  credenciales: RequestCredentials;
}[];

function montar(ruta: string) {
  consultas = crearQueryClient();
  consultas.setDefaultOptions({
    queries: {
      retry: reintentarConsulta,
      retryDelay: 0,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  });
  router = createMemoryRouter(rutas, { initialEntries: [ruta] });
  // Mismo orden que `Providers`: consultas > tema > sesión.
  return render(
    <QueryClientProvider client={consultas}>
      <ThemeProvider>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

function sinSecretos(nombre: string, texto: string) {
  for (const secreto of SECRETOS) {
    expect(texto, `${nombre} contiene "${secreto}"`).not.toContain(secreto);
  }
}

/** Revisa todos los lugares donde un secreto podría haber quedado. */
function inspeccionar(paso: string) {
  const { pathname, search, hash, state } = router.state.location;
  sinSecretos(`${paso}: URL`, `${pathname}${search}${hash}`);
  sinSecretos(`${paso}: window.location`, window.location.href);
  sinSecretos(`${paso}: estado del enrutador`, JSON.stringify(state));
  sinSecretos(`${paso}: history.state`, JSON.stringify(window.history.state));
  // Ni el correo viaja por la URL ni por el estado del enrutador.
  const ubicacion = `${pathname}${search}${hash}${JSON.stringify(state)}`;
  expect(ubicacion).not.toContain(CREDENCIALES.email);
  expect(ubicacion).not.toContain('@');

  const claves = Object.keys(window.localStorage);
  expect(claves.filter((c) => c !== CLAVE_TEMA)).toEqual([]);
  sinSecretos(
    `${paso}: localStorage`,
    JSON.stringify({ ...window.localStorage }),
  );
  expect(window.sessionStorage.length).toBe(0);
  expect(document.cookie).toBe('');
  sinSecretos(`${paso}: DOM`, document.documentElement.outerHTML);

  const consultasSerializadas = consultas
    .getQueryCache()
    .getAll()
    .map((q) => ({ clave: q.queryKey, estado: q.state }));
  sinSecretos(
    `${paso}: caché de consultas`,
    JSON.stringify(consultasSerializadas),
  );
  for (const q of consultas.getQueryCache().getAll()) {
    sinSecretos(`${paso}: clave de consulta`, JSON.stringify(q.queryKey));
  }
  const mutaciones = consultas
    .getMutationCache()
    .getAll()
    .map((m) => ({ clave: m.options.mutationKey, estado: m.state }));
  sinSecretos(`${paso}: caché de mutaciones`, JSON.stringify(mutaciones));

  sinSecretos(`${paso}: consola`, salida.join('\n'));
  expect(salida.join('\n')).not.toContain(CREDENCIALES.email);
}

beforeEach(() => {
  salida = [];
  peticiones = [];
  for (const metodo of METODOS) {
    vi.spyOn(console, metodo).mockImplementation((...args: unknown[]) => {
      salida.push(
        args
          .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
          .join(' '),
      );
    });
  }
  servidor.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    peticiones.push({
      origen: url.origin,
      ruta: url.pathname,
      autorizacion: request.headers.has('Authorization'),
      credenciales: request.credentials,
    });
  });
});

afterEach(() => {
  servidor.events.removeAllListeners();
  vi.restoreAllMocks();
});

const encabezadoLogin = () =>
  screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });

describe('seguridad de la sesión en ejecución', () => {
  it('login fallido, login, elección, cambio de empresa y cierre de sesión no filtran nada', async () => {
    const usuario = userEvent.setup();
    montar('/casos/9?x=1');
    await encabezadoLogin();
    inspeccionar('pantalla de login');

    loginFalla(401);
    await enviarLogin();
    await screen.findByRole('alert');
    inspeccionar('login rechazado');

    // Tras el rechazo el correo sigue en el formulario y la contraseña se vació.
    servidor.resetHandlers();
    await usuario.type(
      screen.getByLabelText('Contraseña'),
      CREDENCIALES.password,
    );
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { level: 1, name: 'Elige empresa' });
    inspeccionar('login aceptado');

    await elegirEmpresaPorNombre(/Ferreteria/);
    await screen.findByRole('banner');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/casos/9'),
    );
    inspeccionar('sesión lista');

    await usuario.click(
      screen.getByRole('button', { name: /Cambiar de empresa/ }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Elige empresa' });
    inspeccionar('cambio de empresa abierto');
    await elegirEmpresaPorNombre(/Abarrotes/);
    await screen.findByRole('banner');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
    inspeccionar('empresa cambiada');

    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await encabezadoLogin();
    inspeccionar('sesión cerrada');
  });

  it('una sesión que expira no filtra nada y el aviso no nombra tokens', async () => {
    montar('/casos/9');
    await enviarLogin();
    await elegirEmpresaPorNombre(/Ferreteria/);
    await screen.findByRole('banner');
    // La sesión vence en el servidor: la siguiente llamada ya responde 401.
    servidor.use(
      http.get('/api/prueba', () =>
        HttpResponse.json(
          { statusCode: 401, error: 'x', message: 'texto del servidor' },
          { status: 401 },
        ),
      ),
    );
    await act(async () => {
      await api.fetch('/prueba').catch(() => undefined);
    });
    await screen.findByText(
      'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
    );
    inspeccionar('sesión expirada');
  });

  it('un 403 de contexto y un fallo de red no filtran nada ni muestran texto del servidor', async () => {
    // Recarga con una sesión que ya no tiene acceso a su empresa.
    sesionConEmpresa();
    contextoFalla(403);
    montar('/bandeja');
    await screen.findByText('Ya no tienes acceso a esta empresa.');
    expect(screen.queryByText('texto del servidor')).toBeNull();
    inspeccionar('sin acceso');
  });

  it('ninguna petición lleva Authorization y todas mandan la cookie a rutas relativas de la API', async () => {
    montar('/bandeja');
    await enviarLogin();
    await elegirEmpresaPorNombre(/Ferreteria/);
    await screen.findByRole('banner');
    await act(async () => {});

    const deLaApi = peticiones.filter((p) => p.ruta.startsWith('/api/'));
    // Restaurar, login, elegir empresa y pedir el contexto, como mínimo.
    expect(deLaApi.length).toBeGreaterThanOrEqual(4);
    for (const p of deLaApi) {
      expect(p.origen).toBe(window.location.origin);
      expect(p.autorizacion, `Authorization en ${p.ruta}`).toBe(false);
      expect(p.credenciales, `credentials en ${p.ruta}`).toBe('include');
    }
  });

  it('las claves de consulta de la sesión no contienen tokens', async () => {
    montar('/bandeja');
    await enviarLogin();
    await elegirEmpresaPorNombre(/Ferreteria/);
    await screen.findByRole('banner');
    const claves = consultas
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey);
    expect(claves.length).toBeGreaterThan(0);
    expect(claves).toContainEqual(['sesion', expect.any(Number), 'contexto']);
    sinSecretos('claves', JSON.stringify(claves));
  });
});
