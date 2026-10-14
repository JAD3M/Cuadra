import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RutaAnonima } from '@/app/rutas';
import { crearQueryClient } from '@/shared/api';
import {
  ESTADO_INICIAL,
  crearTienda,
  reducir,
  type EstadoInterno,
} from '@/shared/sesion/maquina';
import { SessionProvider } from '@/shared/sesion/SessionProvider';
import type { MotivoSalida } from '@/shared/sesion';
import { ThemeProvider } from '@/shared/tema';
import { CREDENCIALES } from '@/test/montarSesion';
import { servidor } from '@/test/servidor';
import { AVISOS } from './components/textos';
import { LoginPage } from './LoginPage';

function Empresa() {
  const { state } = useLocation();
  return (
    <>
      <p data-testid="empresa">Paso 2</p>
      <output data-testid="state-empresa">{JSON.stringify(state)}</output>
    </>
  );
}

function terminada(motivo: MotivoSalida, email?: string): EstadoInterno {
  return { fase: 'ended', epoca: 1, motivo, email, empresaPrevia: null };
}

interface Opciones {
  inicial?: EstadoInterno;
  state?: unknown;
}

function montar({ inicial = ESTADO_INICIAL, state }: Opciones = {}) {
  const consultas = crearQueryClient();
  const tienda = crearTienda(reducir, inicial);
  const router = createMemoryRouter(
    [
      {
        element: <RutaAnonima />,
        children: [{ path: '/login', element: <LoginPage /> }],
      },
      { path: '/empresa', element: <Empresa /> },
      { path: '/otra', element: <p>otra</p> },
    ],
    { initialEntries: [{ pathname: '/login', state }] },
  );
  const vista = render(
    <QueryClientProvider client={consultas}>
      <ThemeProvider>
        <SessionProvider tienda={tienda}>
          <RouterProvider router={router} />
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { ...vista, consultas, tienda, router };
}

const correo = () => screen.getByLabelText('Correo');
const clave = () => screen.getByLabelText('Contraseña');
const entrar = () => screen.getByRole('button', { name: /Entrar|Entrando/ });

async function enviar(email = CREDENCIALES.email, password = 'secreta-1') {
  const usuario = userEvent.setup();
  await usuario.clear(correo());
  await usuario.type(correo(), email);
  await usuario.type(clave(), password);
  await usuario.click(entrar());
}

/** DOM sin los ids que genera `useId`, que cambian entre montajes. */
function domNormalizado(contenedor: HTMLElement) {
  return contenedor.innerHTML.replace(/_r_[a-z0-9]+_/g, 'ID');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LoginPage: estructura', () => {
  it('es una pantalla con un solo main, un h1, el formulario y el control de tema', () => {
    montar();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Inicia sesión' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument();
    expect(correo()).toBeInTheDocument();
  });

  it('ofrece «¿Olvidaste tu contraseña?» hacia /recuperar, bajo la contraseña', () => {
    montar();
    const enlace = screen.getByRole('link', {
      name: '¿Olvidaste tu contraseña?',
    });
    expect(enlace).toHaveAttribute('href', '/recuperar');
    expect(
      screen
        .getByLabelText('Contraseña')
        .compareDocumentPosition(enlace) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('en una llegada en frío no hay aviso ni foco automático', () => {
    montar();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(document.body).toHaveFocus();
    expect(correo()).toHaveValue('');
  });
});

describe('LoginPage: aviso de salida', () => {
  const motivos = Object.keys(AVISOS) as MotivoSalida[];

  it.each(motivos)('muestra el aviso de %s y lo enfoca', (motivo) => {
    montar({ inicial: terminada(motivo) });
    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent(AVISOS[motivo as keyof typeof AVISOS]);
    expect(aviso).toHaveFocus();
  });

  it.each(motivos)('el aviso de %s sale una sola vez', async (motivo) => {
    const { router, tienda } = montar({ inicial: terminada(motivo) });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(tienda.obtener().fase).toBe('anonymous');

    await act(() => router.navigate('/otra'));
    expect(screen.getByText('otra')).toBeInTheDocument();
    await act(() => router.navigate('/login'));
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('el aviso no desaparece al consumirse la salida', async () => {
    montar({ inicial: terminada('sesion_expirada') });
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
      ),
    );
  });

  it.each(['reingreso', 'seleccion_vencida', 'sin_empresas'] as const)(
    'con %s rellena el correo',
    (motivo) => {
      montar({ inicial: terminada(motivo, 'ana@despacho.mx') });
      expect(correo()).toHaveValue('ana@despacho.mx');
    },
  );

  it.each(['sesion_expirada', 'sin_acceso', 'cierre_voluntario'] as const)(
    'con %s no rellena el correo',
    (motivo) => {
      montar({ inicial: terminada(motivo, 'ana@despacho.mx') });
      expect(correo()).toHaveValue('');
    },
  );
});

describe('LoginPage: foco al llegar', () => {
  it('desde "Cambiar de cuenta" enfoca el correo', async () => {
    montar({ state: { foco: 'correo' } });
    await waitFor(() => expect(correo()).toHaveFocus());
  });

  it('si hay aviso, el aviso gana sobre el correo', async () => {
    montar({
      inicial: terminada('cierre_voluntario'),
      state: { foco: 'correo' },
    });
    expect(screen.getByRole('status')).toHaveFocus();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole('status')).toHaveFocus();
  });

  it('ignora un estado de ruta con otra forma', () => {
    montar({ state: { foco: 'clave', token: 'x' } });
    expect(document.body).toHaveFocus();
  });
});

describe('LoginPage: acceso correcto', () => {
  it('pasa a la elección de empresa sin llevar la contraseña ni el token', async () => {
    const { router, tienda, consultas } = montar();
    await enviar();
    await screen.findByTestId('empresa');

    expect(router.state.location.pathname).toBe('/empresa');
    expect(tienda.obtener().fase).toBe('selecting');
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();

    const rastro = [
      JSON.stringify(router.state),
      JSON.stringify(window.history.state),
      JSON.stringify(consultas.getQueryCache().getAll()),
      JSON.stringify(consultas.getMutationCache().getAll()),
      JSON.stringify(tienda.obtener()),
      document.body.innerHTML,
      screen.getByTestId('state-empresa').textContent,
    ].join('\n');
    expect(rastro).not.toContain(CREDENCIALES.password);
    expect(rastro.toLowerCase()).not.toContain('token');
  });

  it('envía el correo recortado y la contraseña tal cual', async () => {
    let cuerpo: unknown;
    servidor.use(
      http.post('/api/auth/login', async ({ request }) => {
        cuerpo = await request.json();
        return HttpResponse.json({ message: 'x' }, { status: 401 });
      }),
    );
    montar();
    await enviar('  ana@despacho.mx ', ' clave ');
    await screen.findByRole('alert');
    expect(cuerpo).toEqual({ email: 'ana@despacho.mx', password: ' clave ' });
  });

  it('suelta la mutación de la caché al terminar, con éxito', async () => {
    const { consultas } = montar();
    await enviar();
    await screen.findByTestId('empresa');
    await waitFor(() =>
      expect(consultas.getMutationCache().getAll()).toHaveLength(0),
    );
  });
});

describe('LoginPage: intento en curso', () => {
  it('deshabilita el envío, anuncia "Entrando…" y un segundo envío no sale', async () => {
    let peticiones = 0;
    let soltar: () => void = () => {};
    const espera = new Promise<void>((r) => (soltar = r));
    servidor.use(
      http.post('/api/auth/login', async () => {
        peticiones += 1;
        await espera;
        return HttpResponse.json({}, { status: 401 });
      }),
    );
    montar();
    const usuario = userEvent.setup();
    await usuario.type(correo(), CREDENCIALES.email);
    await usuario.type(clave(), 'secreta-1');
    await usuario.click(entrar());

    const boton = await screen.findByRole('button', { name: 'Entrando…' });
    expect(boton).toBeDisabled();
    expect(boton.closest('form')).toHaveAttribute('aria-busy', 'true');
    await usuario.type(clave(), '{Enter}');
    await usuario.click(boton);
    expect(peticiones).toBe(1);

    soltar();
    await screen.findByRole('alert');
    expect(peticiones).toBe(1);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });
});

describe('LoginPage: fallos de credenciales', () => {
  const COPIA = 'Correo o contraseña incorrectos';

  it('muestra la alerta exacta, vacía la contraseña, la enfoca y conserva el correo', async () => {
    servidor.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { statusCode: 401, error: 'Unauthorized', message: 'Credenciales' },
          { status: 401 },
        ),
      ),
    );
    montar();
    await enviar('ana@despacho.mx', 'mala');
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(COPIA);
    expect(alerta).toHaveTextContent('Revisa tus datos e inténtalo de nuevo.');
    await waitFor(() => expect(clave()).toHaveFocus());
    expect(clave()).toHaveValue('');
    expect(clave().getAttribute('aria-describedby')).toContain(alerta.id);
    expect(correo()).toHaveValue('ana@despacho.mx');
    expect(document.body.textContent).not.toMatch(/intento|bloque|existe/i);
  });

  it('las tres causas de 401 producen el mismo DOM y el mismo elemento enfocado', async () => {
    const causas = [
      'Credenciales inválidas',
      'No existe un usuario con ese correo',
      'Usuario inactivo',
    ];
    const resultados: { dom: string; foco: string | undefined }[] = [];
    for (const mensaje of causas) {
      servidor.use(
        http.post('/api/auth/login', () =>
          HttpResponse.json(
            { statusCode: 401, error: 'Unauthorized', message: mensaje },
            { status: 401 },
          ),
        ),
      );
      const { container, unmount } = montar();
      await enviar('ana@despacho.mx', 'mala');
      await screen.findByRole('alert');
      await waitFor(() => expect(clave()).toHaveFocus());
      resultados.push({
        dom: domNormalizado(container),
        foco: (document.activeElement as HTMLInputElement).name,
      });
      expect(document.body.innerHTML).not.toContain(mensaje);
      unmount();
    }
    expect(resultados[1]).toEqual(resultados[0]);
    expect(resultados[2]).toEqual(resultados[0]);
    expect(resultados[0]!.foco).toBe('password');
  });

  it('un 400 de validación del servidor se ve igual que un 401', async () => {
    const dom: string[] = [];
    for (const [estatus, cuerpo] of [
      [401, { statusCode: 401, error: 'Unauthorized', message: 'x' }],
      [400, { statusCode: 400, error: 'Bad Request', message: ['email mal'] }],
    ] as const) {
      servidor.use(
        http.post('/api/auth/login', () =>
          HttpResponse.json(cuerpo, { status: estatus }),
        ),
      );
      const { container, unmount } = montar();
      await enviar('ana@despacho.mx', 'mala');
      await screen.findByRole('alert');
      await waitFor(() => expect(clave()).toHaveFocus());
      dom.push(domNormalizado(container));
      unmount();
    }
    expect(dom[1]).toBe(dom[0]);
  });

  it('después de un fallo se puede reintentar y la alerta se retira', async () => {
    servidor.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { statusCode: 401, error: 'x', message: 'x' },
          { status: 401 },
        ),
      ),
    );
    montar();
    await enviar('ana@despacho.mx', 'mala');
    await screen.findByRole('alert');
    servidor.resetHandlers();
    const usuario = userEvent.setup();
    await usuario.type(clave(), 'buena');
    await usuario.click(entrar());
    await screen.findByTestId('empresa');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('un 403 tiene su propio texto, no el de credenciales', async () => {
    servidor.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { statusCode: 403, error: 'Forbidden', message: 'x' },
          { status: 403 },
        ),
      ),
    );
    montar();
    await enviar('ana@despacho.mx', 'buena');
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Tu usuario no tiene empresas asignadas.');
    expect(alerta).toHaveTextContent('Contacta a un administrador.');
    expect(alerta).not.toHaveTextContent(COPIA);
    expect(clave()).toHaveValue('');
  });
});

describe('LoginPage: fallos de conexión', () => {
  const cuerpoValido = {
    usuario: { id: 'no-es-guid', nombre: 'X', email: 'x@y.mx' },
    empresas: [],
  };
  const casos: [
    string,
    () => Response | ReturnType<typeof HttpResponse.error>,
  ][] = [
    ['red caída', () => HttpResponse.error()],
    ['500', () => HttpResponse.json({ message: 'boom' }, { status: 500 })],
    ['502 sin JSON', () => new HttpResponse('<html>', { status: 502 })],
    ['200 con forma inválida', () => HttpResponse.json(cuerpoValido)],
  ];

  it.each(casos)(
    'con %s muestra el aviso de conexión, sigue anónimo y conserva lo escrito',
    async (_nombre, respuesta) => {
      servidor.use(http.post('/api/auth/login', () => respuesta()));
      const { tienda, router } = montar();
      await enviar('ana@despacho.mx', 'secreta-9');
      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
      expect(alerta).toHaveTextContent('Inténtalo de nuevo.');
      expect(tienda.obtener().fase).toBe('anonymous');
      expect(router.state.location.pathname).toBe('/login');
      expect(correo()).toHaveValue('ana@despacho.mx');
      expect(clave()).toHaveValue('secreta-9');
      await waitFor(() => expect(clave()).toHaveFocus());
      expect(document.body.textContent).not.toContain('boom');
    },
  );
});

describe('LoginPage: la contraseña no queda en ningún lado', () => {
  it('tras un fallo no está en las cachés, el estado, el DOM ni el historial', async () => {
    servidor.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { statusCode: 401, error: 'x', message: 'x' },
          { status: 401 },
        ),
      ),
    );
    const { consultas, tienda, router } = montar();
    await enviar('ana@despacho.mx', 'super-secreta-77');
    await screen.findByRole('alert');
    await waitFor(() =>
      expect(consultas.getMutationCache().getAll()).toHaveLength(0),
    );
    const rastro = [
      JSON.stringify(consultas.getMutationCache().getAll()),
      JSON.stringify(consultas.getQueryCache().getAll()),
      JSON.stringify(tienda.obtener()),
      JSON.stringify(router.state),
      JSON.stringify(window.history.state),
      window.location.href,
      document.body.innerHTML,
    ].join('\n');
    expect(rastro).not.toContain('super-secreta-77');
    expect(clave()).toHaveValue('');
    expect(
      within(document.body).queryByDisplayValue('super-secreta-77'),
    ).toBeNull();
  });

  it('no escribe nada en la consola en ningún camino', async () => {
    const espias = (
      ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir'] as const
    ).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    servidor.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { statusCode: 401, error: 'x', message: 'x' },
          { status: 401 },
        ),
      ),
    );
    const primera = montar();
    await enviar('ana@despacho.mx', 'super-secreta-77');
    await screen.findByRole('alert');
    primera.unmount();

    servidor.use(http.post('/api/auth/login', () => HttpResponse.error()));
    const segunda = montar();
    await enviar('ana@despacho.mx', 'super-secreta-77');
    await screen.findByRole('alert');
    segunda.unmount();

    servidor.resetHandlers();
    montar();
    await enviar('ana@despacho.mx', 'super-secreta-77');
    await screen.findByTestId('empresa');

    for (const espia of espias) expect(espia).not.toHaveBeenCalled();
  });
});
