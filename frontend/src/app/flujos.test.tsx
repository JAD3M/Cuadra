import { configure, act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AVISOS } from '@/features/auth/components/textos';
import {
  contextoFalla,
  empresasFalla,
  espiarSolicitudes,
  seleccionFalla,
} from '@/test/handlersAuth';
import {
  elegirEmpresaPorNombre,
  entrarALaApp,
  enviarLogin,
  montarApp,
} from '@/test/montarApp';
import { servidor } from '@/test/servidor';

// Montar la app completa y teclear en el formulario tarda más que una pantalla
// suelta; con la suite en paralelo el límite por omisión (1 s) es justo.
beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

let espia: ReturnType<typeof espiarSolicitudes> | null = null;

afterEach(() => {
  espia?.detener();
  espia = null;
  vi.useRealTimers();
});

const cerrarSesion = () =>
  screen.getByRole('button', { name: 'Cerrar sesión' });
const cambiarEmpresa = () =>
  screen.getByRole('button', { name: /Cambiar de empresa/ });
const encabezadoLogin = () =>
  screen.findByRole('heading', { level: 1, name: 'Inicia sesión' });

describe('flujos: entrada', () => {
  it('un enlace profundo sin sesión pasa por login y empresa y vuelve a él', async () => {
    const { router } = montarApp('/casos/9?x=1');
    await encabezadoLogin();
    expect(router.state.location.pathname).toBe('/login');
    // El destino viaja en el estado del historial, nunca en la URL.
    expect(router.state.location.search).toBe('');

    await entrarALaApp();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/casos/9'),
    );
    expect(router.state.location.search).toBe('?x=1');
  });

  it('/login directo, sin destino, termina en /bandeja', async () => {
    const { router } = montarApp('/login');
    await entrarALaApp();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
  });

  it('una página recién cargada equivale a recargar: sin sesión y con el destino de la URL', async () => {
    const primero = montarApp('/casos/9');
    await entrarALaApp();
    await waitFor(() =>
      expect(primero.router.state.location.pathname).toBe('/casos/9'),
    );
    primero.unmount();

    const { router } = montarApp('/casos/9');
    await encabezadoLogin();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.state).toMatchObject({
      from: { pathname: '/casos/9' },
    });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it.each([
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '/a/../login',
  ])(
    'un destino hostil %s en el estado se ignora y se entra por /bandeja',
    async (pathname) => {
      const { router } = montarApp({
        pathname: '/login',
        state: { from: { pathname } },
      });
      await entrarALaApp();
      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/bandeja'),
      );
      expect(router.state.location.pathname).not.toContain('evil');
    },
  );
});

describe('flujos: fin de sesión', () => {
  it('un 403 al pedir el contexto lleva a /login con el aviso y sin una segunda petición', async () => {
    espia = espiarSolicitudes();
    contextoFalla(403);
    const { router } = montarApp('/casos/9');
    await enviarLogin();
    await elegirEmpresaPorNombre(/Ferreteria/);

    await screen.findByText(AVISOS.sin_acceso);
    expect(router.state.location.pathname).toBe('/login');
    // sin_acceso no guarda destino de retorno.
    expect(router.state.location.state ?? {}).not.toHaveProperty('from');
    expect(espia.cuantas('GET', '/api/auth/contexto')).toBe(1);
  });

  it('tras expirar, la misma empresa vuelve al origen', async () => {
    contextoFalla(401);
    const { router } = montarApp('/casos/9?x=1');
    await enviarLogin();
    await elegirEmpresaPorNombre(/Ferreteria/);
    await screen.findByText(AVISOS.sesion_expirada);
    expect(router.state.location.pathname).toBe('/login');

    servidor.resetHandlers();
    await enviarLogin();
    await elegirEmpresaPorNombre(/Ferreteria/);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/casos/9'),
    );
    expect(router.state.location.search).toBe('?x=1');
  });

  it('tras expirar, otra empresa va a /bandeja', async () => {
    contextoFalla(401);
    const { router } = montarApp('/casos/9');
    await enviarLogin();
    await elegirEmpresaPorNombre(/Ferreteria/);
    await screen.findByText(AVISOS.sesion_expirada);

    servidor.resetHandlers();
    await enviarLogin();
    await elegirEmpresaPorNombre(/Abarrotes/);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
  });

  it('con la sesión abierta no hay avisos, cuenta regresiva ni renovación tras 14 minutos de inactividad', async () => {
    const { router } = montarApp('/bandeja');
    await entrarALaApp();
    espia = espiarSolicitudes();

    vi.useFakeTimers();
    await act(() => vi.advanceTimersByTimeAsync(14 * 60 * 1000));
    vi.useRealTimers();

    expect(router.state.location.pathname).toBe('/bandeja');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/expira|renov|segundos|minutos/i)).toBeNull();
    expect(espia.solicitudes).toEqual([]);
  });
});

describe('flujos: cerrar sesión', () => {
  it('es local: sin peticiones, sin hablar de revocación y con el aviso', async () => {
    const { router } = montarApp('/bandeja');
    await entrarALaApp();
    espia = espiarSolicitudes();

    await userEvent.setup().click(cerrarSesion());
    await screen.findByText(AVISOS.cierre_voluntario);
    expect(router.state.location.pathname).toBe('/login');
    expect(espia.solicitudes).toEqual([]);
    expect(screen.queryByText(/revoc/i)).toBeNull();
  });

  it('Atrás no devuelve al interior', async () => {
    const { router } = montarApp('/bandeja');
    await entrarALaApp();
    await userEvent.setup().click(cerrarSesion());
    await encabezadoLogin();

    await act(() => router.navigate(-1));
    await encabezadoLogin();
    expect(router.state.location.pathname).toMatch(/^\/(login|empresa)$/);
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('no deja un destino viejo: el siguiente acceso entra por /bandeja', async () => {
    const { router } = montarApp('/casos/9');
    await entrarALaApp();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/casos/9'),
    );
    await userEvent.setup().click(cerrarSesion());
    await encabezadoLogin();
    expect(router.state.location.state ?? {}).not.toHaveProperty('from');

    await entrarALaApp();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
  });

  it('el aviso se muestra una sola vez', async () => {
    const { router } = montarApp('/bandeja');
    await entrarALaApp();
    await userEvent.setup().click(cerrarSesion());
    await screen.findByText(AVISOS.cierre_voluntario);

    await act(() => router.navigate('/__kit'));
    await act(() => router.navigate('/login'));
    await encabezadoLogin();
    expect(screen.queryByText(AVISOS.cierre_voluntario)).toBeNull();
  });
});

describe('flujos: cambio de empresa', () => {
  it('abandonar vuelve a la pantalla exacta, con la sesión', async () => {
    const { router } = montarApp('/casos/9?x=1');
    await entrarALaApp();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/casos/9'),
    );

    const usuario = userEvent.setup();
    await usuario.click(cambiarEmpresa());
    await screen.findByRole('heading', { level: 1, name: 'Elige empresa' });
    await usuario.click(
      screen.getByRole('button', { name: '← Volver sin cambiar de empresa' }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/casos/9'),
    );
    expect(router.state.location.search).toBe('?x=1');
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('elegir otra empresa va a /bandeja', async () => {
    const { router } = montarApp('/casos/9');
    await entrarALaApp();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/casos/9'),
    );
    await userEvent.setup().click(cambiarEmpresa());
    await elegirEmpresaPorNombre(/Abarrotes/);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
  });

  it('un 401 al pedir la lista termina la sesión y pide la contraseña otra vez', async () => {
    const { router } = montarApp('/bandeja');
    await entrarALaApp();
    empresasFalla(401);
    await userEvent.setup().click(cambiarEmpresa());
    await screen.findByText(AVISOS.reingreso);
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByLabelText('Correo')).toHaveValue(
      'jorge.tapia@despacho.mx',
    );
  });

  it('un 401 al elegir durante el cambio termina la sesión', async () => {
    const { router } = montarApp('/bandeja');
    await entrarALaApp();
    await userEvent.setup().click(cambiarEmpresa());
    await screen.findByRole('heading', { level: 1, name: 'Elige empresa' });
    seleccionFalla(401);
    await elegirEmpresaPorNombre(/Abarrotes/);
    await screen.findByText(AVISOS.reingreso);
    expect(router.state.location.pathname).toBe('/login');
  });
});
