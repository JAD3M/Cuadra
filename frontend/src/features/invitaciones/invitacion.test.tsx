import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  aceptarInvitacionFalla,
  consultarInvitacionFalla,
  cuerposAceptar,
  EMPRESA_INVITACION,
  TOKEN_INVITACION,
  tokensPedidos,
  usarHandlersInvitaciones,
  type EstadoServidorInvitacion,
} from '@/test/handlersInvitaciones';
import { montarApp } from '@/test/montarApp';
import { sesionConEmpresa } from '@/test/sesionMock';

beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

const RUTA = `/invitacion/${TOKEN_INVITACION}`;

beforeEach(() => {
  usarHandlersInvitaciones();
});

function montar(estado?: EstadoServidorInvitacion) {
  if (estado) usarHandlersInvitaciones(estado);
  return montarApp(RUTA);
}

const titulo = () => screen.findByRole('heading', { level: 1 });
const nombre = () => screen.getByLabelText('Nombre');
const clave = () => screen.getByLabelText('Contraseña');

describe('invitación: cuenta nueva', () => {
  it('muestra la empresa, el nombre, la contraseña con su ayuda y «Crear cuenta y entrar»', async () => {
    montar();
    expect(await titulo()).toHaveTextContent(
      `Te invitaron a administrar ${EMPRESA_INVITACION}`,
    );
    expect(
      within(screen.getByRole('main')).getByText('Invitación'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Crea tu cuenta para entrar a Cuadra como administrador.',
      ),
    ).toBeInTheDocument();
    expect(nombre()).toBeInTheDocument();
    expect(clave()).toHaveAttribute('type', 'password');
    expect(screen.getByText('Mínimo 12 caracteres.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mostrar contraseña' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Crear cuenta y entrar' }),
    ).toBeInTheDocument();
  });

  it('pide el enlace con el token de la URL', async () => {
    montar();
    await titulo();
    expect(tokensPedidos).toEqual([TOKEN_INVITACION]);
  });

  it('una contraseña de menos de 12 caracteres marca el campo y no llama a la API', async () => {
    montar();
    await titulo();
    const usuario = userEvent.setup();
    await usuario.type(nombre(), 'Ana Mendoza');
    await usuario.type(clave(), 'Aurora-26');
    await usuario.click(
      screen.getByRole('button', { name: 'Crear cuenta y entrar' }),
    );
    expect(
      await screen.findByText(
        'La contraseña debe tener al menos 12 caracteres.',
      ),
    ).toBeInTheDocument();
    expect(clave()).toHaveAttribute('aria-invalid', 'true');
    expect(cuerposAceptar).toHaveLength(0);
  });

  it('sin nombre no se envía', async () => {
    montar();
    await titulo();
    const usuario = userEvent.setup();
    await usuario.type(clave(), 'Cuadra-2026-demo');
    await usuario.click(
      screen.getByRole('button', { name: 'Crear cuenta y entrar' }),
    );
    expect(nombre()).toHaveAttribute('aria-invalid', 'true');
    expect(cuerposAceptar).toHaveLength(0);
  });

  it('con nombre y contraseña envía ambos, entra a la bandeja con la sesión nueva', async () => {
    const { router } = montar();
    await titulo();
    const usuario = userEvent.setup();
    await usuario.type(nombre(), '  Ana Mendoza ');
    await usuario.type(clave(), 'Cuadra-2026-demo');
    await usuario.click(
      screen.getByRole('button', { name: 'Crear cuenta y entrar' }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
    expect(cuerposAceptar).toEqual([
      { nombre: 'Ana Mendoza', password: 'Cuadra-2026-demo' },
    ]);
    expect(await screen.findByRole('banner')).toBeInTheDocument();
  });

  it('un 400 del servidor deja el mismo error bajo la contraseña y conserva el nombre', async () => {
    montar();
    await titulo();
    aceptarInvitacionFalla(400);
    const usuario = userEvent.setup();
    await usuario.type(nombre(), 'Ana');
    await usuario.type(clave(), 'Cuadra-2026-demo');
    await usuario.click(
      screen.getByRole('button', { name: 'Crear cuenta y entrar' }),
    );
    expect(
      await screen.findByText(
        'La contraseña debe tener al menos 12 caracteres.',
      ),
    ).toBeInTheDocument();
    expect(nombre()).toHaveValue('Ana');
  });
});

describe('invitación: cuenta existente', () => {
  const EXISTENTE: EstadoServidorInvitacion = {
    tipo: 'vigente',
    requierePassword: false,
  };

  it('muestra el aviso, sin campos, con «Aceptar y entrar»', async () => {
    montar(EXISTENTE);
    expect(await titulo()).toHaveTextContent(
      `Te invitaron a administrar ${EMPRESA_INVITACION}`,
    );
    expect(
      screen.getByText(
        'Ya tienes una cuenta con este correo. No vamos a cambiar tu contraseña.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
    expect(screen.queryByLabelText('Nombre')).toBeNull();
    expect(
      screen.queryByText(
        'Crea tu cuenta para entrar a Cuadra como administrador.',
      ),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Aceptar y entrar' }),
    ).toBeInTheDocument();
  });

  it('acepta sin mandar contraseña ni nombre y entra', async () => {
    const { router } = montar(EXISTENTE);
    await titulo();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Aceptar y entrar' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
    expect(cuerposAceptar).toEqual([{}]);
  });
});

describe('invitación: enlaces que no valen', () => {
  it.each([
    [
      'usada',
      'Esta invitación ya se usó',
      'Si ya creaste tu cuenta, inicia sesión.',
    ],
    [
      'caducada',
      'Esta invitación caducó',
      'Pide al dueño de la plataforma que te envíe una nueva.',
    ],
    [
      'reemplazada',
      'Esta invitación fue reemplazada',
      'Usa el enlace de la invitación más reciente que recibiste.',
    ],
    [
      'desconocida',
      'No encontramos esta invitación',
      'Revisa que el enlace esté completo.',
    ],
  ] as const)(
    '%s muestra su título y su texto, sin formulario',
    async (motivo, tituloEsperado, texto) => {
      montar({ tipo: 'invalida', motivo });
      expect(await titulo()).toHaveTextContent(tituloEsperado);
      expect(screen.getByText(texto)).toBeInTheDocument();
      expect(screen.queryByLabelText('Contraseña')).toBeNull();
      expect(screen.queryByRole('button', { name: /entrar/i })).toBeNull();
    },
  );

  it('solo «usada» ofrece «Ir a iniciar sesión»', async () => {
    montar({ tipo: 'invalida', motivo: 'usada' });
    await titulo();
    expect(
      screen.getByRole('link', { name: 'Ir a iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
  });

  it('caducada no ofrece ir a iniciar sesión', async () => {
    montar({ tipo: 'invalida', motivo: 'caducada' });
    await titulo();
    expect(
      screen.queryByRole('link', { name: 'Ir a iniciar sesión' }),
    ).toBeNull();
  });

  it('un 410 al aceptar vuelve a leer el enlace y muestra su motivo', async () => {
    montar();
    await titulo();
    // Alguien lo usó mientras se llenaba el formulario.
    const { cambiarEstadoInvitacion } =
      await import('@/test/handlersInvitaciones');
    cambiarEstadoInvitacion({ tipo: 'invalida', motivo: 'caducada' });
    const usuario = userEvent.setup();
    await usuario.type(nombre(), 'Ana');
    await usuario.type(clave(), 'Cuadra-2026-demo');
    await usuario.click(
      screen.getByRole('button', { name: 'Crear cuenta y entrar' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Esta invitación caducó' }),
    ).toBeInTheDocument();
  });

  it('un 404 al aceptar muestra «No encontramos esta invitación»', async () => {
    montar();
    await titulo();
    aceptarInvitacionFalla(404);
    const usuario = userEvent.setup();
    await usuario.type(nombre(), 'Ana');
    await usuario.type(clave(), 'Cuadra-2026-demo');
    await usuario.click(
      screen.getByRole('button', { name: 'Crear cuenta y entrar' }),
    );
    expect(
      await screen.findByRole('heading', {
        name: 'No encontramos esta invitación',
      }),
    ).toBeInTheDocument();
  });

  it('un 403 (cuenta inactiva) muestra «Esta cuenta está desactivada»', async () => {
    montar({ tipo: 'inactiva' });
    await titulo();
    const usuario = userEvent.setup();
    await usuario.click(
      screen.getByRole('button', { name: 'Aceptar y entrar' }),
    );
    const encabezado = await screen.findByRole('heading', {
      name: 'Esta cuenta está desactivada',
    });
    expect(encabezado).toBeInTheDocument();
    expect(
      screen.getByText('Contacta al dueño de la plataforma.'),
    ).toBeInTheDocument();
  });

  it('si la consulta falla muestra la alerta de conexión', async () => {
    usarHandlersInvitaciones();
    consultarInvitacionFalla(503);
    montarApp(RUTA);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
  });
});

describe('invitación: ruta pública', () => {
  it('con una sesión viva no redirige: muestra la invitación', async () => {
    sesionConEmpresa();
    const { router } = montar();
    expect(await titulo()).toHaveTextContent('Te invitaron a administrar');
    expect(router.state.location.pathname).toBe(RUTA);
  });

  it('sin sesión tampoco manda al login', async () => {
    const { router } = montar();
    await titulo();
    expect(router.state.location.pathname).toBe(RUTA);
  });

  it('no deja el token ni la contraseña en el almacenamiento ni en la consola', async () => {
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    const { router } = montar();
    await titulo();
    const usuario = userEvent.setup();
    await usuario.type(nombre(), 'Ana');
    await usuario.type(clave(), 'Cuadra-2026-demo');
    await usuario.click(
      screen.getByRole('button', { name: 'Crear cuenta y entrar' }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/bandeja'),
    );
    const guardado = JSON.stringify({ ...localStorage, ...sessionStorage });
    expect(guardado).not.toContain(TOKEN_INVITACION);
    expect(guardado).not.toContain('Cuadra-2026-demo');
    const llamadas = JSON.stringify([...log.mock.calls, ...error.mock.calls]);
    expect(llamadas).not.toContain(TOKEN_INVITACION);
    expect(llamadas).not.toContain('Cuadra-2026-demo');
    log.mockRestore();
    error.mockRestore();
  });
});

describe('invitación: estructura', () => {
  it('tiene un solo main y un solo h1', async () => {
    montar();
    await titulo();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const principal = screen.getByRole('main');
    expect(
      within(principal).getByRole('group', { name: 'Tema' }),
    ).toBeInTheDocument();
  });
});
