import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { contextoSesion } from '@/shared/api/contratos';
import { SessionStateProvider } from '@/shared/sesion';
import {
  CONTEXTO_SESION,
  SESION_LISTA,
  capacidadesDeRoles,
} from '@/test/fixtures';
import {
  casoConciliado,
  casoDeFila,
  casoSinMatch,
  casoSugerencia,
  propuestaCaso,
} from '@/test/fixturesCaso';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { almacenes } from '@/test/handlers';
import { reabrirFalla, reabrirRedDeFallo } from '@/test/handlersCaso';
import { clienteDePruebas } from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import { CasoPage } from './CasoPage';

function sesionConRoles(roles: string[]): typeof SESION_LISTA {
  return {
    ...SESION_LISTA,
    contexto: contextoSesion.parse({
      ...CONTEXTO_SESION,
      roles,
      capacidades: capacidadesDeRoles(roles),
    }),
  } as typeof SESION_LISTA;
}

function montar(movimientoId: string, estado = sesionConRoles(['revisor'])) {
  const router = createMemoryRouter(
    [{ path: '/casos/:movimientoId', element: <CasoPage /> }],
    { initialEntries: [`/casos/${encodeURIComponent(movimientoId)}`] },
  );
  render(
    <QueryClientProvider client={clienteDePruebas()}>
      <SessionStateProvider estado={estado}>
        <RouterProvider router={router} />
      </SessionStateProvider>
    </QueryClientProvider>,
  );
}

function servir(caso: ReturnType<typeof casoSugerencia>) {
  servidor.use(http.get('/api/casos/:id', () => HttpResponse.json(caso)));
  return caso;
}

/** Un conciliado de la demo, que el servidor de pruebas puede reabrir. */
function conciliadoReabrible(): string {
  const fila = almacenes.bandeja
    .filas()
    .find((f) => f.estado === 'conciliado' && !f.requiereRevision);
  if (fila === undefined) throw new Error('la demo no trae un conciliado');
  almacenes.caso.establecer([{ ...casoDeFila(fila), puedeReabrir: true }]);
  return fila.movimientoId;
}

async function abrirFormulario(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(
    await screen.findByRole('button', { name: 'Reabrir confirmación' }),
  );
  return screen.getByRole('textbox', {
    name: 'Motivo de la reapertura (obligatorio)',
  });
}

async function reabrirCon(
  usuario: ReturnType<typeof userEvent.setup>,
  motivo: string,
) {
  const campo = await abrirFormulario(usuario);
  await usuario.type(campo, motivo);
  const tarjeta = campo.closest('section') as HTMLElement;
  await usuario.click(
    within(tarjeta).getByRole('button', { name: 'Reabrir confirmación' }),
  );
  return { campo, tarjeta };
}

describe('CasoPage: reabrir una confirmación (5.7)', () => {
  it('en un conciliado con puedeReabrir ofrece «Reabrir confirmación» con su ayuda', async () => {
    montar(servir(casoConciliado({ puedeReabrir: true })).movimiento.id);
    expect(
      await screen.findByRole('button', { name: 'Reabrir confirmación' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'El caso vuelve a la bandeja como pendiente y queda en el historial.',
      ),
    ).toBeInTheDocument();
    // Lo que ya había sigue: la tarjeta «Conciliado» y sin formulario abierto.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Conciliado' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Este caso ya está cerrado y no admite cambios.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('en «Requiere revisión» con puedeReabrir también la ofrece y conserva la tarjeta', async () => {
    const base = casoConciliado();
    const propuesta = base.propuestas[0]!;
    montar(
      servir(
        casoConciliado({
          requiereRevision: true,
          puedeReabrir: true,
          propuestas: [
            {
              ...propuesta,
              requiereRevision: true,
              cfdi: { ...propuesta.cfdi, estado: 'cancelada' },
            },
          ],
        }),
      ).movimiento.id,
    );
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Requiere revisión',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reabrir confirmación' }),
    ).toBeInTheDocument();
  });

  it('sin puedeReabrir y con el permiso explica que solo quien confirmó o un administrador', async () => {
    montar(servir(casoConciliado()).movimiento.id);
    expect(
      await screen.findByText(
        'Solo quien confirmó la conciliación o un administrador puede reabrirla.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reabrir confirmación' }),
    ).toBeNull();
  });

  it('el auditor ve la nota de solo lectura y no puede reabrir', async () => {
    montar(servir(casoConciliado()).movimiento.id, sesionConRoles(['auditor']));
    expect(
      await screen.findByText(
        'Solo lectura: tu rol no puede reabrir confirmaciones.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reabrir confirmación' }),
    ).toBeNull();
  });

  it('una sugerencia y un sin match no ofrecen reabrir ni su nota', async () => {
    montar(servir(casoSugerencia()).movimiento.id);
    await screen.findByRole('button', { name: /Confirmar conciliación/ });
    expect(screen.queryByText(/reabrir/i)).toBeNull();
  });

  it('un sin match sigue sin ofrecer reabrir', async () => {
    montar(servir(casoSinMatch()).movimiento.id);
    await screen.findByRole('heading', { level: 3, name: 'Sin match' });
    expect(screen.queryByText(/reabrir/i)).toBeNull();
  });

  it('abre la tarjeta con el campo, el contador, la nota y «Cancelar»', async () => {
    const usuario = userEvent.setup();
    montar(servir(casoConciliado({ puedeReabrir: true })).movimiento.id);
    const campo = await abrirFormulario(usuario);
    expect(campo).toHaveAttribute(
      'placeholder',
      'Ej. confirmé el CFDI equivocado',
    );
    expect(campo).toHaveFocus();
    expect(screen.getByText('0 / 500')).toBeInTheDocument();
    expect(
      screen.getByText('Queda en la bitácora con tu nombre y el motivo.'),
    ).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Reabrir confirmación' }),
    ).toBeInTheDocument();
  });

  it('sin motivo no envía nada y marca el campo con el error', async () => {
    const espia = espiarSolicitudes();
    const usuario = userEvent.setup();
    montar(servir(casoConciliado({ puedeReabrir: true })).movimiento.id);
    const campo = await abrirFormulario(usuario);
    await usuario.type(campo, '   ');
    const tarjeta = campo.closest('section') as HTMLElement;
    await usuario.click(
      within(tarjeta).getByRole('button', { name: 'Reabrir confirmación' }),
    );
    expect(
      await screen.findByText('El motivo es obligatorio para reabrir.'),
    ).toBeInTheDocument();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveFocus();
    expect(espia.solicitudes.filter((s) => s.metodo === 'POST')).toHaveLength(
      0,
    );
  });

  it('más de 500 caracteres no se envía y dice el límite', async () => {
    const espia = espiarSolicitudes();
    const usuario = userEvent.setup();
    montar(servir(casoConciliado({ puedeReabrir: true })).movimiento.id);
    const campo = await abrirFormulario(usuario);
    await usuario.click(campo);
    await usuario.paste('x'.repeat(501));
    const tarjeta = campo.closest('section') as HTMLElement;
    await usuario.click(
      within(tarjeta).getByRole('button', { name: 'Reabrir confirmación' }),
    );
    expect(
      screen.getByText('El motivo no puede pasar de 500 caracteres.'),
    ).toBeInTheDocument();
    expect(espia.solicitudes.filter((s) => s.metodo === 'POST')).toHaveLength(
      0,
    );
  });

  it('con motivo reabre: el caso vuelve como propuesta desde el servidor y la fila a la bandeja', async () => {
    const id = conciliadoReabrible();
    const usuario = userEvent.setup();
    montar(id);
    await reabrirCon(usuario, '  Confirmé el CFDI equivocado ');
    expect(
      await screen.findByRole('button', { name: /Confirmar conciliación/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {
        name: 'Motivo de la reapertura (obligatorio)',
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Conciliado' }),
    ).toBeNull();
    expect(
      almacenes.bandeja.filas().find((f) => f.movimientoId === id)?.estado,
    ).toBe('sugerencia');
  });

  it('el historial de la propuesta nueva muestra la confirmación y la reapertura con quién y el motivo', async () => {
    const id = conciliadoReabrible();
    const usuario = userEvent.setup();
    montar(id);
    await reabrirCon(usuario, 'Confirmé el CFDI equivocado');
    const historial = (
      await screen.findByRole('heading', { name: 'Historial' })
    ).closest('aside') as HTMLElement;
    const reabierta = await within(historial).findByText('Reabierta');
    expect(within(historial).getByText('Confirmada')).toBeInTheDocument();
    const evento = reabierta.closest('li') as HTMLElement;
    expect(evento).toHaveTextContent(
      'Jorge Tapia · Confirmé el CFDI equivocado',
    );
    // Orden cronológico: Confirmada, Reabierta y después la propuesta nueva.
    const titulos = within(historial)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('strong')?.textContent);
    expect(titulos.indexOf('Confirmada')).toBeLessThan(
      titulos.indexOf('Reabierta'),
    );
    expect(titulos.indexOf('Reabierta')).toBeLessThan(
      titulos.findLastIndex((t) => t?.startsWith('El motor propuso') ?? false),
    );
  });

  it('un 409 muestra «Este caso ya cambió» con recarga y bloquea el formulario', async () => {
    const usuario = userEvent.setup();
    montar(servir(casoConciliado({ puedeReabrir: true })).movimiento.id);
    servidor.use(reabrirFalla(409));
    const { tarjeta } = await reabrirCon(usuario, 'Motivo');
    expect(await screen.findByText('Este caso ya cambió.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Recargar caso' }),
    ).toBeInTheDocument();
    expect(
      within(tarjeta).getByRole('button', { name: 'Reabrir confirmación' }),
    ).toBeDisabled();
  });

  it('un 403 muestra la alerta de sin permiso y deja reintentar', async () => {
    const usuario = userEvent.setup();
    montar(servir(casoConciliado({ puedeReabrir: true })).movimiento.id);
    servidor.use(reabrirFalla(403));
    const { campo, tarjeta } = await reabrirCon(usuario, 'Motivo');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      within(tarjeta).getByRole('button', { name: 'Reabrir confirmación' }),
    ).toBeEnabled();
    await usuario.type(campo, '!');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un fallo de red muestra la alerta de conexión y deja reintentar', async () => {
    const usuario = userEvent.setup();
    montar(servir(casoConciliado({ puedeReabrir: true })).movimiento.id);
    servidor.use(reabrirRedDeFallo());
    const { tarjeta } = await reabrirCon(usuario, 'Motivo');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(tarjeta).getByRole('button', { name: 'Reabrir confirmación' }),
      ).toBeEnabled(),
    );
  });

  it('una respuesta vieja sin puedeReabrir sigue funcionando y no ofrece reabrir', async () => {
    // Una respuesta vieja, sin el campo, no ofrece reabrir ni rompe la pantalla.
    const vieja: Record<string, unknown> = casoConciliado({
      propuestas: [propuestaCaso(1, { estado: 'confirmada' })],
    });
    delete vieja.puedeReabrir;
    montar(servir(vieja as ReturnType<typeof casoConciliado>).movimiento.id);
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Conciliado' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reabrir confirmación' }),
    ).toBeNull();
  });
});
