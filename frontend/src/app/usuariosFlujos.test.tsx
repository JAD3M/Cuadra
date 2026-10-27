import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CONTEXTO_SESION, capacidadesDeRoles } from '@/test/fixtures';
import {
  accionesPendientesRecibidas,
  accionesRolesRecibidas,
  invitacionesUsuarioRecibidas,
  listadosUsuariosPedidos,
  personasDelMockup,
  usarHandlersUsuarios,
} from '@/test/handlersUsuarios';
import { elegirEmpresaMock, hayEmpresaElegida } from '@/test/sesionMock';
import { entrarALaApp, montarApp } from '@/test/montarApp';
import { servidor } from '@/test/servidor';

beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

beforeEach(() => {
  usarHandlersUsuarios(personasDelMockup());
});

/** La sesión entrega estos roles y las capacidades que el servidor derivaría. */
function conRoles(roles: string[]) {
  const contexto = () => ({
    ...CONTEXTO_SESION,
    roles,
    capacidades: capacidadesDeRoles(roles),
  });
  servidor.use(
    http.post('/api/auth/empresa/:id', ({ params }) => {
      elegirEmpresaMock(String(params.id));
      return HttpResponse.json(contexto());
    }),
    http.get('/api/auth/contexto', () =>
      hayEmpresaElegida()
        ? HttpResponse.json(contexto())
        : HttpResponse.json(
            { statusCode: 401, error: 'Unauthorized', message: 'x' },
            { status: 401 },
          ),
    ),
  );
}

const menu = () => screen.getByRole('navigation');

describe('flujos de usuarios: menú y pantalla (2.3)', () => {
  it('el administrador ve «Usuarios» después de Tolerancia y entra a la pantalla', async () => {
    montarApp('/bandeja');
    await entrarALaApp();
    const enlaces = within(menu())
      .getAllByRole('link')
      .map((e) => e.textContent?.trim());
    expect(enlaces.at(-1)).toBe('Usuarios');
    expect(enlaces.indexOf('Usuarios')).toBe(enlaces.indexOf('Tolerancia') + 1);

    await userEvent
      .setup()
      .click(within(menu()).getByRole('link', { name: 'Usuarios' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Usuarios' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Invita a personas a tu empresa y define qué puede hacer cada una.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('form', { name: 'Invitar a una persona' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Usuarios · Cuadra'));
    expect(
      within(menu()).getByRole('link', { name: 'Usuarios' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('el administrador invita desde la app completa', async () => {
    montarApp('/usuarios');
    await entrarALaApp();
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText('Correo'), 'luis@ferreteria.mx');
    await u.click(screen.getByRole('checkbox', { name: /^Auditor/ }));
    await u.click(screen.getByRole('button', { name: 'Enviar invitación' }));
    expect(
      await screen.findByText(
        'Si el correo es válido, la persona recibirá una invitación.',
      ),
    ).toBeInTheDocument();
    expect(invitacionesUsuarioRecibidas).toEqual([
      { email: 'luis@ferreteria.mx', roles: ['auditor'] },
    ]);
  });

  it('el administrador ve a las personas de su empresa, reenvía una invitación y cancela otra (2.4, 2.5)', async () => {
    montarApp('/usuarios');
    await entrarALaApp();
    const u = userEvent.setup();
    const seccion = await screen.findByRole('region', {
      name: 'Personas de tu empresa',
    });
    expect(
      await within(seccion).findByText('marta.nunez@ferreteria.mx'),
    ).toBeInTheDocument();
    // Activas y pendientes en la misma tabla, con su estado.
    expect(
      within(seccion).getByText('ana.mendoza@ferreteria.mx'),
    ).toBeInTheDocument();
    expect(within(seccion).getAllByText('Activo')).toHaveLength(4);
    expect(
      within(seccion).getByText('Pendiente · vence en 6 días'),
    ).toBeInTheDocument();

    await u.click(
      screen.getByRole('button', {
        name: 'Reenviar invitación a marta.nunez@ferreteria.mx',
      }),
    );
    expect(await within(seccion).findByRole('status')).toHaveTextContent(
      'Invitación reenviada a marta.nunez@ferreteria.mx. El enlace anterior ya no sirve.',
    );

    await u.click(
      screen.getByRole('button', {
        name: 'Cancelar invitación a luis.paredes@ferreteria.mx',
      }),
    );
    await u.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    expect(
      await within(seccion).findByText(
        'Invitación a luis.paredes@ferreteria.mx cancelada.',
      ),
    ).toBeInTheDocument();
    expect(accionesPendientesRecibidas.map((a) => a.accion)).toEqual([
      'reenviar',
      'cancelar',
    ]);
    await waitFor(() =>
      expect(
        within(seccion).queryByText('luis.paredes@ferreteria.mx', {
          selector: 'td',
        }),
      ).toBeNull(),
    );
  });

  it('el administrador cambia los roles de una persona y le quita el acceso a otra (2.6)', async () => {
    montarApp('/usuarios');
    await entrarALaApp();
    const u = userEvent.setup();
    const seccion = await screen.findByRole('region', {
      name: 'Personas de tu empresa',
    });
    await within(seccion).findByText('luis.reyes@ferreteria.mx');

    await u.click(
      screen.getByRole('button', {
        name: 'Cambiar roles de luis.reyes@ferreteria.mx',
      }),
    );
    await u.click(
      within(screen.getByRole('form', { name: 'Cambiar roles' })).getByRole(
        'checkbox',
        { name: /^Revisor/ },
      ),
    );
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(seccion).findByRole('status')).toHaveTextContent(
      'Roles de luis.reyes@ferreteria.mx actualizados: Contador y Revisor. El cambio aplica en su siguiente petición.',
    );

    await u.click(
      screen.getByRole('button', {
        name: 'Quitar acceso de jorge.tapia@ferreteria.mx',
      }),
    );
    await u.click(screen.getByRole('button', { name: 'Sí, quitar acceso' }));
    expect(
      await within(seccion).findByText(
        'Acceso de jorge.tapia@ferreteria.mx a tu empresa quitado. Ya no puede entrar a ella.',
      ),
    ).toBeInTheDocument();
    expect(accionesRolesRecibidas.map((a) => a.accion)).toEqual([
      'cambiar',
      'quitar',
    ]);
    await waitFor(() =>
      expect(
        within(seccion).queryByText('jorge.tapia@ferreteria.mx', {
          selector: 'td',
        }),
      ).toBeNull(),
    );
  });

  it.each([['contador'], ['revisor'], ['auditor']])(
    'con el rol %s el menú no trae «Usuarios» y la ruta directa muestra sin permiso',
    async (rolDePrueba) => {
      conRoles([rolDePrueba]);
      montarApp('/usuarios');
      await entrarALaApp();
      expect(
        await screen.findByText('No tienes permiso para esta acción.'),
      ).toBeInTheDocument();
      expect(
        within(menu()).queryByRole('link', { name: 'Usuarios' }),
      ).toBeNull();
      expect(screen.queryByRole('form')).toBeNull();
      expect(invitacionesUsuarioRecibidas).toHaveLength(0);
      expect(
        screen.queryByRole('region', { name: 'Personas de tu empresa' }),
      ).toBeNull();
      // Sin `usuarios.ver` ni siquiera se pide la lista.
      expect(listadosUsuariosPedidos.cuenta).toBe(0);
    },
  );
});
