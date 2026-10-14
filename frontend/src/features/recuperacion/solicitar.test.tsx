import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { montarApp } from '@/test/montarApp';
import {
  correosPedidos,
  pedirRecuperacionFalla,
  usarHandlersRecuperacion,
} from '@/test/handlersRecuperacion';
import { sesionConEmpresa } from '@/test/sesionMock';

beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

beforeEach(() => {
  usarHandlersRecuperacion();
});

const titulo = () => screen.findByRole('heading', { level: 1 });
const correo = () => screen.getByLabelText('Correo');

async function pedir(email = 'tapia@despacho.mx') {
  const usuario = userEvent.setup();
  await titulo();
  await usuario.type(correo(), email);
  await usuario.click(screen.getByRole('button', { name: 'Enviar enlace' }));
}

describe('recuperar: pedir el enlace', () => {
  it('muestra el formulario del mockup', async () => {
    montarApp('/recuperar');
    expect(await titulo()).toHaveTextContent('¿Olvidaste tu contraseña?');
    expect(
      within(screen.getByRole('main')).getByText('Recuperar acceso'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Escribe tu correo. Si hay una cuenta con él, te enviaremos un enlace para crear una contraseña nueva. El enlace dura 1 hora.',
      ),
    ).toBeInTheDocument();
    expect(correo()).toHaveAttribute('type', 'email');
    expect(
      screen.getByRole('button', { name: 'Enviar enlace' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '← Volver a iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
  });

  it('un correo sin forma válida no llama a la API', async () => {
    montarApp('/recuperar');
    const usuario = userEvent.setup();
    await titulo();
    await usuario.type(correo(), 'no-es-correo');
    await usuario.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(correo()).toHaveAttribute('aria-invalid', 'true');
    expect(correosPedidos).toHaveLength(0);
  });

  it('con un correo envía y muestra «Revisa tu correo» con el enlace al login', async () => {
    montarApp('/recuperar');
    await pedir('  Tapia@Despacho.mx ');
    expect(
      await screen.findByRole('heading', { name: 'Revisa tu correo' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Si hay una cuenta con ese correo, te enviamos un enlace. Dura 1 hora y solo se puede usar una vez.',
      ),
    ).toBeInTheDocument();
    expect(correosPedidos).toEqual(['Tapia@Despacho.mx']);
    expect(
      screen.getByRole('link', { name: 'Ir a iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
    expect(screen.queryByLabelText('Correo')).toBeNull();
  });

  it('muestra lo mismo para cualquier correo: el texto no depende de la respuesta', async () => {
    montarApp('/recuperar');
    await pedir('nadie@ninguna-parte.mx');
    expect(
      await screen.findByRole('heading', { name: 'Revisa tu correo' }),
    ).toBeInTheDocument();
  });

  it('un 429 muestra la alerta y conserva el formulario con el correo', async () => {
    pedirRecuperacionFalla(429);
    montarApp('/recuperar');
    await pedir();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(correo()).toHaveValue('tapia@despacho.mx');
    expect(
      screen.queryByRole('heading', { name: 'Revisa tu correo' }),
    ).toBeNull();
  });

  it('un 503 muestra la alerta de conexión', async () => {
    pedirRecuperacionFalla(503);
    montarApp('/recuperar');
    await pedir();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
  });

  it('es una ruta pública: con sesión viva no redirige', async () => {
    sesionConEmpresa();
    const { router } = montarApp('/recuperar');
    expect(await titulo()).toHaveTextContent('¿Olvidaste tu contraseña?');
    expect(router.state.location.pathname).toBe('/recuperar');
  });

  it('tiene un solo main y un solo h1, con el control de tema', async () => {
    montarApp('/recuperar');
    await titulo();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      within(screen.getByRole('main')).getByRole('group', { name: 'Tema' }),
    ).toBeInTheDocument();
  });

  it('volver a iniciar sesión lleva a /login', async () => {
    const { router } = montarApp('/recuperar');
    await titulo();
    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: '← Volver a iniciar sesión' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});
