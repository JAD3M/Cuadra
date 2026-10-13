import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { espiarSolicitudes } from '@/test/handlersAuth';
import {
  CLAVE_DUENO,
  DUENO,
  cuerposLogin,
  empresasPlataformaFalla,
  empresasPlataformaLista,
  loginPlataformaFalla,
  loginPlataformaRedDeFallo,
  sesionDeEmpresaEnPlataforma,
  sesionPlataformaAbierta,
  usarHandlersPlataforma,
} from '@/test/handlersPlataforma';
import { montarPlataforma } from '@/test/montarRutas';
import { AVISOS_PLATAFORMA } from './textos';

beforeEach(() => {
  usarHandlersPlataforma();
});

const clave = () => screen.getByLabelText('Contraseña');
const entrar = () => screen.getByRole('button', { name: /Entrar|Entrando/ });

async function enviar(email: string = DUENO.correo, password = CLAVE_DUENO) {
  const usuario = userEvent.setup();
  await usuario.type(await screen.findByLabelText('Correo'), email);
  await usuario.type(clave(), password);
  await usuario.click(entrar());
}

async function verInterna() {
  return screen.findByRole('heading', { level: 1, name: 'Empresas' });
}

function rutaActual(router: { state: { location: { pathname: string } } }) {
  return router.state.location.pathname;
}

describe('plataforma: acceso', () => {
  it('sin sesión, /plataforma lleva a /plataforma/login', async () => {
    const { router } = montarPlataforma('/plataforma');
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Entrar a la plataforma',
      }),
    ).toBeInTheDocument();
    expect(rutaActual(router)).toBe('/plataforma/login');
  });

  it('la pantalla de acceso tiene su etiqueta, el chip y el control de tema', async () => {
    montarPlataforma('/plataforma/login');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('Acceso interno')).toBeInTheDocument();
    expect(screen.getByText('Plataforma')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('con credenciales correctas muestra la pantalla interna con el correo y el estado vacío', async () => {
    const { router } = montarPlataforma('/plataforma/login');
    await enviar();
    await verInterna();
    expect(rutaActual(router)).toBe('/plataforma');
    expect(screen.getByText(DUENO.correo)).toBeInTheDocument();
    expect(await screen.findByText('Aún no hay empresas')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument();
  });

  it('envía el campo `email` (no `correo`) en el cuerpo del login', async () => {
    montarPlataforma('/plataforma/login');
    await enviar();
    await verInterna();
    expect(cuerposLogin).toEqual([
      { email: DUENO.correo, password: CLAVE_DUENO },
    ]);
  });

  it('con credenciales erróneas muestra el error genérico y vacía la contraseña', async () => {
    montarPlataforma('/plataforma/login');
    await enviar(DUENO.correo, 'otra-clave-distinta');
    const alerta = await screen.findByRole('alert');
    expect(
      within(alerta).getByText('Correo o contraseña incorrectos'),
    ).toBeInTheDocument();
    expect(alerta).not.toHaveTextContent('texto del servidor');
    expect(clave()).toHaveValue('');
    expect(clave()).toHaveFocus();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Entrar a la plataforma' }),
    ).toBeInTheDocument();
  });

  it('con 429 muestra el texto de límite, no el de credenciales ni el del servidor', async () => {
    loginPlataformaFalla(429);
    montarPlataforma('/plataforma/login');
    await enviar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Demasiados intentos');
    expect(alerta).not.toHaveTextContent('Correo o contraseña incorrectos');
    expect(alerta).not.toHaveTextContent('texto del servidor');
  });

  it('con 403 no habla de empresas', async () => {
    loginPlataformaFalla(403);
    montarPlataforma('/plataforma/login');
    await enviar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).not.toHaveTextContent(/empresas asignadas/i);
  });

  it('con fallo de red conserva la contraseña escrita', async () => {
    loginPlataformaRedDeFallo();
    montarPlataforma('/plataforma/login');
    await enviar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(clave()).toHaveValue(CLAVE_DUENO);
  });

  it('valida el correo en el navegador sin llamar a la API', async () => {
    montarPlataforma('/plataforma/login');
    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText('Correo'), 'no-es-correo');
    await usuario.type(clave(), 'x');
    await usuario.click(entrar());
    expect(await screen.findByText('Escribe un correo válido')).toBeVisible();
    expect(cuerposLogin).toHaveLength(0);
  });
});

describe('plataforma: sesión', () => {
  it('al recargar con cookie vigente restaura la sesión con /me', async () => {
    sesionPlataformaAbierta();
    const espia = espiarSolicitudes();
    const { router } = montarPlataforma('/plataforma');
    await verInterna();
    expect(rutaActual(router)).toBe('/plataforma');
    expect(screen.getByText(DUENO.correo)).toBeInTheDocument();
    expect(espia.cuantas('GET', '/api/plataforma/auth/me')).toBe(1);
    espia.detener();
  });

  it('con sesión viva, /plataforma/login lleva a /plataforma', async () => {
    sesionPlataformaAbierta();
    const { router } = montarPlataforma('/plataforma/login');
    await verInterna();
    expect(rutaActual(router)).toBe('/plataforma');
  });

  it('401 en /me lleva al acceso sin aviso', async () => {
    const { router } = montarPlataforma('/plataforma');
    await screen.findByRole('heading', { name: 'Entrar a la plataforma' });
    expect(rutaActual(router)).toBe('/plataforma/login');
    for (const texto of Object.values(AVISOS_PLATAFORMA)) {
      expect(screen.queryByText(texto)).toBeNull();
    }
  });

  it('con una cookie de empresa (403 en /me) trata la sesión como anónima, sin aviso', async () => {
    sesionDeEmpresaEnPlataforma();
    const { router } = montarPlataforma('/plataforma');
    await screen.findByRole('heading', { name: 'Entrar a la plataforma' });
    expect(rutaActual(router)).toBe('/plataforma/login');
    for (const texto of Object.values(AVISOS_PLATAFORMA)) {
      expect(screen.queryByText(texto)).toBeNull();
    }
  });

  it('cerrar sesión lleva al acceso con el aviso «Cerraste sesión.»', async () => {
    sesionPlataformaAbierta();
    const { router } = montarPlataforma('/plataforma');
    await verInterna();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    const aviso = await screen.findByText('Cerraste sesión.');
    expect(aviso).toHaveFocus();
    expect(rutaActual(router)).toBe('/plataforma/login');
    expect(
      screen.getByRole('heading', { name: 'Entrar a la plataforma' }),
    ).toBeInTheDocument();
  });

  it('tras cerrar sesión, /plataforma ya no entra', async () => {
    sesionPlataformaAbierta();
    const { router } = montarPlataforma('/plataforma');
    await verInterna();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByText('Cerraste sesión.');
    await router.navigate('/plataforma');
    await waitFor(() => expect(rutaActual(router)).toBe('/plataforma/login'));
  });

  it('un 401 al leer empresas termina la sesión con el aviso de sesión terminada', async () => {
    sesionPlataformaAbierta();
    empresasPlataformaFalla(401);
    const { router } = montarPlataforma('/plataforma');
    expect(
      await screen.findByText(
        'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
      ),
    ).toBeInTheDocument();
    expect(rutaActual(router)).toBe('/plataforma/login');
  });

  it('el aviso sale una sola vez', async () => {
    sesionPlataformaAbierta();
    const { router } = montarPlataforma('/plataforma');
    await verInterna();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByText('Cerraste sesión.');
    await router.navigate('/plataforma');
    await screen.findByRole('heading', { name: 'Entrar a la plataforma' });
    expect(screen.queryByText('Cerraste sesión.')).toBeNull();
  });
});

describe('plataforma: pantalla interna', () => {
  it('no ofrece crear empresas (historia 1.4)', async () => {
    sesionPlataformaAbierta();
    montarPlataforma('/plataforma');
    await verInterna();
    await screen.findByText('Aún no hay empresas');
    expect(
      screen.queryByRole('button', { name: /crear|nueva|agregar/i }),
    ).toBeNull();
    expect(
      screen.queryByRole('link', { name: /crear|nueva|agregar/i }),
    ).toBeNull();
  });

  it('tiene un solo h1, el banner, un main y el control de tema', async () => {
    sesionPlataformaAbierta();
    montarPlataforma('/plataforma');
    await verInterna();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument();
    expect(screen.getByText('Plataforma')).toBeInTheDocument();
  });

  it('muestra las empresas que devuelve la API con su RFC', async () => {
    sesionPlataformaAbierta();
    empresasPlataformaLista([
      {
        id: 'e1a1b2c3-0000-4000-8000-000000000001',
        razonSocial: 'Ferretería del Norte SA de CV',
        rfc: 'FNO010101AB1',
      },
    ]);
    montarPlataforma('/plataforma');
    expect(
      await screen.findByText('Ferretería del Norte SA de CV'),
    ).toBeInTheDocument();
    expect(screen.getByText('FNO010101AB1')).toBeInTheDocument();
    expect(screen.queryByText('Aún no hay empresas')).toBeNull();
  });

  it('un fallo al leer empresas muestra una alerta con texto propio, no el del servidor', async () => {
    sesionPlataformaAbierta();
    // 400: un 5xx se reintenta con espera y alargaría la prueba sin aportar.
    empresasPlataformaFalla(400);
    montarPlataforma('/plataforma');
    await verInterna();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo completar la solicitud.');
    expect(alerta).not.toHaveTextContent('texto del servidor');
    expect(screen.queryByText('Aún no hay empresas')).toBeNull();
  });
});

describe('plataforma: aislamiento del mundo de empresa', () => {
  it('ninguna ruta de plataforma pide endpoints de empresa (acceso, interna y cierre)', async () => {
    const espia = espiarSolicitudes();
    montarPlataforma('/plataforma');
    await screen.findByRole('heading', { name: 'Entrar a la plataforma' });
    await enviar();
    await verInterna();
    await screen.findByText('Aún no hay empresas');
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByText('Cerraste sesión.');

    const rutas = espia.solicitudes.map((s) => s.ruta);
    espia.detener();
    expect(rutas.length).toBeGreaterThan(0);
    expect(rutas.filter((r) => r.startsWith('/api/auth/'))).toEqual([]);
    expect(rutas.every((r) => r.startsWith('/api/plataforma/'))).toBe(true);
  });

  it('las llamadas llevan cookie y nunca una cabecera Authorization', async () => {
    const espia = espiarSolicitudes();
    montarPlataforma('/plataforma/login');
    await enviar();
    await verInterna();
    espia.detener();
    expect(espia.solicitudes.length).toBeGreaterThan(0);
    for (const s of espia.solicitudes) {
      expect(s.autorizacion).toBeNull();
      expect(s.credenciales).toBe('include');
    }
  });
});
