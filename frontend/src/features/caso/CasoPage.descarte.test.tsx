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
  casoDescartado,
  casoSinMatch,
  casoSugerencia,
} from '@/test/fixturesCaso';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { almacenes } from '@/test/handlers';
import { descarteFalla } from '@/test/handlersCaso';
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

function servir(caso: ReturnType<typeof casoSinMatch>) {
  servidor.use(http.get('/api/casos/:id', () => HttpResponse.json(caso)));
  return caso;
}

/** Id de una fila `sin_match` de la bandeja de demostración. */
function movimientoSinMatch(): string {
  const fila = almacenes.bandeja.filas().find((f) => f.estado === 'sin_match');
  if (fila === undefined) throw new Error('la demo no trae un sin_match');
  return fila.movimientoId;
}

async function abrirFormulario(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(
    await screen.findByRole('button', { name: 'Descartar movimiento' }),
  );
  return screen.getByRole('textbox', {
    name: 'Motivo del descarte (obligatorio)',
  });
}

describe('CasoPage: descartar un movimiento (5.6)', () => {
  it('en un sin_match, con el permiso, ofrece «Descartar movimiento» con su ayuda', async () => {
    montar(servir(casoSinMatch()).movimiento.id);
    expect(
      await screen.findByRole('button', { name: 'Descartar movimiento' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Para comisiones, intereses y otros movimientos que no son de ningún cliente.',
      ),
    ).toBeInTheDocument();
    // Lo que ya había sigue: la tarjeta «Sin match» y sin formulario abierto.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Sin match' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('sin el permiso (auditor) no ofrece descartar', async () => {
    montar(servir(casoSinMatch()).movimiento.id, sesionConRoles(['auditor']));
    await screen.findByRole('heading', { level: 3, name: 'Sin match' });
    expect(
      screen.queryByRole('button', { name: 'Descartar movimiento' }),
    ).toBeNull();
  });

  it('una sugerencia no ofrece descartar', async () => {
    montar(servir(casoSugerencia()).movimiento.id);
    await screen.findByRole('button', { name: /Confirmar conciliación/ });
    expect(
      screen.queryByRole('button', { name: 'Descartar movimiento' }),
    ).toBeNull();
  });

  it('abre la tarjeta con el campo, el contador, la nota y «Cancelar»', async () => {
    const usuario = userEvent.setup();
    montar(servir(casoSinMatch()).movimiento.id);
    const campo = await abrirFormulario(usuario);
    expect(campo).toHaveAttribute('placeholder', 'Ej. comisión bancaria');
    expect(campo).toHaveFocus();
    expect(screen.getByText('0 / 500')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Queda en la bitácora con tu nombre y el motivo. Puedes deshacerlo después.',
      ),
    ).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Descartar movimiento' }),
    ).toBeInTheDocument();
  });

  it('sin motivo no envía nada y marca el campo con el error', async () => {
    const espia = espiarSolicitudes();
    const usuario = userEvent.setup();
    montar(servir(casoSinMatch()).movimiento.id);
    const campo = await abrirFormulario(usuario);
    await usuario.type(campo, '   ');
    const tarjeta = campo.closest('section') as HTMLElement;
    await usuario.click(
      within(tarjeta).getByRole('button', { name: 'Descartar movimiento' }),
    );
    expect(
      await screen.findByText('El motivo es obligatorio para descartar.'),
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
    montar(servir(casoSinMatch()).movimiento.id);
    const campo = await abrirFormulario(usuario);
    await usuario.click(campo);
    await usuario.paste('x'.repeat(501));
    const tarjeta = campo.closest('section') as HTMLElement;
    await usuario.click(
      within(tarjeta).getByRole('button', { name: 'Descartar movimiento' }),
    );
    expect(
      screen.getByText('El motivo no puede pasar de 500 caracteres.'),
    ).toBeInTheDocument();
    expect(espia.solicitudes.filter((s) => s.metodo === 'POST')).toHaveLength(
      0,
    );
  });

  it('con motivo descarta: pasa a «Descartado» y el movimiento sale de la bandeja', async () => {
    const id = movimientoSinMatch();
    const usuario = userEvent.setup();
    montar(id);
    const campo = await abrirFormulario(usuario);
    await usuario.type(campo, 'Comisión bancaria');
    const tarjeta = campo.closest('section') as HTMLElement;
    await usuario.click(
      within(tarjeta).getByRole('button', { name: 'Descartar movimiento' }),
    );
    const descartado = await screen.findByRole('heading', {
      level: 3,
      name: 'Descartado',
    });
    expect(descartado).toBeInTheDocument();
    expect(
      screen.getByText('Este movimiento se descartó: no es de ningún cliente.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Comisión bancaria')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText('Sin match')).toBeNull();
    expect(almacenes.bandeja.filas().some((f) => f.movimientoId === id)).toBe(
      false,
    );
    // El foco pasa a la tarjeta, que reemplazó al formulario.
    await waitFor(() => expect(descartado.closest('section')).toHaveFocus());
  });

  it('un 409 muestra «Este caso ya cambió» con recarga y bloquea el formulario', async () => {
    const usuario = userEvent.setup();
    montar(servir(casoSinMatch()).movimiento.id);
    servidor.use(...descarteFalla(409));
    const campo = await abrirFormulario(usuario);
    await usuario.type(campo, 'Comisión');
    const tarjeta = campo.closest('section') as HTMLElement;
    await usuario.click(
      within(tarjeta).getByRole('button', { name: 'Descartar movimiento' }),
    );
    expect(await screen.findByText('Este caso ya cambió.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Recargar caso' }),
    ).toBeInTheDocument();
    expect(
      within(tarjeta).getByRole('button', { name: 'Descartar movimiento' }),
    ).toBeDisabled();
  });

  it('un 403 muestra la alerta de sin permiso y deja reintentar', async () => {
    const usuario = userEvent.setup();
    montar(servir(casoSinMatch()).movimiento.id);
    servidor.use(...descarteFalla(403));
    const campo = await abrirFormulario(usuario);
    await usuario.type(campo, 'Comisión');
    const tarjeta = campo.closest('section') as HTMLElement;
    await usuario.click(
      within(tarjeta).getByRole('button', { name: 'Descartar movimiento' }),
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      within(tarjeta).getByRole('button', { name: 'Descartar movimiento' }),
    ).toBeEnabled();
    // Escribir de nuevo limpia la alerta.
    await usuario.type(campo, '!');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('CasoPage: un movimiento descartado (5.6)', () => {
  it('muestra el chip, la tarjeta, la fila del historial y ninguna propuesta', async () => {
    montar(servir(casoDescartado()).movimiento.id);
    expect(
      await screen.findByText(/Descartado$/, { selector: 'span' }),
    ).toBeInTheDocument();
    const tarjeta = screen
      .getByRole('heading', { level: 3, name: 'Descartado' })
      .closest('section') as HTMLElement;
    expect(within(tarjeta).getByText('Comisión bancaria')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Luis Reyes')).toBeInTheDocument();
    expect(within(tarjeta).getByText('2026-10-05')).toBeInTheDocument();
    expect(
      within(tarjeta).getByText(
        'Mientras siga descartado no se muestran sus propuestas y no aparece en la bandeja.',
      ),
    ).toBeInTheDocument();
    const evento = await screen.findByTestId('evento-descarte');
    expect(evento).toHaveTextContent('Luis Reyes · Comisión bancaria');
    expect(screen.queryByText('Sin match')).toBeNull();
    expect(screen.queryByText('Propuestas')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Descartar movimiento' }),
    ).toBeNull();
  });

  it('con puedeDeshacer ofrece «Deshacer descarte» y su ayuda', async () => {
    montar(servir(casoDescartado()).movimiento.id);
    expect(
      await screen.findByRole('button', { name: 'Deshacer descarte' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('El movimiento vuelve a la bandeja como pendiente.'),
    ).toBeInTheDocument();
  });

  it('sin puedeDeshacer y con el permiso, explica que solo quien lo descartó o un administrador', async () => {
    const base = casoDescartado();
    const caso = casoDescartado({
      descarte: { ...base.descarte!, puedeDeshacer: false },
    });
    montar(servir(caso).movimiento.id);
    expect(
      await screen.findByText(
        'Solo quien descartó el movimiento o un administrador puede deshacer el descarte.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Deshacer descarte' }),
    ).toBeNull();
  });

  it('el auditor ve la nota de solo lectura y no puede deshacer', async () => {
    const base = casoDescartado();
    const caso = casoDescartado({
      descarte: { ...base.descarte!, puedeDeshacer: false },
    });
    montar(servir(caso).movimiento.id, sesionConRoles(['auditor']));
    expect(
      await screen.findByText(
        'Solo lectura: tu rol no puede deshacer descartes.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Deshacer descarte' }),
    ).toBeNull();
  });

  it('deshacer devuelve el caso a sin match y el movimiento a la bandeja', async () => {
    const id = movimientoSinMatch();
    const usuario = userEvent.setup();
    montar(id);
    const campo = await abrirFormulario(usuario);
    await usuario.type(campo, 'Comisión bancaria');
    await usuario.click(
      within(campo.closest('section') as HTMLElement).getByRole('button', {
        name: 'Descartar movimiento',
      }),
    );
    await usuario.click(
      await screen.findByRole('button', { name: 'Deshacer descarte' }),
    );
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Sin match' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Descartado' })).toBeNull();
    expect(almacenes.bandeja.filas().some((f) => f.movimientoId === id)).toBe(
      true,
    );
  });

  it('un 409 al deshacer muestra «Este caso ya cambió» y bloquea el botón', async () => {
    const usuario = userEvent.setup();
    montar(servir(casoDescartado()).movimiento.id);
    servidor.use(...descarteFalla(409));
    await usuario.click(
      await screen.findByRole('button', { name: 'Deshacer descarte' }),
    );
    expect(await screen.findByText('Este caso ya cambió.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Deshacer descarte' }),
    ).toBeDisabled();
  });

  it('un 403 al deshacer muestra la alerta de sin permiso', async () => {
    const usuario = userEvent.setup();
    montar(servir(casoDescartado()).movimiento.id);
    servidor.use(...descarteFalla(403));
    await usuario.click(
      await screen.findByRole('button', { name: 'Deshacer descarte' }),
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Deshacer descarte' }),
    ).toBeEnabled();
  });
});
