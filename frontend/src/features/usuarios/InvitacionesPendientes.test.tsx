import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { contextoSesion } from '@/shared/api/contratos';
import type { SessionState } from '@/shared/sesion';
import { crearCompuerta } from '@/test/compuerta';
import {
  CONTEXTO_SESION,
  SESION_LISTA,
  capacidadesDeRoles,
} from '@/test/fixtures';
import {
  accionPendienteFalla,
  accionPendienteRedDeFallo,
  accionesPendientesRecibidas,
  invitacionPendiente,
  listadosPendientesPedidos,
  listarPendientesFalla,
  listarPendientesRedDeFallo,
  pendientesDelMockup,
  usarHandlersUsuarios,
} from '@/test/handlersUsuarios';
import { clienteDePruebas, envoltura } from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import { UsuariosPage } from './UsuariosPage';

// Historia 2.4: la lista de invitaciones pendientes con reenviar y cancelar,
// sobre `Usuarios.dc.html` (vistas `pendientes*`, `confirmar_cancelar`,
// `reenviado`, `cancelada`, `ya_aceptada`, `no_pendiente`,
// `reenvio_error_envio` y `reenvio_limite`).

const MARTA = 'marta.nunez@ferreteria.mx';
const CAMILA = 'camila.ortega@ferreteria.mx';
const RODRIGO = 'rodrigo.salas@ferreteria.mx';

beforeEach(() => {
  usarHandlersUsuarios(pendientesDelMockup());
});

function montar(estado?: () => SessionState) {
  return render(<UsuariosPage />, {
    wrapper: envoltura(clienteDePruebas(), estado),
  });
}

function sesionConCapacidades(capacidades: string[]): SessionState {
  return {
    ...SESION_LISTA,
    contexto: contextoSesion.parse({
      ...CONTEXTO_SESION,
      capacidades,
    }),
  } as SessionState;
}

const seccion = () =>
  screen.getByRole('region', { name: 'Invitaciones pendientes' });
const fila = (correo: string) =>
  within(seccion())
    .getAllByRole('row')
    .find((f) => within(f).queryByText(correo) !== null)!;
const reenviar = (correo: string) =>
  screen.getByRole('button', { name: `Reenviar invitación a ${correo}` });
const cancelar = (correo: string) =>
  screen.getByRole('button', { name: `Cancelar invitación a ${correo}` });

async function listaLista() {
  await within(
    await screen.findByRole('region', {
      name: 'Invitaciones pendientes',
    }),
  ).findByRole('table');
}

describe('invitaciones pendientes: la lista', () => {
  it('muestra título, ayuda y las columnas del mockup', async () => {
    montar();
    await listaLista();
    expect(
      within(seccion()).getByRole('heading', {
        level: 2,
        name: 'Invitaciones pendientes',
      }),
    ).toBeInTheDocument();
    expect(
      within(seccion()).getByText(
        'Personas invitadas que todavía no aceptan. Las más recientes van primero.',
      ),
    ).toBeInTheDocument();
    const columnas = within(seccion())
      .getAllByRole('columnheader')
      .map((c) => c.textContent);
    expect(columnas).toEqual([
      'Correo',
      'Roles',
      'Enviada',
      'Vence',
      'Invitada por',
      'Acciones',
    ]);
  });

  it('cada fila trae correo, roles, fecha de envío, vencimiento e invitador', async () => {
    montar();
    await listaLista();
    const marta = fila(MARTA);
    expect(within(marta).getByText('Contador')).toBeInTheDocument();
    expect(within(marta).getByText('Revisor')).toBeInTheDocument();
    expect(within(marta).getByText('2026-10-14')).toBeInTheDocument();
    expect(within(marta).getByText('Vence en 6 días')).toBeInTheDocument();
    expect(within(marta).getByText('Ana Mendoza')).toBeInTheDocument();
    // Las de la plataforma no tienen persona que las invitara.
    expect(within(fila(CAMILA)).getByText('Plataforma')).toBeInTheDocument();
    expect(within(fila(CAMILA)).getByText('Administrador')).toBeInTheDocument();
  });

  it('una vencida dice «Vencida» y conserva Reenviar y Cancelar', async () => {
    montar();
    await listaLista();
    expect(within(fila(RODRIGO)).getByText('Vencida')).toBeInTheDocument();
    expect(reenviar(RODRIGO)).toBeEnabled();
    expect(cancelar(RODRIGO)).toBeEnabled();
  });

  it('«vencida» la decide el servidor, no el reloj del navegador', async () => {
    usarHandlersUsuarios([
      invitacionPendiente({ venceEnDias: -3, vencida: false }),
      invitacionPendiente({
        id: '55555555-5555-4555-8555-555555555555',
        email: 'otra@ferreteria.mx',
        venceEnDias: 5,
        vencida: true,
      }),
    ]);
    montar();
    await listaLista();
    expect(within(fila(MARTA)).queryByText('Vencida')).toBeNull();
    expect(
      within(fila('otra@ferreteria.mx')).getByText('Vencida'),
    ).toBeInTheDocument();
  });

  it('cada botón nombra a la persona (aria-label)', async () => {
    montar();
    await listaLista();
    expect(reenviar(MARTA)).toHaveTextContent('Reenviar');
    expect(cancelar(MARTA)).toHaveTextContent('Cancelar');
  });

  it('mientras carga muestra un estado de carga y no la tabla', async () => {
    const compuerta = crearCompuerta();
    servidor.use(
      http.get('/api/usuarios/invitaciones', async () => {
        await compuerta.promesa;
        return HttpResponse.json([]);
      }),
    );
    montar();
    const region = await screen.findByRole('region', {
      name: 'Invitaciones pendientes',
    });
    expect(within(region).getByRole('status')).toHaveTextContent(
      'Cargando invitaciones',
    );
    expect(within(region).queryByRole('table')).toBeNull();
    compuerta.abrir();
    expect(
      await within(region).findByText(/No hay invitaciones pendientes/),
    ).toBeInTheDocument();
  });

  it('sin pendientes lo dice (pendientes_vacio)', async () => {
    usarHandlersUsuarios([]);
    montar();
    expect(
      await screen.findByText(
        'No hay invitaciones pendientes. Las que envíes aparecerán aquí hasta que se acepten.',
      ),
    ).toBeInTheDocument();
    expect(within(seccion()).queryByRole('table')).toBeNull();
  });

  it('si no carga muestra el error y «Reintentar» vuelve a pedirla (pendientes_error)', async () => {
    listarPendientesFalla(500);
    montar();
    const alerta = await within(
      await screen.findByRole('region', { name: 'Invitaciones pendientes' }),
    ).findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo cargar las invitaciones.');
    // El formulario de invitar sigue disponible.
    expect(
      screen.getByRole('form', { name: 'Invitar a una persona' }),
    ).toBeInTheDocument();

    usarHandlersUsuarios(pendientesDelMockup());
    await userEvent
      .setup()
      .click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    await listaLista();
    expect(fila(MARTA)).toBeInTheDocument();
  });

  it('un fallo de red en la lista muestra el mismo error', async () => {
    listarPendientesRedDeFallo();
    montar();
    expect(
      await screen.findByText('No se pudo cargar las invitaciones.'),
    ).toBeInTheDocument();
  });

  it('una lista que no cumple el contrato no se pinta', async () => {
    servidor.use(
      http.get('/api/usuarios/invitaciones', () =>
        HttpResponse.json([{ id: 1 }]),
      ),
    );
    montar();
    expect(
      await screen.findByText('No se pudo cargar las invitaciones.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('invitaciones pendientes: reenviar', () => {
  it('reenvía, avisa en la fila y la lista muestra el vencimiento nuevo', async () => {
    montar();
    await listaLista();
    const antes = listadosPendientesPedidos.cuenta;
    const u = userEvent.setup();
    await u.click(reenviar(MARTA));
    const estado = await within(seccion()).findByRole('status');
    expect(estado).toHaveTextContent(
      `Invitación reenviada a ${MARTA}. El enlace anterior ya no sirve.`,
    );
    expect(accionesPendientesRecibidas).toEqual([
      { accion: 'reenviar', id: '11111111-1111-4111-8111-111111111111' },
    ]);
    await waitFor(() =>
      expect(listadosPendientesPedidos.cuenta).toBeGreaterThan(antes),
    );
    // La fila nueva (otro id) lleva el aviso y la caducidad renovada.
    await waitFor(() =>
      expect(
        within(fila(MARTA)).getByText('Vence en 7 días'),
      ).toBeInTheDocument(),
    );
    expect(within(seccion()).getByRole('status')).toHaveTextContent(
      'Invitación reenviada',
    );
  });

  it.each([
    [
      'ya_aceptada',
      409,
      'Esta invitación ya fue aceptada y no se puede reenviar.',
      'Esta invitación ya fue aceptada y no se puede reenviar.',
    ],
    [
      'no_pendiente',
      409,
      'Esta invitación ya no está pendiente.',
      'Esta invitación ya no está pendiente.',
    ],
    [
      'reenvio_error_envio',
      503,
      'texto del servidor',
      'No se pudo enviar el correo. Inténtalo de nuevo.',
    ],
    [
      'reenvio_limite',
      429,
      'texto del servidor',
      'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
    ],
    [
      'permiso',
      403,
      'texto del servidor',
      'No tienes permiso para esta acción.',
    ],
    ['otro', 500, 'texto del servidor', 'No se pudo completar la solicitud.'],
  ])(
    '%s (HTTP %i) muestra el aviso de error en su fila',
    async (_vista, status, mensajeServidor, esperado) => {
      accionPendienteFalla('reenviar', status, mensajeServidor);
      montar();
      await listaLista();
      await userEvent.setup().click(reenviar(MARTA));
      const alerta = await within(seccion()).findByRole('alert');
      expect(alerta).toHaveTextContent(esperado);
      // La fila sigue ahí y el texto del servidor no se cuela en errores no 409.
      expect(fila(MARTA)).toBeInTheDocument();
      if (status !== 409) {
        expect(alerta).not.toHaveTextContent('texto del servidor');
      }
    },
  );

  it('un 409 no vuelve a pedir la lista: la fila y su mensaje siguen', async () => {
    accionPendienteFalla(
      'reenviar',
      409,
      'Esta invitación ya fue aceptada y no se puede reenviar.',
    );
    montar();
    await listaLista();
    const antes = listadosPendientesPedidos.cuenta;
    await userEvent.setup().click(reenviar(MARTA));
    await within(seccion()).findByRole('alert');
    expect(listadosPendientesPedidos.cuenta).toBe(antes);
    expect(fila(MARTA)).toBeInTheDocument();
  });

  it('sin conexión muestra el aviso de conexión', async () => {
    accionPendienteRedDeFallo('reenviar');
    montar();
    await listaLista();
    await userEvent.setup().click(reenviar(MARTA));
    expect(await within(seccion()).findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
  });

  it('una acción nueva retira el aviso anterior de otra fila', async () => {
    accionPendienteFalla('reenviar', 503);
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(reenviar(MARTA));
    await within(seccion()).findByRole('alert');
    usarHandlersUsuarios(pendientesDelMockup());
    await u.click(reenviar(CAMILA));
    await within(seccion()).findByRole('status');
    expect(within(seccion()).queryByRole('alert')).toBeNull();
  });
});

describe('invitaciones pendientes: cancelar', () => {
  it('Cancelar abre la confirmación en la fila, sin llamar a la API (confirmar_cancelar)', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    expect(cancelar(MARTA)).toHaveAttribute('aria-expanded', 'false');
    await u.click(cancelar(MARTA));
    const grupo = screen.getByRole('group', { name: 'Confirmar cancelación' });
    expect(grupo).toHaveTextContent(
      `¿Cancelar la invitación a ${MARTA}? El enlace dejará de servir.`,
    );
    expect(cancelar(MARTA)).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(grupo).getByRole('button', { name: 'Sí, cancelar' }),
    ).toBeInTheDocument();
    // El foco cae en la salida segura, no en la acción destructiva.
    expect(within(grupo).getByRole('button', { name: 'Volver' })).toHaveFocus();
    expect(accionesPendientesRecibidas).toHaveLength(0);
  });

  it('Volver cierra la confirmación, devuelve el foco y no cancela nada', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cancelar(MARTA));
    await u.click(screen.getByRole('button', { name: 'Volver' }));
    expect(
      screen.queryByRole('group', { name: 'Confirmar cancelación' }),
    ).toBeNull();
    expect(cancelar(MARTA)).toHaveFocus();
    expect(cancelar(MARTA)).toHaveAttribute('aria-expanded', 'false');
    expect(accionesPendientesRecibidas).toHaveLength(0);
  });

  it('solo una confirmación abierta a la vez', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cancelar(MARTA));
    await u.click(cancelar(CAMILA));
    expect(
      screen.getAllByRole('group', { name: 'Confirmar cancelación' }),
    ).toHaveLength(1);
    expect(cancelar(MARTA)).toHaveAttribute('aria-expanded', 'false');
  });

  it('«Sí, cancelar» cancela, la fila sale y un aviso lo confirma (cancelada)', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cancelar(MARTA));
    await u.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    expect(await within(seccion()).findByRole('status')).toHaveTextContent(
      `Invitación a ${MARTA} cancelada.`,
    );
    expect(accionesPendientesRecibidas).toEqual([
      { accion: 'cancelar', id: '11111111-1111-4111-8111-111111111111' },
    ]);
    await waitFor(() =>
      expect(
        within(seccion()).queryByText(MARTA, { selector: 'td' }),
      ).toBeNull(),
    );
    expect(fila(CAMILA)).toBeInTheDocument();
  });

  it('cancelar la última deja la lista vacía y conserva el aviso', async () => {
    usarHandlersUsuarios([pendientesDelMockup()[0]!]);
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cancelar(MARTA));
    await u.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    expect(
      await screen.findByText(/No hay invitaciones pendientes/),
    ).toBeInTheDocument();
    expect(
      within(seccion()).getByText(`Invitación a ${MARTA} cancelada.`),
    ).toBeInTheDocument();
  });

  it.each([
    [
      409,
      'Esta invitación ya fue aceptada y no se puede cancelar.',
      'Esta invitación ya fue aceptada y no se puede cancelar.',
    ],
    [
      409,
      'Esta invitación ya no está pendiente.',
      'Esta invitación ya no está pendiente.',
    ],
    [429, 'x', 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'],
    [500, 'x', 'No se pudo completar la solicitud.'],
  ])(
    'HTTP %i al cancelar muestra el aviso en la fila y cierra la confirmación',
    async (status, mensajeServidor, esperado) => {
      accionPendienteFalla('cancelar', status, mensajeServidor);
      montar();
      await listaLista();
      const u = userEvent.setup();
      await u.click(cancelar(MARTA));
      await u.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
      expect(await within(seccion()).findByRole('alert')).toHaveTextContent(
        esperado,
      );
      expect(
        screen.queryByRole('group', { name: 'Confirmar cancelación' }),
      ).toBeNull();
      expect(fila(MARTA)).toBeInTheDocument();
    },
  );

  it('sin conexión al cancelar muestra el aviso de conexión', async () => {
    accionPendienteRedDeFallo('cancelar');
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cancelar(MARTA));
    await u.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    expect(await within(seccion()).findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
  });
});

describe('invitaciones pendientes: permisos y refresco', () => {
  it('sin `usuarios.gestionar` la lista no trae Reenviar ni Cancelar ni el formulario', async () => {
    const capacidades = capacidadesDeRoles(['admin']).filter(
      (c: string) => c !== 'usuarios.gestionar',
    );
    montar(() => sesionConCapacidades(capacidades));
    await listaLista();
    expect(screen.queryByRole('button', { name: /^Reenviar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Cancelar/ })).toBeNull();
    expect(
      screen.queryByRole('form', { name: 'Invitar a una persona' }),
    ).toBeNull();
    expect(
      within(seccion()).queryByRole('columnheader', { name: 'Acciones' }),
    ).toBeNull();
  });

  it('sin `usuarios.ver` ni `usuarios.gestionar` no hay lista y no se pide', async () => {
    montar(() => sesionConCapacidades([]));
    expect(
      await screen.findByText('No tienes permiso para esta acción.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Invitaciones pendientes' }),
    ).toBeNull();
    expect(listadosPendientesPedidos.cuenta).toBe(0);
  });

  it('tras invitar, la lista se vuelve a pedir y trae la nueva', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Correo'), 'luis@ferreteria.mx');
    await u.click(screen.getByRole('checkbox', { name: /^Auditor/ }));
    await u.click(screen.getByRole('button', { name: 'Enviar invitación' }));
    await screen.findByText(
      'Si el correo es válido, la persona recibirá una invitación.',
    );
    await waitFor(() =>
      expect(
        within(seccion()).getByText('luis@ferreteria.mx'),
      ).toBeInTheDocument(),
    );
  });
});
