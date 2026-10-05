import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import {
  SessionStateProvider,
  type AccionesSesion,
  type SessionState,
} from '@/shared/sesion';
import { ApiError, NetworkError } from '@/shared/api';
import { contextoSesion } from '@/shared/api/contratos';
import { CONTEXTO_SESION as PAYLOAD } from '@/test/fixtures';
import { ThemeProvider } from '@/shared/tema';
import { ShellLayout } from './ShellLayout';

const CONTEXTO_SESION = contextoSesion.parse(PAYLOAD);
const LISTO: SessionState = {
  status: 'ready',
  contexto: CONTEXTO_SESION,
  puedeCambiarEmpresa: false,
  restaurarOrigen: false,
  epoca: 1,
};

function accionesFalsas() {
  return {
    iniciarSesion: vi.fn(),
    elegirEmpresa: vi.fn(),
    cambiarEmpresa: vi.fn(),
    regresarSinCambiar: vi.fn(),
    refrescarEmpresas: vi.fn(),
    volverAlInicio: vi.fn(),
    cerrarSesion: vi.fn(),
    reintentarContexto: vi.fn(),
    consumirFin: vi.fn(),
  } satisfies AccionesSesion;
}

function renderizar(
  estado: SessionState,
  ruta = '/cargas',
  acciones: AccionesSesion = accionesFalsas(),
) {
  const router = createMemoryRouter(
    [
      {
        element: <ShellLayout />,
        children: [
          {
            path: '/bandeja',
            element: <p>Contenido de bandeja</p>,
            handle: { titulo: 'Bandeja', subtitulo: 'Apoyo de la bandeja' },
          },
          {
            path: '/casos/:id',
            element: <p>Contenido del caso</p>,
            handle: { titulo: 'Detalle del caso' },
          },
          {
            path: '/cargas',
            element: <p>Contenido de cargas</p>,
            handle: { titulo: 'Cargas' },
          },
          { path: '/sin-titulo', element: <p>Sin título</p> },
        ],
      },
      { path: '/empresa', element: <p>Paso de empresa</p> },
    ],
    { initialEntries: [ruta] },
  );
  render(
    <ThemeProvider>
      <SessionStateProvider estado={estado} acciones={acciones}>
        <RouterProvider router={router} />
      </SessionStateProvider>
    </ThemeProvider>,
  );
  return router;
}

function renderizarConRuta(ruta: string) {
  renderizar(LISTO, ruta);
  return { unmount: () => cleanup() };
}

describe('ShellLayout con sesión lista', () => {
  it('expone exactamente un banner, una navegación y un main', () => {
    renderizar(LISTO);
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('el encabezado no queda dentro del main y el contenido sí', () => {
    renderizar(LISTO);
    const main = screen.getByRole('main');
    expect(main).not.toContainElement(screen.getByRole('banner'));
    expect(main).toContainElement(screen.getByText('Contenido de cargas'));
  });

  it('el título del h1 sale del handle de la ruta', () => {
    renderizar(LISTO, '/casos/9');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Detalle del caso' }),
    ).toBeInTheDocument();
  });

  it('muestra el subtítulo del handle y no inventa uno si falta', () => {
    const { unmount } = renderizarConRuta('/bandeja');
    expect(screen.getByText('Apoyo de la bandeja')).toBeInTheDocument();
    unmount();
    renderizarConRuta('/cargas');
    expect(screen.queryByText('Apoyo de la bandeja')).toBeNull();
  });

  it('usa un título neutro si la ruta no publica handle', () => {
    renderizar(LISTO, '/sin-titulo');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Cuadra' }),
    ).toBeInTheDocument();
  });

  it('no cambia el título del documento (lo pone la raíz)', () => {
    document.title = 'Antes';
    renderizar(LISTO);
    expect(document.title).toBe('Antes');
  });

  it('muestra la empresa y el usuario de la sesión', () => {
    renderizar(LISTO);
    const encabezado = screen.getByRole('banner');
    expect(
      within(encabezado).getByText(CONTEXTO_SESION.empresa.razonSocial),
    ).toBeInTheDocument();
    expect(
      within(encabezado).getByText(CONTEXTO_SESION.empresa.rfc),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('complementary')).getByText(
        CONTEXTO_SESION.usuario.nombre,
      ),
    ).toBeInTheDocument();
  });

  it('marca el elemento activo según la ruta', () => {
    renderizar(LISTO, '/cargas');
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: /Cargas/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(nav).getByRole('link', { name: /Bandeja/ }),
    ).not.toHaveAttribute('aria-current');
  });

  it('en el detalle de un caso Bandeja sigue activa', () => {
    renderizar(LISTO, '/casos/abc');
    expect(
      within(screen.getByRole('navigation')).getByRole('link', {
        name: /Bandeja/,
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('el control de tema queda justo encima del bloque de usuario', () => {
    renderizar(LISTO);
    const control = screen.getByRole('group', { name: 'Tema' });
    const usuario = screen.getByText(CONTEXTO_SESION.usuario.nombre);
    const pie = control.parentElement;
    expect(pie).toContainElement(usuario);
    expect(
      control.compareDocumentPosition(usuario) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('Enter en un enlace de navegación cambia la ruta y el activo', async () => {
    const usuario = userEvent.setup();
    const router = renderizar(LISTO, '/cargas');
    const enlace = within(screen.getByRole('navigation')).getByRole('link', {
      name: /Bandeja/,
    });
    enlace.focus();
    await usuario.keyboard('{Enter}');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
    expect(
      within(screen.getByRole('navigation')).getByRole('link', {
        name: /Bandeja/,
      }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Contenido de bandeja')).toBeInTheDocument();
  });
});

describe('enlace de salto', () => {
  it('es el primer elemento enfocable', async () => {
    const usuario = userEvent.setup();
    renderizar(LISTO);
    await usuario.tab();
    expect(
      screen.getByRole('link', { name: 'Saltar al contenido' }),
    ).toHaveFocus();
  });

  it('mueve el foco al main', async () => {
    const usuario = userEvent.setup();
    renderizar(LISTO);
    await usuario.tab();
    await usuario.keyboard('{Enter}');
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenido');
  });
});

describe('menú responsive (menos de 900 px)', () => {
  const boton = () => screen.getByRole('button', { name: 'Menú' });

  it('el botón controla la barra lateral y arranca cerrado', () => {
    renderizar(LISTO);
    expect(boton()).toHaveAttribute('aria-expanded', 'false');
    expect(boton()).toHaveAttribute('aria-controls', 'barra-lateral');
    expect(document.getElementById('barra-lateral')).toContainElement(
      screen.getByRole('navigation'),
    );
    expect(document.getElementById('barra-lateral')).toHaveAttribute(
      'data-abierto',
      'false',
    );
  });

  it('el botón abre y cierra el panel', async () => {
    const usuario = userEvent.setup();
    renderizar(LISTO);
    await usuario.click(boton());
    expect(boton()).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('barra-lateral')).toHaveAttribute(
      'data-abierto',
      'true',
    );
    await usuario.click(boton());
    expect(boton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape cierra el panel y devuelve el foco al botón', async () => {
    const usuario = userEvent.setup();
    renderizar(LISTO);
    await usuario.click(boton());
    within(screen.getByRole('navigation')).getAllByRole('link')[0]?.focus();
    await usuario.keyboard('{Escape}');
    expect(boton()).toHaveAttribute('aria-expanded', 'false');
    expect(boton()).toHaveFocus();
  });

  it('Escape con el panel cerrado no mueve el foco', async () => {
    const usuario = userEvent.setup();
    renderizar(LISTO);
    screen.getByRole('link', { name: 'Saltar al contenido' }).focus();
    await usuario.keyboard('{Escape}');
    expect(
      screen.getByRole('link', { name: 'Saltar al contenido' }),
    ).toHaveFocus();
  });

  it('un cambio de ruta cierra el panel', async () => {
    const usuario = userEvent.setup();
    const router = renderizar(LISTO);
    await usuario.click(boton());
    await act(() => router.navigate('/bandeja'));
    expect(boton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('elegir un enlace cierra el panel, incluso el de la ruta actual', async () => {
    const usuario = userEvent.setup();
    renderizar(LISTO, '/cargas');
    await usuario.click(boton());
    await usuario.click(
      within(screen.getByRole('navigation')).getByRole('link', {
        name: /Cargas/,
      }),
    );
    expect(boton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('con el menú presente sigue habiendo un banner, una navegación y un main', async () => {
    const usuario = userEvent.setup();
    renderizar(LISTO);
    await usuario.click(boton());
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('el enlace de salto sigue siendo el primer enfocable', async () => {
    const usuario = userEvent.setup();
    renderizar(LISTO);
    await usuario.tab();
    expect(
      screen.getByRole('link', { name: 'Saltar al contenido' }),
    ).toHaveFocus();
  });
});

describe('ShellLayout según el estado de la sesión', () => {
  it('loading: estado de carga sin identidad ni piezas del shell, sin redirigir', () => {
    const router = renderizar({ status: 'loading', restaurarOrigen: false });
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-busy', 'true');
    expect(main).toHaveTextContent('Cargando');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByText(CONTEXTO_SESION.usuario.nombre)).toBeNull();
    expect(screen.queryByText(CONTEXTO_SESION.empresa.razonSocial)).toBeNull();
    expect(screen.queryByText('Contenido de cargas')).toBeNull();
    expect(router.state.location.pathname).toBe('/cargas');
  });

  it.each<[string, SessionState]>([
    ['anonymous', { status: 'anonymous' }],
    [
      'selecting (login)',
      {
        status: 'selecting',
        origen: 'login',
        usuario: CONTEXTO_SESION.usuario,
        empresas: [],
      },
    ],
    ['ended', { status: 'ended', motivo: 'sesion_expirada' }],
  ])('%s: no dibuja nada y no redirige (lo hace la guarda)', (_n, estado) => {
    const router = renderizar(estado);
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByText('Contenido de cargas')).toBeNull();
    expect(screen.queryByText(CONTEXTO_SESION.usuario.nombre)).toBeNull();
    expect(router.state.location.pathname).toBe('/cargas');
  });

  describe('selecting (cambio): la sesión sigue viva', () => {
    const CAMBIO: SessionState = {
      status: 'selecting',
      origen: 'cambio',
      usuario: CONTEXTO_SESION.usuario,
      empresas: [],
    };

    function montarCambio(ruta = '/cargas') {
      const router = createMemoryRouter(
        [
          {
            element: <ShellLayout />,
            children: [
              {
                path: '/cargas',
                element: <p>Contenido de cargas</p>,
                handle: { titulo: 'Cargas' },
              },
            ],
          },
        ],
        { initialEntries: [ruta] },
      );
      const arbol = (estado: SessionState) => (
        <ThemeProvider>
          <SessionStateProvider estado={estado} acciones={accionesFalsas()}>
            <RouterProvider router={router} />
          </SessionStateProvider>
        </ThemeProvider>
      );
      const vista = render(
        arbol({
          status: 'ready',
          contexto: CONTEXTO_SESION,
          puedeCambiarEmpresa: true,
          restaurarOrigen: false,
          epoca: 1,
        }),
      );
      return { router, arbol, vista };
    }

    it('conserva el shell completo con el contexto retenido, sin botón de cambio', () => {
      const { arbol, vista } = montarCambio();
      vista.rerender(arbol(CAMBIO));
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('main')).toContainElement(
        screen.getByText('Contenido de cargas'),
      );
      expect(
        within(screen.getByRole('banner')).getByText(
          CONTEXTO_SESION.empresa.razonSocial,
        ),
      ).toBeInTheDocument();
      expect(screen.getByText(CONTEXTO_SESION.usuario.nombre)).toBeVisible();
      expect(
        screen.queryByRole('button', { name: /Cambiar de empresa/ }),
      ).toBeNull();
    });

    it('sin contexto retenido muestra el estado de carga, nunca vacío', () => {
      renderizar(CAMBIO);
      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('aria-busy', 'true');
      expect(main).toHaveTextContent('Cargando');
      expect(screen.queryByText(CONTEXTO_SESION.usuario.nombre)).toBeNull();
    });
  });

  describe('unavailable', () => {
    const NO_DISPONIBLE: SessionState = { status: 'unavailable' };

    it('muestra un aviso con el texto de conexión, sin identidad ni shell', () => {
      renderizar(NO_DISPONIBLE, '/cargas', accionesFalsas());
      expect(screen.getAllByRole('main')).toHaveLength(1);
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No se pudo conectar con el servidor. Inténtalo de nuevo.',
      );
      expect(screen.queryByRole('banner')).toBeNull();
      expect(screen.queryByRole('navigation')).toBeNull();
      expect(screen.queryByText(CONTEXTO_SESION.usuario.nombre)).toBeNull();
      expect(screen.queryByText('Contenido de cargas')).toBeNull();
    });

    it('Reintentar pide el contexto otra vez y no cierra la sesión', async () => {
      const acciones = accionesFalsas();
      renderizar(NO_DISPONIBLE, '/cargas', acciones);
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(acciones.reintentarContexto).toHaveBeenCalledTimes(1);
      expect(acciones.cerrarSesion).not.toHaveBeenCalled();
    });

    it('Cerrar sesión cierra la sesión y no reintenta', async () => {
      const acciones = accionesFalsas();
      renderizar(NO_DISPONIBLE, '/cargas', acciones);
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Cerrar sesión' }));
      expect(acciones.cerrarSesion).toHaveBeenCalledTimes(1);
      expect(acciones.reintentarContexto).not.toHaveBeenCalled();
    });

    it('los dos botones se alcanzan con teclado en ese orden', async () => {
      renderizar(NO_DISPONIBLE, '/cargas', accionesFalsas());
      const usuario = userEvent.setup();
      await usuario.tab();
      expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus();
      await usuario.tab();
      expect(
        screen.getByRole('button', { name: 'Cerrar sesión' }),
      ).toHaveFocus();
    });
  });
});

describe('ShellLayout: cambio de empresa y cierre de sesión', () => {
  const VARIAS: SessionState = { ...LISTO, puedeCambiarEmpresa: true };
  const botonCambio = () =>
    screen.getByRole('button', { name: /Cambiar de empresa/ });

  it('con varias empresas el encabezado ofrece el cambio', () => {
    renderizar(VARIAS, '/cargas', accionesFalsas());
    expect(botonCambio()).toBeInTheDocument();
  });

  it('con una sola empresa no hay botón de cambio', () => {
    renderizar(LISTO, '/cargas', accionesFalsas());
    expect(
      screen.queryByRole('button', { name: /Cambiar de empresa/ }),
    ).toBeNull();
    expect(
      screen.getByRole('group', { name: 'Empresa activa' }),
    ).toBeInTheDocument();
  });

  it('cambiar pide la lista y, al llegar, navega a /empresa con la pantalla actual como retorno', async () => {
    const acciones = accionesFalsas();
    const router = renderizar(VARIAS, '/cargas', acciones);
    await userEvent.setup().click(botonCambio());
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/empresa'),
    );
    expect(acciones.cambiarEmpresa).toHaveBeenCalledTimes(1);
    expect(router.state.location.state).toEqual({
      volverA: { pathname: '/cargas' },
    });
    expect(router.state.location.search).toBe('');
  });

  it('mientras la lista llega el botón queda ocupado y un segundo clic no repite la petición', async () => {
    const acciones = accionesFalsas();
    let resolver = () => {};
    acciones.cambiarEmpresa.mockReturnValue(
      new Promise<void>((resolve) => {
        resolver = resolve;
      }),
    );
    const router = renderizar(VARIAS, '/cargas', acciones);
    const usuario = userEvent.setup();
    await usuario.click(botonCambio());
    expect(botonCambio()).toHaveAttribute('aria-busy', 'true');
    await usuario.click(botonCambio());
    expect(acciones.cambiarEmpresa).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/cargas');
    await act(async () => resolver());
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/empresa'),
    );
  });

  it.each([
    ['red', () => new NetworkError()],
    ['5xx', () => new ApiError(503, 'x', ['texto del servidor'])],
  ])(
    'un fallo de %s deja el shell en ready, avisa y no navega',
    async (_n, crear) => {
      const acciones = accionesFalsas();
      acciones.cambiarEmpresa.mockRejectedValue(crear());
      const router = renderizar(VARIAS, '/cargas', acciones);
      await userEvent.setup().click(botonCambio());
      const aviso = await screen.findByRole('alert');
      expect(aviso).toHaveTextContent('No se pudo conectar con el servidor.');
      expect(aviso).not.toHaveTextContent('texto del servidor');
      expect(router.state.location.pathname).toBe('/cargas');
      expect(screen.getByText('Contenido de cargas')).toBeInTheDocument();
      expect(botonCambio()).not.toHaveAttribute('aria-busy');
    },
  );

  it('el aviso se retira al reintentar con éxito', async () => {
    const acciones = accionesFalsas();
    acciones.cambiarEmpresa
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce(undefined);
    renderizar(VARIAS, '/cargas', acciones);
    const usuario = userEvent.setup();
    await usuario.click(botonCambio());
    await screen.findByRole('alert');
    await usuario.click(botonCambio());
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('un 401 al pedir la lista no muestra aviso: la sesión ya terminó', async () => {
    const acciones = accionesFalsas();
    acciones.cambiarEmpresa.mockRejectedValue(
      new ApiError(401, 'Unauthorized', []),
    );
    const router = renderizar(VARIAS, '/cargas', acciones);
    await userEvent.setup().click(botonCambio());
    await waitFor(() => expect(botonCambio()).not.toHaveAttribute('aria-busy'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(router.state.location.pathname).toBe('/cargas');
  });

  it('un 403 al pedir la lista muestra el permiso denegado y mantiene la sesión', async () => {
    const acciones = accionesFalsas();
    acciones.cambiarEmpresa.mockRejectedValue(
      new ApiError(403, 'Forbidden', []),
    );
    renderizar(VARIAS, '/cargas', acciones);
    await userEvent.setup().click(botonCambio());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tienes permiso para esta acción.',
    );
    expect(acciones.cerrarSesion).not.toHaveBeenCalled();
  });

  it('«Cerrar sesión» está en el bloque de usuario y llama a cerrarSesion una vez', async () => {
    const acciones = accionesFalsas();
    renderizar(LISTO, '/cargas', acciones);
    const lateral = screen.getByRole('complementary', {
      name: 'Barra lateral',
    });
    await userEvent
      .setup()
      .click(within(lateral).getByRole('button', { name: 'Cerrar sesión' }));
    expect(acciones.cerrarSesion).toHaveBeenCalledTimes(1);
  });

  it('con el menú móvil abierto «Cerrar sesión» sigue en el panel y el cambio en el encabezado', async () => {
    const acciones = accionesFalsas();
    renderizar(VARIAS, '/cargas', acciones);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole('button', { name: 'Menú' }));
    const panel = document.getElementById('barra-lateral') as HTMLElement;
    expect(panel).toHaveAttribute('data-abierto', 'true');
    expect(
      within(panel).getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument();
    expect(panel).not.toContainElement(botonCambio());
    expect(screen.getByRole('banner')).toContainElement(botonCambio());
  });
});
