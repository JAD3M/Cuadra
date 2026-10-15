import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { DESCRIPCIONES_ROL, ETIQUETAS_ROL } from '@/shared/dominio';
import type { SessionState } from '@/shared/sesion';
import { contextoSesion } from '@/shared/api/contratos';
import { crearCompuerta } from '@/test/compuerta';
import {
  CONTEXTO_SESION,
  SESION_LISTA,
  capacidadesDeRoles,
} from '@/test/fixtures';
import {
  invitacionesUsuarioRecibidas,
  invitarUsuarioConCompuerta,
  invitarUsuarioFalla,
  invitarUsuarioRedDeFallo,
  invitarUsuarioResponde,
  usarHandlersUsuarios,
} from '@/test/handlersUsuarios';
import { clienteDePruebas, envoltura } from '@/test/montarBandeja';
import { UsuariosPage } from './UsuariosPage';

beforeEach(() => {
  usarHandlersUsuarios();
});

function montar(estado?: () => SessionState) {
  return render(<UsuariosPage />, {
    wrapper: envoltura(clienteDePruebas(), estado),
  });
}

function sesionConRoles(roles: string[]): SessionState {
  return {
    ...SESION_LISTA,
    contexto: contextoSesion.parse({
      ...CONTEXTO_SESION,
      roles,
      capacidades: capacidadesDeRoles(roles),
    }),
  } as SessionState;
}

const correo = () => screen.getByLabelText('Correo');
const rol = (nombre: string) =>
  screen.getByRole('checkbox', { name: new RegExp(`^${nombre}`) });
const enviar = () =>
  screen.getByRole('button', { name: /Enviar invitación|Enviando/ });

async function llenar(email: string, roles: string[]) {
  const u = userEvent.setup();
  if (email !== '') await u.type(correo(), email);
  for (const r of roles) await u.click(rol(r));
  return u;
}

/**
 * El aviso de éxito de invitar. Con la lista de pendientes en pantalla (2.4)
 * hay más de un `status`, así que se busca por su texto.
 */
async function confirmacion(): Promise<HTMLElement> {
  const titulo = await screen.findByText(
    'Si el correo es válido, la persona recibirá una invitación.',
  );
  return titulo.closest('[role="status"]') as HTMLElement;
}

const SIN_PERMISO = 'No tienes permiso para esta acción.';

describe('UsuariosPage: formulario de invitar', () => {
  it('muestra el correo, los cuatro roles con su descripción y la ayuda de 7 días', () => {
    montar();
    const formulario = screen.getByRole('form', {
      name: 'Invitar a una persona',
    });
    expect(
      within(formulario).getByRole('heading', {
        name: 'Invitar a una persona',
      }),
    ).toBeInTheDocument();
    expect(correo()).toHaveValue('');
    expect(correo()).toHaveAttribute('placeholder', 'nombre@empresa.mx');
    const casillas = within(formulario).getAllByRole('checkbox');
    expect(casillas).toHaveLength(4);
    for (const casilla of casillas) expect(casilla).not.toBeChecked();
    for (const nombre of Object.values(ETIQUETAS_ROL)) {
      expect(screen.getByText(nombre)).toBeInTheDocument();
    }
    for (const descripcion of Object.values(DESCRIPCIONES_ROL)) {
      expect(screen.getByText(descripcion)).toBeInTheDocument();
    }
    expect(
      screen.getByText('Elige al menos uno. Puedes combinar varios.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('El enlace vence en 7 días y sirve una sola vez.'),
    ).toBeInTheDocument();
    expect(enviar()).toHaveTextContent('Enviar invitación');
    expect(enviar()).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un correo sin forma válida marca el campo y no llama a la API (error_correo)', async () => {
    montar();
    const u = await llenar('marta.nunez@ferreteria', ['Contador']);
    await u.click(enviar());
    expect(
      await screen.findByText(
        'Escribe un correo válido, por ejemplo nombre@empresa.mx.',
      ),
    ).toBeInTheDocument();
    expect(correo()).toHaveAttribute('aria-invalid', 'true');
    expect(correo()).toHaveFocus();
    expect(invitacionesUsuarioRecibidas).toHaveLength(0);
  });

  it('sin ningún rol muestra «Elige al menos un rol.» y no llama a la API (error_roles)', async () => {
    montar();
    const u = await llenar('marta.nunez@ferreteria.mx', []);
    await u.click(enviar());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Elige al menos un rol.',
    );
    expect(invitacionesUsuarioRecibidas).toHaveLength(0);
    // Marcar un rol retira el error.
    await u.click(rol('Auditor'));
    expect(screen.queryByText('Elige al menos un rol.')).toBeNull();
  });

  it('manda el correo recortado y los roles en el orden del espejo, y limpia el formulario al terminar', async () => {
    montar();
    const u = await llenar('  marta.nunez@ferreteria.mx ', [
      'Revisor',
      'Contador',
    ]);
    await u.click(enviar());
    const estado = await confirmacion();
    expect(invitacionesUsuarioRecibidas).toEqual([
      { email: 'marta.nunez@ferreteria.mx', roles: ['contador', 'revisor'] },
    ]);
    expect(estado).toHaveTextContent(
      'Si el correo es válido, la persona recibirá una invitación.',
    );
    expect(estado).toHaveTextContent('marta.nunez@ferreteria.mx');
    expect(within(estado).getByText('Contador')).toBeInTheDocument();
    expect(within(estado).getByText('Revisor')).toBeInTheDocument();
    expect(within(estado).queryByText('Auditor')).toBeNull();
    expect(
      within(estado).getByText(
        'El enlace vence en 7 días y sirve una sola vez.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Correo')).toBeNull();

    await u.click(
      screen.getByRole('button', { name: 'Invitar a otra persona' }),
    );
    expect(correo()).toHaveValue('');
    for (const casilla of screen.getAllByRole('checkbox')) {
      expect(casilla).not.toBeChecked();
    }
  });

  it('el mismo texto de éxito sale con el correo escrito, nunca con el de la respuesta', async () => {
    invitarUsuarioResponde({ email: 'otra@cuenta.mx', roles: ['auditor'] });
    montar();
    const u = await llenar('marta@ferreteria.mx', ['Auditor']);
    await u.click(enviar());
    const estado = await confirmacion();
    expect(estado).toHaveTextContent('marta@ferreteria.mx');
    expect(estado).not.toHaveTextContent('otra@cuenta.mx');
    expect(estado).toHaveTextContent(
      'Si el correo es válido, la persona recibirá una invitación.',
    );
  });

  it('mientras envía bloquea el formulario, anuncia el estado y no duplica el envío (enviando)', async () => {
    const compuerta = crearCompuerta();
    invitarUsuarioConCompuerta(compuerta.promesa);
    montar();
    const u = await llenar('marta@ferreteria.mx', ['Contador']);
    await u.click(enviar());
    await waitFor(() => expect(enviar()).toBeDisabled());
    expect(enviar()).toHaveTextContent('Enviando invitación…');
    expect(correo()).toBeDisabled();
    expect(rol('Contador')).toBeDisabled();
    expect(
      screen.getByRole('form', { name: 'Invitar a una persona' }),
    ).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Enviando la invitación')).toBeInTheDocument();
    compuerta.abrir();
    await screen.findByText(
      'Si el correo es válido, la persona recibirá una invitación.',
    );
    expect(invitacionesUsuarioRecibidas).toHaveLength(1);
  });
});

describe('UsuariosPage: fallos de la API', () => {
  async function intentar() {
    montar();
    const u = await llenar('marta@ferreteria.mx', ['Contador', 'Revisor']);
    await u.click(enviar());
    return u;
  }

  it.each([
    [429, 'Demasiados intentos. Espera un momento e inténtalo de nuevo.', null],
    [503, 'No se pudo enviar el correo. Inténtalo de nuevo.', null],
    [
      500,
      'No se pudo completar la solicitud.',
      'Inténtalo de nuevo en unos minutos.',
    ],
  ])(
    'un %i muestra su alerta sin texto del servidor y conserva lo escrito',
    async (estado, titulo, detalle) => {
      invitarUsuarioFalla(estado);
      await intentar();
      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent(titulo);
      if (detalle) expect(alerta).toHaveTextContent(detalle);
      expect(screen.queryByText(/texto del servidor/)).toBeNull();
      expect(correo()).toHaveValue('marta@ferreteria.mx');
      expect(rol('Contador')).toBeChecked();
      expect(rol('Revisor')).toBeChecked();
      expect(enviar()).toBeEnabled();
    },
  );

  it('un fallo de red muestra «No se pudo conectar con el servidor» (error_conexion)', async () => {
    invitarUsuarioRedDeFallo();
    await intentar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).toHaveTextContent(
      'Revisa tu conexión e inténtalo de nuevo.',
    );
    expect(correo()).toHaveValue('marta@ferreteria.mx');
  });

  it('un 400 marca el correo con la corrección del mockup', async () => {
    invitarUsuarioFalla(400);
    await intentar();
    expect(
      await screen.findByText(
        'Escribe un correo válido, por ejemplo nombre@empresa.mx.',
      ),
    ).toBeInTheDocument();
    expect(correo()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/texto del servidor/)).toBeNull();
  });

  it('un 403 reemplaza el formulario por el aviso de sin permiso (error_permiso)', async () => {
    invitarUsuarioFalla(403);
    await intentar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(SIN_PERMISO);
    expect(screen.queryByLabelText('Correo')).toBeNull();
  });

  it('tras un fallo se puede reintentar y el éxito retira la alerta', async () => {
    invitarUsuarioFalla(503);
    const u = await intentar();
    await screen.findByRole('alert');
    usarHandlersUsuarios();
    await u.click(enviar());
    await screen.findByText(
      'Si el correo es válido, la persona recibirá una invitación.',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('UsuariosPage: permiso de gestionar', () => {
  it.each([['contador'], ['revisor'], ['auditor']])(
    'con el rol %s no hay formulario y se muestra el aviso de sin permiso',
    (r) => {
      montar(() => sesionConRoles([r]));
      expect(screen.getByRole('alert')).toHaveTextContent(SIN_PERMISO);
      expect(
        screen.getByText(
          'Si crees que es un error, pide acceso a un administrador de la empresa.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole('form')).toBeNull();
      expect(screen.queryByLabelText('Correo')).toBeNull();
    },
  );
});
