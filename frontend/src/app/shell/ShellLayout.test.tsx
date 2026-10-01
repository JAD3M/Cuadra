import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SessionStateProvider, type SessionState } from '@/app/session';
import { contextoSesion } from '@/shared/api/contratos';
import { CONTEXTO_SESION as PAYLOAD } from '@/test/fixtures';
import { ThemeProvider } from '@/shared/tema';
import { ShellLayout } from './ShellLayout';

const CONTEXTO_SESION = contextoSesion.parse(PAYLOAD);
const LISTO: SessionState = { status: 'ready', contexto: CONTEXTO_SESION };

function renderizar(estado: SessionState, ruta = '/cargas') {
  const router = createMemoryRouter(
    [
      {
        element: <ShellLayout />,
        children: [
          {
            path: '/bandeja',
            element: <p>Contenido de bandeja</p>,
            handle: { titulo: 'Bandeja' },
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
    ],
    { initialEntries: [ruta] },
  );
  render(
    <ThemeProvider>
      <SessionStateProvider estado={estado}>
        <RouterProvider router={router} />
      </SessionStateProvider>
    </ThemeProvider>,
  );
  return router;
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

describe('ShellLayout según el estado de la sesión', () => {
  it('loading: estado de carga sin identidad ni piezas del shell', () => {
    renderizar({ status: 'loading' });
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('aria-busy', 'true');
    expect(main).toHaveTextContent('Cargando');
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByText(CONTEXTO_SESION.usuario.nombre)).toBeNull();
    expect(screen.queryByText('Contenido de cargas')).toBeNull();
  });

  it('ended: aviso neutro, sin datos ni contenido, sin redirigir', () => {
    const router = renderizar({ status: 'ended' });
    expect(screen.getByRole('main')).toHaveTextContent('La sesión terminó');
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByText(CONTEXTO_SESION.empresa.razonSocial)).toBeNull();
    expect(screen.queryByText('Contenido de cargas')).toBeNull();
    expect(router.state.location.pathname).toBe('/cargas');
  });
});
