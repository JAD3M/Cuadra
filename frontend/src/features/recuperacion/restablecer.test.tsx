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
import { montarApp } from '@/test/montarApp';
import {
  cambiarEstadoRecuperacion,
  consultarRecuperacionFalla,
  contrasenasRecibidas,
  restablecerFalla,
  TOKEN_RECUPERACION,
  tokensPedidos,
  usarHandlersRecuperacion,
  type EstadoServidorRecuperacion,
} from '@/test/handlersRecuperacion';
import { sesionConEmpresa } from '@/test/sesionMock';

beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

const RUTA = `/recuperar/${TOKEN_RECUPERACION}`;

beforeEach(() => {
  usarHandlersRecuperacion();
});

function montar(estado?: EstadoServidorRecuperacion) {
  if (estado) usarHandlersRecuperacion(estado);
  return montarApp(RUTA);
}

const titulo = () => screen.findByRole('heading', { level: 1 });
const clave = () => screen.getByLabelText('Contraseña nueva');

async function guardar(valor: string) {
  const usuario = userEvent.setup();
  await usuario.type(clave(), valor);
  await usuario.click(
    screen.getByRole('button', { name: 'Guardar contraseña' }),
  );
}

describe('restablecer: enlace vigente', () => {
  it('muestra el formulario del mockup y consulta con el token de la URL', async () => {
    montar();
    expect(await titulo()).toHaveTextContent('Elige una contraseña nueva');
    expect(
      within(screen.getByRole('main')).getByText('Nueva contraseña'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Al guardarla cerraremos tus sesiones abiertas en todos tus dispositivos.',
      ),
    ).toBeInTheDocument();
    expect(clave()).toHaveAttribute('type', 'password');
    expect(screen.getByText('Mínimo 12 caracteres.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Mostrar contraseña' }),
    ).toBeInTheDocument();
    expect(tokensPedidos).toEqual([TOKEN_RECUPERACION]);
  });

  it('una contraseña corta marca el campo y no llama a la API', async () => {
    montar();
    await titulo();
    await guardar('Aurora-26');
    expect(
      await screen.findByText(
        'La contraseña debe tener al menos 12 caracteres.',
      ),
    ).toBeInTheDocument();
    expect(clave()).toHaveAttribute('aria-invalid', 'true');
    expect(contrasenasRecibidas).toHaveLength(0);
  });

  it('un 400 del servidor deja el mismo error bajo la contraseña', async () => {
    montar();
    await titulo();
    restablecerFalla(400);
    await guardar('Cuadra-2026-nueva');
    expect(
      await screen.findByText(
        'La contraseña debe tener al menos 12 caracteres.',
      ),
    ).toBeInTheDocument();
    expect(clave()).toHaveAttribute('aria-invalid', 'true');
  });

  it('guarda, muestra «Contraseña actualizada» y no abre sesión: ofrece el login', async () => {
    const { router } = montar();
    await titulo();
    await guardar('Cuadra-2026-nueva');
    expect(
      await screen.findByRole('heading', { name: 'Contraseña actualizada' }),
    ).toBeInTheDocument();
    expect(contrasenasRecibidas).toEqual(['Cuadra-2026-nueva']);
    expect(router.state.location.pathname).toBe(RUTA);
    expect(
      screen.getByRole('link', { name: 'Ir a iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('banner')).toBeNull();
  });
});

describe('restablecer: enlaces que no valen', () => {
  it.each([
    ['usada', 'Este enlace ya se usó'],
    ['caducada', 'Este enlace caducó'],
    ['reemplazada', 'Este enlace fue reemplazado'],
    ['desconocida', 'No encontramos este enlace'],
  ] as const)(
    '%s muestra su título, sin formulario',
    async (motivo, esperado) => {
      montar({ tipo: 'invalida', motivo });
      expect(await titulo()).toHaveTextContent(esperado);
      expect(screen.queryByLabelText('Contraseña nueva')).toBeNull();
      expect(
        screen.getByRole('link', { name: 'Pedir un enlace nuevo' }),
      ).toHaveAttribute('href', '/recuperar');
    },
  );

  it('solo «usada» ofrece iniciar sesión', async () => {
    montar({ tipo: 'invalida', motivo: 'usada' });
    await titulo();
    expect(
      screen.getByRole('link', { name: 'Ir a iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
  });

  it('«caducada» no ofrece iniciar sesión', async () => {
    montar({ tipo: 'invalida', motivo: 'caducada' });
    await titulo();
    expect(
      screen.queryByRole('link', { name: 'Ir a iniciar sesión' }),
    ).toBeNull();
  });

  it('un 410 al guardar vuelve a leer el enlace y muestra su motivo', async () => {
    montar();
    await titulo();
    cambiarEstadoRecuperacion({ tipo: 'invalida', motivo: 'caducada' });
    await guardar('Cuadra-2026-nueva');
    expect(
      await screen.findByRole('heading', { name: 'Este enlace caducó' }),
    ).toBeInTheDocument();
  });

  it('un 404 al guardar muestra «No encontramos este enlace»', async () => {
    montar();
    await titulo();
    restablecerFalla(404);
    await guardar('Cuadra-2026-nueva');
    expect(
      await screen.findByRole('heading', {
        name: 'No encontramos este enlace',
      }),
    ).toBeInTheDocument();
  });

  it('un 403 al guardar muestra «Esta cuenta está desactivada», sin acciones', async () => {
    montar({ tipo: 'desactivada' });
    await titulo();
    await guardar('Cuadra-2026-nueva');
    expect(
      await screen.findByRole('heading', {
        name: 'Esta cuenta está desactivada',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'No se puede restablecer la contraseña de esta cuenta. Contacta a quien la administra.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('si la consulta falla muestra la alerta de conexión', async () => {
    usarHandlersRecuperacion();
    consultarRecuperacionFalla(503);
    montarApp(RUTA);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
  });
});

describe('restablecer: ruta pública', () => {
  it('con una sesión viva no redirige', async () => {
    sesionConEmpresa();
    const { router } = montar();
    expect(await titulo()).toHaveTextContent('Elige una contraseña nueva');
    expect(router.state.location.pathname).toBe(RUTA);
  });

  it('no deja el token ni la contraseña en el almacenamiento ni en la consola', async () => {
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    montar();
    await titulo();
    await guardar('Cuadra-2026-nueva');
    await screen.findByRole('heading', { name: 'Contraseña actualizada' });
    await waitFor(() => expect(contrasenasRecibidas).toHaveLength(1));
    const guardado = JSON.stringify({ ...localStorage, ...sessionStorage });
    expect(guardado).not.toContain(TOKEN_RECUPERACION);
    expect(guardado).not.toContain('Cuadra-2026-nueva');
    const llamadas = JSON.stringify([...log.mock.calls, ...error.mock.calls]);
    expect(llamadas).not.toContain(TOKEN_RECUPERACION);
    expect(llamadas).not.toContain('Cuadra-2026-nueva');
    log.mockRestore();
    error.mockRestore();
  });

  it('tiene un solo main y un solo h1', async () => {
    montar();
    await titulo();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
