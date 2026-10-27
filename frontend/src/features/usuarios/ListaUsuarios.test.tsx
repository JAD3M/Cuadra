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
  accionRolesFalla,
  accionRolesRedDeFallo,
  accionesPendientesRecibidas,
  accionesRolesRecibidas,
  listadosUsuariosPedidos,
  listarUsuariosFalla,
  listarUsuariosRedDeFallo,
  personaActiva,
  personaPendiente,
  personasDelMockup,
  usarHandlersUsuarios,
} from '@/test/handlersUsuarios';
import { clienteDePruebas, envoltura } from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import { UsuariosPage } from './UsuariosPage';

// Historia 2.5: la lista única «Personas de tu empresa» (activas y con
// invitación pendiente) con reenviar y cancelar de la 2.4 en las pendientes,
// sobre `Usuarios.dc.html` (vistas `usuarios*`, `confirmar_cancelar`,
// `reenviado`, `cancelada`, `ya_aceptada`, `no_pendiente`,
// `reenvio_error_envio` y `reenvio_limite`).

const MARTA = 'marta.nunez@ferreteria.mx';
const CAMILA = 'camila.ortega@ferreteria.mx';
const RODRIGO = 'rodrigo.salas@ferreteria.mx';
const ANA = 'ana.mendoza@ferreteria.mx';
const LUIS = 'luis.reyes@ferreteria.mx';
const JORGE = 'jorge.tapia@ferreteria.mx';
const ID_LUIS = '55555555-5555-4555-8555-555555555551';
const ID_ANA = '88888888-8888-4888-8888-888888888888';
const ULTIMO_ADMIN =
  'No se puede quitar ni degradar al único administrador. Asigna el rol de administrador a otra persona primero.';
const TITULO = 'Personas de tu empresa';

beforeEach(() => {
  usarHandlersUsuarios(personasDelMockup());
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

const seccion = () => screen.getByRole('region', { name: TITULO });
const fila = (correo: string) =>
  within(seccion())
    .getAllByRole('row')
    .find((f) => within(f).queryByText(correo) !== null)!;
const reenviar = (correo: string) =>
  screen.getByRole('button', { name: `Reenviar invitación a ${correo}` });
const cancelar = (correo: string) =>
  screen.getByRole('button', { name: `Cancelar invitación a ${correo}` });
const cambiarRoles = (correo: string) =>
  screen.getByRole('button', { name: `Cambiar roles de ${correo}` });
const quitarAcceso = (correo: string) =>
  screen.getByRole('button', { name: `Quitar acceso de ${correo}` });
const casilla = (rol: string) =>
  within(screen.getByRole('form', { name: 'Cambiar roles' })).getByRole(
    'checkbox',
    { name: new RegExp(`^${rol}`) },
  );

async function listaLista() {
  await within(
    await screen.findByRole('region', {
      name: TITULO,
    }),
  ).findByRole('table');
}

describe('lista de usuarios: la lista', () => {
  it('muestra título, ayuda y las columnas del mockup', async () => {
    montar();
    await listaLista();
    expect(
      within(seccion()).getByRole('heading', { level: 2, name: TITULO }),
    ).toBeInTheDocument();
    expect(
      within(seccion()).getByText(
        'Quién tiene acceso y con qué roles. Las invitaciones aún sin aceptar muestran su estado.',
      ),
    ).toBeInTheDocument();
    const columnas = within(seccion())
      .getAllByRole('columnheader')
      .map((c) => c.textContent);
    expect(columnas).toEqual([
      'Correo',
      'Roles',
      'Estado',
      'Enviada',
      'Invitada por',
      'Acciones',
    ]);
  });

  it('ya no pide ni muestra la tabla de invitaciones pendientes', async () => {
    montar();
    await listaLista();
    expect(
      screen.queryByRole('region', { name: 'Invitaciones pendientes' }),
    ).toBeNull();
    expect(screen.getAllByRole('table')).toHaveLength(1);
  });

  it('respeta el orden del servidor (por correo), activas y pendientes juntas', async () => {
    montar();
    await listaLista();
    const correos = within(seccion())
      .getAllByRole('row')
      .slice(1)
      .map((f) => within(f).getAllByRole('cell')[0]!.textContent);
    expect(correos).toEqual([
      ANA,
      CAMILA,
      'jorge.tapia@ferreteria.mx',
      'luis.paredes@ferreteria.mx',
      'luis.reyes@ferreteria.mx',
      MARTA,
      RODRIGO,
      'sofia.cardenas@ferreteria.mx',
    ]);
  });

  it('una pendiente trae roles, estado con días, fecha de envío e invitador', async () => {
    montar();
    await listaLista();
    const marta = fila(MARTA);
    expect(within(marta).getByText('Contador')).toBeInTheDocument();
    expect(within(marta).getByText('Revisor')).toBeInTheDocument();
    expect(
      within(marta).getByText('Pendiente · vence en 6 días'),
    ).toBeInTheDocument();
    expect(within(marta).getByText('2026-10-14')).toBeInTheDocument();
    expect(within(marta).getByText('Ana Mendoza')).toBeInTheDocument();
    // Las de la plataforma no tienen persona que las invitara.
    expect(within(fila(CAMILA)).getByText('Plataforma')).toBeInTheDocument();
    expect(within(fila(CAMILA)).getByText('Administrador')).toBeInTheDocument();
  });

  it('una activa dice «Activo», lleva «—» en Enviada e Invitada por y solo tiene Cambiar roles y Quitar acceso', async () => {
    montar();
    await listaLista();
    const ana = fila(ANA);
    expect(within(ana).getByText('Activo')).toBeInTheDocument();
    expect(within(ana).getByText('Administrador')).toBeInTheDocument();
    expect(within(ana).getAllByText('—')).toHaveLength(2);
    expect(
      within(ana)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Cambiar roles', 'Quitar acceso']);
    expect(within(ana).queryByText(/Pendiente/)).toBeNull();
    // Cuatro pendientes con Reenviar y Cancelar, cuatro activas con las nuevas.
    expect(within(seccion()).getAllByRole('button')).toHaveLength(16);
  });

  it('una persona con varios roles los muestra todos', async () => {
    usarHandlersUsuarios([personaActiva({ roles: ['revisor', 'contador'] })]);
    montar();
    await listaLista();
    const ana = fila(ANA);
    expect(within(ana).getByText('Contador')).toBeInTheDocument();
    expect(within(ana).getByText('Revisor')).toBeInTheDocument();
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
      personaPendiente({ venceEnDias: -3, vencida: false }),
      personaPendiente({
        id: '55555555-5555-4555-8555-555555555555',
        email: 'otra@ferreteria.mx',
        venceEnDias: 5,
        vencida: true,
      }),
    ]);
    montar();
    await listaLista();
    expect(within(fila(MARTA)).queryByText('Vencida')).toBeNull();
    // El reloj solo escribe los días, y nunca baja de uno.
    expect(
      within(fila(MARTA)).getByText('Pendiente · vence en 1 día'),
    ).toBeInTheDocument();
    expect(
      within(fila('otra@ferreteria.mx')).getByText('Vencida'),
    ).toBeInTheDocument();
  });

  it('cada botón nombra a la persona (aria-label)', async () => {
    montar();
    await listaLista();
    expect(reenviar(MARTA)).toHaveTextContent('Reenviar');
    expect(cancelar(MARTA)).toHaveTextContent('Cancelar');
    expect(cambiarRoles(LUIS)).toHaveTextContent('Cambiar roles');
    expect(quitarAcceso(LUIS)).toHaveTextContent('Quitar acceso');
    expect(cambiarRoles(LUIS)).toHaveAttribute('aria-expanded', 'false');
    expect(quitarAcceso(LUIS)).toHaveAttribute('aria-expanded', 'false');
  });

  it('las pendientes no traen Cambiar roles ni Quitar acceso, ni las activas Reenviar o Cancelar', async () => {
    montar();
    await listaLista();
    expect(
      within(fila(MARTA)).queryByRole('button', { name: /^Cambiar roles/ }),
    ).toBeNull();
    expect(
      within(fila(MARTA)).queryByRole('button', { name: /^Quitar acceso/ }),
    ).toBeNull();
    expect(
      within(fila(LUIS)).queryByRole('button', { name: /^Reenviar/ }),
    ).toBeNull();
    expect(
      within(fila(LUIS)).queryByRole('button', { name: /^Cancelar/ }),
    ).toBeNull();
    expect(
      screen.getAllByRole('button', { name: /^Cambiar roles/ }),
    ).toHaveLength(4);
    expect(
      screen.getAllByRole('button', { name: /^Quitar acceso/ }),
    ).toHaveLength(4);
  });

  it('mientras carga muestra un estado de carga y no la tabla', async () => {
    const compuerta = crearCompuerta();
    servidor.use(
      http.get('/api/usuarios', async () => {
        await compuerta.promesa;
        return HttpResponse.json([personaActiva()]);
      }),
    );
    montar();
    const region = await screen.findByRole('region', { name: TITULO });
    expect(within(region).getByRole('status')).toHaveTextContent(
      'Cargando personas',
    );
    expect(within(region).queryByRole('table')).toBeNull();
    compuerta.abrir();
    expect(await within(region).findByText(ANA)).toBeInTheDocument();
  });

  it('si no carga muestra el error y «Reintentar» vuelve a pedirla (usuarios_error)', async () => {
    listarUsuariosFalla(500);
    montar();
    const alerta = await within(
      await screen.findByRole('region', { name: TITULO }),
    ).findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo cargar la lista de personas.');
    // El formulario de invitar sigue disponible.
    expect(
      screen.getByRole('form', { name: 'Invitar a una persona' }),
    ).toBeInTheDocument();

    usarHandlersUsuarios(personasDelMockup());
    await userEvent
      .setup()
      .click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    await listaLista();
    expect(fila(MARTA)).toBeInTheDocument();
  });

  it('un 403 al listar muestra el mismo error y no la tabla', async () => {
    listarUsuariosFalla(403);
    montar();
    expect(
      await screen.findByText('No se pudo cargar la lista de personas.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('un fallo de red en la lista muestra el mismo error', async () => {
    listarUsuariosRedDeFallo();
    montar();
    expect(
      await screen.findByText('No se pudo cargar la lista de personas.'),
    ).toBeInTheDocument();
  });

  it('una lista que no cumple el contrato no se pinta', async () => {
    servidor.use(
      http.get('/api/usuarios', () => HttpResponse.json([{ id: 1 }])),
    );
    montar();
    expect(
      await screen.findByText('No se pudo cargar la lista de personas.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('sin filas no hay estado vacío del mockup: ni tabla de error ni texto de vacío', async () => {
    usarHandlersUsuarios([]);
    montar();
    await within(
      await screen.findByRole('region', { name: TITULO }),
    ).findByRole('table');
    expect(screen.queryByText(/No hay invitaciones/)).toBeNull();
    expect(within(seccion()).queryByRole('alert')).toBeNull();
  });
});

describe('lista de usuarios: reenviar', () => {
  it('reenvía, avisa en la fila y la lista muestra el vencimiento nuevo', async () => {
    montar();
    await listaLista();
    const antes = listadosUsuariosPedidos.cuenta;
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
      expect(listadosUsuariosPedidos.cuenta).toBeGreaterThan(antes),
    );
    // La fila nueva (otro id) lleva el aviso y la caducidad renovada.
    await waitFor(() =>
      expect(
        within(fila(MARTA)).getByText('Pendiente · vence en 7 días'),
      ).toBeInTheDocument(),
    );
    // Reenviar nunca vuelve activa a nadie: sigue habiendo una sola fila suya.
    expect(within(seccion()).getAllByText(MARTA)).toHaveLength(1);
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
    const antes = listadosUsuariosPedidos.cuenta;
    await userEvent.setup().click(reenviar(MARTA));
    await within(seccion()).findByRole('alert');
    expect(listadosUsuariosPedidos.cuenta).toBe(antes);
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
    usarHandlersUsuarios(personasDelMockup());
    await u.click(reenviar(CAMILA));
    await within(seccion()).findByRole('status');
    expect(within(seccion()).queryByRole('alert')).toBeNull();
  });
});

describe('lista de usuarios: cancelar', () => {
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

  it('cancelar la última pendiente conserva a las activas y el aviso', async () => {
    usarHandlersUsuarios([personaPendiente(), personaActiva()]);
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cancelar(MARTA));
    await u.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    expect(
      await within(seccion()).findByText(`Invitación a ${MARTA} cancelada.`),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(seccion()).queryByText(MARTA, { selector: 'td' }),
      ).toBeNull(),
    );
    expect(fila(ANA)).toBeInTheDocument();
    // Ya no hay pendientes: solo quedan las acciones de la persona activa.
    expect(
      within(seccion())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Cambiar roles', 'Quitar acceso']);
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

describe('lista de usuarios: permisos y refresco', () => {
  it('sin `usuarios.gestionar` la lista no trae Reenviar ni Cancelar ni el formulario', async () => {
    const capacidades = capacidadesDeRoles(['admin']).filter(
      (c: string) => c !== 'usuarios.gestionar',
    );
    montar(() => sesionConCapacidades(capacidades));
    await listaLista();
    // La lista sí se ve, con activas y pendientes; solo faltan las acciones.
    expect(within(fila(ANA)).getByText('Activo')).toBeInTheDocument();
    expect(
      within(fila(MARTA)).getByText('Pendiente · vence en 6 días'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reenviar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Cancelar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Cambiar roles/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Quitar acceso/ })).toBeNull();
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
    expect(screen.queryByRole('region', { name: TITULO })).toBeNull();
    expect(listadosUsuariosPedidos.cuenta).toBe(0);
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
        within(fila('luis@ferreteria.mx')).getByText(
          'Pendiente · vence en 7 días',
        ),
      ).toBeInTheDocument(),
    );
  });
});

describe('lista de usuarios: cambiar roles (2.6)', () => {
  it('abre el editor con los roles actuales, sin llamar a la API (editar_roles)', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cambiarRoles(LUIS));
    const editor = screen.getByRole('form', { name: 'Cambiar roles' });
    expect(
      within(editor).getByRole('group', { name: `Roles de ${LUIS}` }),
    ).toBeInTheDocument();
    expect(casilla('Contador')).toBeChecked();
    expect(casilla('Administrador')).not.toBeChecked();
    expect(casilla('Revisor')).not.toBeChecked();
    expect(casilla('Auditor')).not.toBeChecked();
    expect(cambiarRoles(LUIS)).toHaveAttribute('aria-expanded', 'true');
    expect(quitarAcceso(LUIS)).toHaveAttribute('aria-expanded', 'false');
    // El foco entra al editor, no se queda en la tabla.
    expect(casilla('Administrador')).toHaveFocus();
    expect(accionesRolesRecibidas).toHaveLength(0);
  });

  it('marcar y desmarcar solo cambia el borrador; nada se manda hasta guardar', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cambiarRoles(LUIS));
    await u.click(casilla('Revisor'));
    expect(casilla('Revisor')).toBeChecked();
    await u.click(casilla('Revisor'));
    expect(casilla('Revisor')).not.toBeChecked();
    expect(accionesRolesRecibidas).toHaveLength(0);
    // La fila sigue mostrando sus roles de siempre.
    expect(within(fila(LUIS)).getByText('Contador')).toBeInTheDocument();
  });

  it('sin ningún rol avisa que pierde el acceso y el botón pasa a «Guardar y quitar acceso» (editar_roles_vacio)', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cambiarRoles(LUIS));
    await u.click(casilla('Contador'));
    expect(
      within(screen.getByRole('form', { name: 'Cambiar roles' })).getByRole(
        'status',
      ),
    ).toHaveTextContent(
      'Sin ningún rol, la persona pierde el acceso a tu empresa. Conserva sus roles en otras empresas.',
    );
    expect(
      screen.getByRole('button', { name: 'Guardar y quitar acceso' }),
    ).toBeInTheDocument();
    expect(accionesRolesRecibidas).toHaveLength(0);
    // Volver a marcar uno retira el aviso.
    await u.click(casilla('Auditor'));
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    ).toBeInTheDocument();
  });

  it('guardar manda el conjunto final en el orden del espejo, avisa en la fila y la lista trae los roles nuevos (roles_guardados)', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cambiarRoles(LUIS));
    await u.click(casilla('Revisor'));
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const aviso = await within(seccion()).findByText(
      `Roles de ${LUIS} actualizados: Contador y Revisor. El cambio aplica en su siguiente petición.`,
    );
    expect(aviso).toHaveAttribute('role', 'status');
    expect(accionesRolesRecibidas).toEqual([
      { accion: 'cambiar', id: ID_LUIS, roles: ['contador', 'revisor'] },
    ]);
    expect(screen.queryByRole('form', { name: 'Cambiar roles' })).toBeNull();
    expect(cambiarRoles(LUIS)).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() =>
      expect(within(fila(LUIS)).getByText('Revisor')).toBeInTheDocument(),
    );
    expect(within(fila(LUIS)).getByText('Contador')).toBeInTheDocument();
    // El aviso recibe el foco para quien navega con teclado.
    expect(aviso).toHaveFocus();
  });

  it('con tres roles el aviso los une con comas y «y»', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cambiarRoles(LUIS));
    await u.click(casilla('Administrador'));
    await u.click(casilla('Revisor'));
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(
      await within(seccion()).findByText(
        `Roles de ${LUIS} actualizados: Administrador, Contador y Revisor. El cambio aplica en su siguiente petición.`,
      ),
    ).toBeInTheDocument();
  });

  it('Cancelar cierra el editor sin guardar y devuelve el foco al botón', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cambiarRoles(LUIS));
    await u.click(casilla('Auditor'));
    await u.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('form', { name: 'Cambiar roles' })).toBeNull();
    expect(cambiarRoles(LUIS)).toHaveFocus();
    expect(cambiarRoles(LUIS)).toHaveAttribute('aria-expanded', 'false');
    expect(accionesRolesRecibidas).toHaveLength(0);
    // Al reabrir no queda el borrador anterior.
    await u.click(cambiarRoles(LUIS));
    expect(casilla('Auditor')).not.toBeChecked();
  });

  it('solo una fila abierta a la vez: editor, quitar y cancelar invitación se cierran entre sí', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cambiarRoles(LUIS));
    await u.click(cambiarRoles(JORGE));
    expect(screen.getAllByRole('form', { name: 'Cambiar roles' })).toHaveLength(
      1,
    );
    expect(cambiarRoles(LUIS)).toHaveAttribute('aria-expanded', 'false');
    expect(cambiarRoles(JORGE)).toHaveAttribute('aria-expanded', 'true');
    await u.click(quitarAcceso(LUIS));
    expect(screen.queryByRole('form', { name: 'Cambiar roles' })).toBeNull();
    expect(
      screen.getAllByRole('group', { name: 'Confirmar quitar acceso' }),
    ).toHaveLength(1);
    await u.click(cancelar(MARTA));
    expect(
      screen.queryByRole('group', { name: 'Confirmar quitar acceso' }),
    ).toBeNull();
    expect(
      screen.getAllByRole('group', { name: 'Confirmar cancelación' }),
    ).toHaveLength(1);
    await u.click(cambiarRoles(LUIS));
    expect(
      screen.queryByRole('group', { name: 'Confirmar cancelación' }),
    ).toBeNull();
  });

  it('guardar sin roles quita el acceso: llama a quitar, no a cambiar (acceso_quitado)', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cambiarRoles(LUIS));
    await u.click(casilla('Contador'));
    await u.click(
      screen.getByRole('button', { name: 'Guardar y quitar acceso' }),
    );
    expect(await within(seccion()).findByRole('status')).toHaveTextContent(
      `Acceso de ${LUIS} a tu empresa quitado. Ya no puede entrar a ella.`,
    );
    expect(accionesRolesRecibidas).toEqual([{ accion: 'quitar', id: ID_LUIS }]);
    await waitFor(() =>
      expect(
        within(seccion()).queryByText(LUIS, { selector: 'td' }),
      ).toBeNull(),
    );
  });

  it('un 409 muestra el texto del último administrador en la fila y el editor sigue abierto (ultimo_admin)', async () => {
    accionRolesFalla('cambiar', 409);
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cambiarRoles(ANA));
    await u.click(casilla('Administrador'));
    await u.click(casilla('Contador'));
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const alerta = await within(seccion()).findByRole('alert');
    expect(alerta).toHaveTextContent(ULTIMO_ADMIN);
    expect(alerta).not.toHaveTextContent('texto del servidor');
    expect(alerta).toHaveFocus();
    expect(screen.getByRole('form', { name: 'Cambiar roles' })).toBeVisible();
    expect(cambiarRoles(ANA)).toHaveAttribute('aria-expanded', 'true');
    expect(accionesRolesRecibidas).toEqual([{ accion: 'cambiar', id: ID_ANA }]);
  });

  it('un fallo genérico al guardar dice «No se pudo guardar el cambio» y conserva el borrador (roles_error)', async () => {
    accionRolesFalla('cambiar', 500);
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cambiarRoles(LUIS));
    await u.click(casilla('Revisor'));
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(seccion()).findByRole('alert')).toHaveTextContent(
      'No se pudo guardar el cambio. Inténtalo de nuevo.',
    );
    expect(casilla('Revisor')).toBeChecked();
    expect(casilla('Contador')).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    ).toBeEnabled();
  });

  it('un 403 y la falta de conexión usan los textos compartidos', async () => {
    accionRolesFalla('cambiar', 403);
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cambiarRoles(LUIS));
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(seccion()).findByRole('alert')).toHaveTextContent(
      'No tienes permiso para esta acción.',
    );
    accionRolesRedDeFallo('cambiar');
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(within(seccion()).getByRole('alert')).toHaveTextContent(
        'No se pudo conectar con el servidor.',
      ),
    );
  });

  it('mientras guarda, los controles del editor esperan y no se duplica el envío', async () => {
    const compuerta = crearCompuerta();
    servidor.use(
      http.patch('/api/usuarios/:id/roles', async ({ params }) => {
        accionesRolesRecibidas.push({
          accion: 'cambiar',
          id: String(params['id']),
        });
        await compuerta.promesa;
        return HttpResponse.json({
          id: String(params['id']),
          email: LUIS,
          roles: ['contador'],
        });
      }),
    );
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(cambiarRoles(LUIS));
    await u.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Guardar cambios' }),
      ).toBeDisabled(),
    );
    expect(casilla('Auditor')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(cambiarRoles(JORGE)).toBeDisabled();
    expect(quitarAcceso(JORGE)).toBeDisabled();
    expect(reenviar(MARTA)).toBeDisabled();
    compuerta.abrir();
    await within(seccion()).findByRole('status');
    expect(accionesRolesRecibidas).toHaveLength(1);
  });
});

describe('lista de usuarios: quitar acceso (2.6)', () => {
  it('Quitar acceso abre la confirmación con el foco en «Volver», sin llamar a la API (confirmar_quitar)', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(quitarAcceso(LUIS));
    const grupo = screen.getByRole('group', {
      name: 'Confirmar quitar acceso',
    });
    expect(grupo).toHaveTextContent(
      `¿Quitar el acceso de ${LUIS} a tu empresa? Lo pierde de inmediato y sus sesiones en ella dejan de servir. Conserva sus roles en otras empresas.`,
    );
    expect(
      within(grupo).getByRole('button', { name: 'Sí, quitar acceso' }),
    ).toBeInTheDocument();
    expect(within(grupo).getByRole('button', { name: 'Volver' })).toHaveFocus();
    expect(quitarAcceso(LUIS)).toHaveAttribute('aria-expanded', 'true');
    expect(cambiarRoles(LUIS)).toHaveAttribute('aria-expanded', 'false');
    expect(accionesRolesRecibidas).toHaveLength(0);
  });

  it('Volver cierra la confirmación, devuelve el foco y no quita nada', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(quitarAcceso(LUIS));
    await u.click(screen.getByRole('button', { name: 'Volver' }));
    expect(
      screen.queryByRole('group', { name: 'Confirmar quitar acceso' }),
    ).toBeNull();
    expect(quitarAcceso(LUIS)).toHaveFocus();
    expect(quitarAcceso(LUIS)).toHaveAttribute('aria-expanded', 'false');
    expect(accionesRolesRecibidas).toHaveLength(0);
  });

  it('«Sí, quitar acceso» quita, la fila sale y un aviso arriba lo confirma (acceso_quitado)', async () => {
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(quitarAcceso(LUIS));
    await u.click(screen.getByRole('button', { name: 'Sí, quitar acceso' }));
    const aviso = await within(seccion()).findByRole('status');
    expect(aviso).toHaveTextContent(
      `Acceso de ${LUIS} a tu empresa quitado. Ya no puede entrar a ella.`,
    );
    expect(aviso).toHaveFocus();
    expect(accionesRolesRecibidas).toEqual([{ accion: 'quitar', id: ID_LUIS }]);
    await waitFor(() =>
      expect(
        within(seccion()).queryByText(LUIS, { selector: 'td' }),
      ).toBeNull(),
    );
    expect(fila(ANA)).toBeInTheDocument();
  });

  it('un 409 muestra el texto del último administrador y la confirmación sigue abierta (ultimo_admin_quitar)', async () => {
    accionRolesFalla('quitar', 409);
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(quitarAcceso(ANA));
    await u.click(screen.getByRole('button', { name: 'Sí, quitar acceso' }));
    const alerta = await within(seccion()).findByRole('alert');
    expect(alerta).toHaveTextContent(ULTIMO_ADMIN);
    expect(alerta).not.toHaveTextContent('texto del servidor');
    expect(alerta).toHaveFocus();
    expect(
      screen.getByRole('group', { name: 'Confirmar quitar acceso' }),
    ).toBeVisible();
    expect(fila(ANA)).toBeInTheDocument();
  });

  it('un fallo genérico dice «No se pudo quitar el acceso» y la persona sigue en la lista (acceso_error)', async () => {
    accionRolesFalla('quitar', 500);
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(quitarAcceso(LUIS));
    await u.click(screen.getByRole('button', { name: 'Sí, quitar acceso' }));
    expect(await within(seccion()).findByRole('alert')).toHaveTextContent(
      'No se pudo quitar el acceso. Inténtalo de nuevo.',
    );
    expect(fila(LUIS)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sí, quitar acceso' }),
    ).toBeEnabled();
  });

  it('sin conexión al quitar muestra el aviso de conexión', async () => {
    accionRolesRedDeFallo('quitar');
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(quitarAcceso(LUIS));
    await u.click(screen.getByRole('button', { name: 'Sí, quitar acceso' }));
    expect(await within(seccion()).findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor.',
    );
  });

  it('una acción nueva retira el aviso anterior de otra fila', async () => {
    accionRolesFalla('quitar', 500);
    montar();
    await listaLista();
    const u = userEvent.setup();
    await u.click(quitarAcceso(LUIS));
    await u.click(screen.getByRole('button', { name: 'Sí, quitar acceso' }));
    await within(seccion()).findByRole('alert');
    await u.click(cambiarRoles(JORGE));
    expect(within(seccion()).queryByRole('alert')).toBeNull();
  });
});
