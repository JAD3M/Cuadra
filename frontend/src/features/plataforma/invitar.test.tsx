import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  invitacionesRecibidas,
  invitarPlataformaFalla,
  invitarPlataformaRedDeFallo,
  invitarPlataformaResponde,
  sembrarEmpresasPlataforma,
  sesionPlataformaAbierta,
  usarHandlersPlataforma,
} from '@/test/handlersPlataforma';
import { montarPlataforma } from '@/test/montarRutas';

const AURORA = {
  id: '00000000-0000-4000-8000-0000000000a1',
  razonSocial: 'Ferretería Aurora S.A. de C.V.',
  rfc: 'FAU210215QK4',
};
const NORTE = {
  id: '00000000-0000-4000-8000-0000000000a2',
  razonSocial: 'Distribuidora del Norte S.A. de C.V.',
  rfc: 'DNO180904TB7',
};

beforeEach(() => {
  usarHandlersPlataforma();
  sembrarEmpresasPlataforma([AURORA, NORTE]);
  sesionPlataformaAbierta();
});

async function abrirPanel(razonSocial = AURORA.razonSocial) {
  montarPlataforma('/plataforma');
  const boton = await screen.findByRole('button', {
    name: `Invitar administrador de ${razonSocial}`,
  });
  const usuario = userEvent.setup();
  await usuario.click(boton);
  return usuario;
}

const campo = () => screen.getByLabelText('Correo del administrador');
const enviar = () =>
  screen.getByRole('button', { name: /Enviar invitación|Enviando/ });

describe('plataforma: invitar administrador', () => {
  it('la lista trae la columna «Acciones» y un botón por empresa', async () => {
    montarPlataforma('/plataforma');
    expect(
      await screen.findByRole('columnheader', { name: 'Acciones' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /^Invitar administrador de / }),
    ).toHaveLength(2);
    expect(
      screen.queryByRole('form', { name: 'Invitar administrador' }),
    ).toBeNull();
  });

  it('abre el panel con el título de la empresa, el campo vacío y la ayuda de 7 días', async () => {
    await abrirPanel();
    const panel = screen.getByRole('form', { name: 'Invitar administrador' });
    expect(
      within(panel).getByRole('heading', {
        name: `Invitar administrador de ${AURORA.razonSocial}`,
      }),
    ).toBeInTheDocument();
    expect(campo()).toHaveValue('');
    expect(campo()).toHaveFocus();
    expect(
      within(panel).getByText(
        'La persona recibirá un enlace válido por 7 días.',
      ),
    ).toBeInTheDocument();
  });

  it('un correo sin forma válida marca el campo y no llama a la API', async () => {
    const usuario = await abrirPanel();
    await usuario.type(campo(), 'admin@aurora');
    await usuario.click(enviar());
    expect(
      await screen.findByText('Escribe un correo válido.'),
    ).toBeInTheDocument();
    expect(campo()).toHaveAttribute('aria-invalid', 'true');
    expect(campo()).toHaveFocus();
    expect(invitacionesRecibidas).toHaveLength(0);
  });

  it('un correo vacío tampoco se envía', async () => {
    const usuario = await abrirPanel();
    await usuario.click(enviar());
    expect(
      await screen.findByText('Escribe un correo válido.'),
    ).toBeInTheDocument();
    expect(invitacionesRecibidas).toHaveLength(0);
  });

  it('envía `{ email }` a la empresa elegida y muestra el aviso con el correo escrito', async () => {
    const usuario = await abrirPanel(NORTE.razonSocial);
    await usuario.type(campo(), '  admin@norte.mx ');
    await usuario.click(enviar());
    expect(
      await screen.findByText('Invitación enviada a admin@norte.mx.'),
    ).toBeInTheDocument();
    expect(screen.getByText('El enlace vence en 7 días.')).toBeInTheDocument();
    expect(invitacionesRecibidas).toEqual([
      { empresaId: NORTE.id, cuerpo: { email: 'admin@norte.mx' } },
    ]);
    // El panel se cierra.
    expect(
      screen.queryByRole('form', { name: 'Invitar administrador' }),
    ).toBeNull();
  });

  it('el texto de éxito no depende de la respuesta (no revela si hay cuenta)', async () => {
    invitarPlataformaResponde({
      email: 'otro@correo.mx',
      cuentaExistente: true,
    });
    const usuario = await abrirPanel();
    await usuario.type(campo(), 'admin@aurora.mx');
    await usuario.click(enviar());
    expect(
      await screen.findByText('Invitación enviada a admin@aurora.mx.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/otro@correo\.mx/)).toBeNull();
    expect(screen.queryByText(/cuenta/i)).toBeNull();
  });

  it('con 503 muestra «No se pudo enviar el correo.», conserva el correo y deja el panel abierto', async () => {
    invitarPlataformaFalla(503);
    const usuario = await abrirPanel();
    await usuario.type(campo(), 'admin@aurora.mx');
    await usuario.click(enviar());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo enviar el correo.');
    expect(alerta).toHaveTextContent('Inténtalo de nuevo.');
    expect(alerta).not.toHaveTextContent('texto del servidor');
    expect(campo()).toHaveValue('admin@aurora.mx');
  });

  it('con 429 muestra «Demasiadas invitaciones.» con su espera', async () => {
    invitarPlataformaFalla(429);
    const usuario = await abrirPanel();
    await usuario.type(campo(), 'admin@aurora.mx');
    await usuario.click(enviar());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Demasiadas invitaciones.');
    expect(alerta).toHaveTextContent(
      'Espera unos minutos e inténtalo de nuevo.',
    );
    expect(campo()).toHaveValue('admin@aurora.mx');
  });

  it('con fallo de red usa la alerta de conexión', async () => {
    invitarPlataformaRedDeFallo();
    const usuario = await abrirPanel();
    await usuario.type(campo(), 'admin@aurora.mx');
    await usuario.click(enviar());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
  });

  it('con 400 del servidor deja «Escribe un correo válido.» bajo el campo', async () => {
    invitarPlataformaFalla(400);
    const usuario = await abrirPanel();
    await usuario.type(campo(), 'admin@aurora.mx');
    await usuario.click(enviar());
    expect(
      await screen.findByText('Escribe un correo válido.'),
    ).toBeInTheDocument();
  });

  it('cancelar cierra el panel y quita el fallo', async () => {
    invitarPlataformaFalla(503);
    const usuario = await abrirPanel();
    await usuario.type(campo(), 'admin@aurora.mx');
    await usuario.click(enviar());
    await screen.findByRole('alert');
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('form', { name: 'Invitar administrador' }),
      ).toBeNull(),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un 401 termina la sesión de plataforma', async () => {
    invitarPlataformaFalla(401);
    const usuario = await abrirPanel();
    await usuario.type(campo(), 'admin@aurora.mx');
    await usuario.click(enviar());
    expect(
      await screen.findByText(
        'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
      ),
    ).toBeInTheDocument();
  });
});
