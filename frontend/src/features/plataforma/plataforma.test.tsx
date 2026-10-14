import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { espiarSolicitudes } from '@/test/handlersAuth';
import {
  CLAVE_DUENO,
  DUENO,
  crearEmpresaPlataformaFalla,
  crearEmpresaPlataformaRedDeFallo,
  cuerposCrearEmpresa,
  cuerposLogin,
  empresasPlataformaFalla,
  sembrarEmpresasPlataforma,
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

const EMPRESAS = [
  {
    id: '00000000-0000-4000-8000-0000000000a1',
    razonSocial: 'Ferretería Aurora S.A. de C.V.',
    rfc: 'FAU210215QK4',
  },
  {
    id: '00000000-0000-4000-8000-0000000000a2',
    razonSocial: 'Distribuidora del Norte S.A. de C.V.',
    rfc: 'DNO180904TB7',
  },
];

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

describe('plataforma: lista con datos', () => {
  it('muestra razón social y RFC de cada empresa en una tabla', async () => {
    sesionPlataformaAbierta();
    sembrarEmpresasPlataforma(EMPRESAS);
    montarPlataforma('/plataforma');
    await verInterna();
    const tabla = await screen.findByRole('table', {
      name: 'Lista de empresas',
    });
    expect(
      within(tabla).getByRole('columnheader', { name: 'Razón social' }),
    ).toBeInTheDocument();
    expect(
      within(tabla).getByRole('columnheader', { name: 'RFC' }),
    ).toBeInTheDocument();
    expect(within(tabla).getAllByRole('row')).toHaveLength(3);
    expect(
      within(tabla).getByText('Ferretería Aurora S.A. de C.V.'),
    ).toBeInTheDocument();
    expect(within(tabla).getByText('FAU210215QK4')).toBeInTheDocument();
    expect(screen.queryByText('Aún no hay empresas')).toBeNull();
  });
});

describe('plataforma: crear empresa', () => {
  async function abrirFormulario() {
    sesionPlataformaAbierta();
    montarPlataforma('/plataforma');
    await verInterna();
    await screen.findByText('Aún no hay empresas');
    const usuario = userEvent.setup();
    await usuario.click(
      screen.getAllByRole('button', { name: 'Crear empresa' })[0]!,
    );
    return usuario;
  }

  const razon = () => screen.getByLabelText('Razón social');
  const rfc = () => screen.getByLabelText('RFC');
  const formulario = () => screen.getByRole('form', { name: 'Crear empresa' });
  const crear = () =>
    within(formulario()).getByRole('button', { name: 'Crear empresa' });

  it('ofrece el botón del encabezado y el del estado vacío, y abre el formulario', async () => {
    sesionPlataformaAbierta();
    montarPlataforma('/plataforma');
    await verInterna();
    await screen.findByText('Aún no hay empresas');
    expect(
      screen.getAllByRole('button', { name: 'Crear empresa' }),
    ).toHaveLength(2);
    expect(screen.queryByRole('form', { name: 'Crear empresa' })).toBeNull();
    await userEvent
      .setup()
      .click(screen.getAllByRole('button', { name: 'Crear empresa' })[1]!);
    expect(formulario()).toBeInTheDocument();
    expect(razon()).toBeInTheDocument();
    expect(rfc()).toHaveAccessibleDescription(
      '12 o 13 caracteres. Se guarda en mayúsculas y sin espacios.',
    );
  });

  it('cancelar cierra el formulario sin llamar a la API', async () => {
    const usuario = await abrirFormulario();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('form', { name: 'Crear empresa' })).toBeNull();
    expect(cuerposCrearEmpresa).toHaveLength(0);
  });

  it('al crear muestra el aviso, cierra el formulario y agrega la fila', async () => {
    const usuario = await abrirFormulario();
    await usuario.type(razon(), 'Ferretería Aurora S.A. de C.V.');
    await usuario.type(rfc(), 'FAU210215QK4');
    await usuario.click(crear());
    const aviso = (await screen.findAllByRole('status')).find((el) =>
      el.textContent?.includes('Empresa creada'),
    );
    expect(aviso).toBeDefined();
    expect(aviso).toHaveTextContent('Empresa creada');
    expect(aviso).toHaveTextContent(
      'Ferretería Aurora S.A. de C.V. ya aparece en la lista.',
    );
    const tabla = await screen.findByRole('table', {
      name: 'Lista de empresas',
    });
    expect(within(tabla).getByText('FAU210215QK4')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Crear empresa' })).toBeNull();
  });

  it('manda el RFC normalizado (mayúsculas, sin espacios) y la razón social', async () => {
    const usuario = await abrirFormulario();
    await usuario.type(razon(), 'Servicios Contables Lupita');
    await usuario.type(rfc(), ' scl 950312 ab3 ');
    await usuario.click(crear());
    await screen.findByRole('table', { name: 'Lista de empresas' });
    expect(cuerposCrearEmpresa).toEqual([
      { razonSocial: 'Servicios Contables Lupita', rfc: 'SCL950312AB3' },
    ]);
  });

  it('un RFC de formato inválido dice qué está mal bajo el campo RFC', async () => {
    const usuario = await abrirFormulario();
    await usuario.type(razon(), 'Ferretería Aurora');
    await usuario.type(rfc(), 'fau2102');
    await usuario.click(crear());
    await waitFor(() => expect(rfc()).toHaveAttribute('aria-invalid', 'true'));
    expect(rfc()).toHaveAccessibleDescription(
      'El RFC no tiene un formato válido: debe tener 12 o 13 caracteres (3 o 4 letras, fecha AAMMDD y homoclave).',
    );
    expect(formulario()).toBeInTheDocument();
    expect(rfc()).toHaveValue('fau2102');
    expect(screen.queryByText('Empresa creada')).toBeNull();
  });

  it('un RFC genérico dice que no puede usarse para una empresa', async () => {
    const usuario = await abrirFormulario();
    await usuario.type(razon(), 'Público en general');
    await usuario.type(rfc(), 'XAXX010101000');
    await usuario.click(crear());
    await waitFor(() => expect(rfc()).toHaveAttribute('aria-invalid', 'true'));
    expect(rfc()).toHaveAccessibleDescription(
      'Este RFC es genérico (público en general o extranjero) y no puede usarse para una empresa.',
    );
  });

  it('el servidor decide: un 400 sin motivo reconocible no culpa a un RFC válido en forma', async () => {
    const usuario = await abrirFormulario();
    crearEmpresaPlataformaFalla(400);
    await usuario.type(razon(), 'Ferretería Aurora');
    await usuario.type(rfc(), 'FAU210215QK4');
    await usuario.click(crear());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo completar la solicitud.');
    expect(alerta).not.toHaveTextContent('texto del servidor');
    expect(rfc()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('un RFC repetido (con otras mayúsculas) muestra la alerta de duplicado y no crea nada', async () => {
    sembrarEmpresasPlataforma(EMPRESAS);
    sesionPlataformaAbierta();
    montarPlataforma('/plataforma');
    await verInterna();
    await screen.findByRole('table', { name: 'Lista de empresas' });
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole('button', { name: 'Crear empresa' }));
    await usuario.type(razon(), 'Otra Aurora');
    await usuario.type(rfc(), 'fau210215qk4');
    await usuario.click(crear());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Ese RFC ya pertenece a otra empresa');
    expect(alerta).toHaveTextContent('No se creó nada.');
    expect(formulario()).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('un fallo de red muestra la alerta de conexión y conserva lo escrito', async () => {
    const usuario = await abrirFormulario();
    crearEmpresaPlataformaRedDeFallo();
    await usuario.type(razon(), 'Ferretería Aurora');
    await usuario.type(rfc(), 'FAU210215QK4');
    await usuario.click(crear());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(razon()).toHaveValue('Ferretería Aurora');
    expect(rfc()).toHaveValue('FAU210215QK4');
  });

  it('con campos vacíos pide escribirlos sin llamar a la API', async () => {
    const usuario = await abrirFormulario();
    await usuario.click(crear());
    expect(await screen.findByText('Escribe la razón social')).toBeVisible();
    expect(screen.getByText('Escribe el RFC')).toBeVisible();
    expect(cuerposCrearEmpresa).toHaveLength(0);
  });

  it('un 401 al crear termina la sesión con el aviso de sesión terminada', async () => {
    const usuario = await abrirFormulario();
    crearEmpresaPlataformaFalla(401);
    await usuario.type(razon(), 'Ferretería Aurora');
    await usuario.type(rfc(), 'FAU210215QK4');
    await usuario.click(crear());
    expect(
      await screen.findByText(
        'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
      ),
    ).toBeInTheDocument();
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
