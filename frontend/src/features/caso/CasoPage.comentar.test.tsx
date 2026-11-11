import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
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
  casoVarias,
  propuestaCaso,
} from '@/test/fixturesCaso';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { almacenes } from '@/test/handlers';
import { comentarFalla, comentarRedDeFallo } from '@/test/handlersCaso';
import { idDe } from '@/test/fixturesBandeja';
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

/** Un caso de la demo con propuesta, que el servidor de pruebas puede comentar. */
function sugerenciaComentable(): { id: string; decisionId: string } {
  const fila = almacenes.bandeja
    .filas()
    .find((f) => f.estado === 'sugerencia' && f.propuestasCount === 1);
  if (fila === undefined) throw new Error('la demo no trae una sugerencia');
  const caso = { ...casoDeFila(fila), puedeComentar: true };
  almacenes.caso.establecer([caso]);
  return {
    id: fila.movimientoId,
    decisionId: caso.propuestas[0]!.conciliacionId,
  };
}

const COMENTARIOS = [
  {
    id: idDe(9001),
    decisionId: idDe(5001),
    texto: 'No me convence: el CFDI A-1044 parece de otra obra.',
    por: 'Jorge Tapia',
    fecha: '2026-10-05T16:40:00.000Z',
  },
  {
    id: idDe(9002),
    decisionId: idDe(5001),
    texto: 'Lo reviso con el cliente\nantes de decidir.',
    por: 'Luis Reyes',
    fecha: '2026-10-06T09:05:00.000Z',
  },
];

function tarjeta() {
  return screen
    .getByRole('heading', { name: 'Comentarios' })
    .closest('section') as HTMLElement;
}

describe('CasoPage: comentarios (5.9)', () => {
  it('con puedeComentar muestra la tarjeta vacía con el formulario y su ayuda', async () => {
    montar(servir(casoSugerencia({ puedeComentar: true })).movimiento.id);
    await screen.findByRole('heading', { name: 'Comentarios' });
    expect(
      screen.getByText('Aún no hay comentarios en este caso.'),
    ).toBeInTheDocument();
    const campo = screen.getByRole('textbox', { name: 'Dejar un comentario' });
    expect(campo).toHaveAttribute(
      'placeholder',
      'Ej. este CFDI parece de otra obra',
    );
    expect(screen.getByText('0 / 1000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comentar' })).toBeEnabled();
    expect(
      screen.getByText(
        'No cambia el caso ni lo reabre. Si estás de acuerdo con un comentario, reabre la confirmación.',
      ),
    ).toBeInTheDocument();
  });

  it('lista los comentarios con autor, fecha y texto, del más antiguo al más reciente', async () => {
    montar(
      servir(casoSugerencia({ puedeComentar: true, comentarios: COMENTARIOS }))
        .movimiento.id,
    );
    await screen.findByRole('heading', { name: 'Comentarios' });
    const items = within(tarjeta()).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText('Jorge Tapia')).toBeInTheDocument();
    expect(
      within(items[0]!).getByText(
        'No me convence: el CFDI A-1044 parece de otra obra.',
      ),
    ).toBeInTheDocument();
    expect(
      within(items[0]!).getByText(/^2026-10-05 \d{2}:\d{2}$/),
    ).toBeTruthy();
    expect(within(items[1]!).getByText('Luis Reyes')).toBeInTheDocument();
    expect(
      screen.queryByText('Aún no hay comentarios en este caso.'),
    ).toBeNull();
  });

  it('sin puedeComentar no hay campo, pero los comentarios se leen y se explica por qué', async () => {
    montar(
      servir(casoSugerencia({ puedeComentar: false, comentarios: COMENTARIOS }))
        .movimiento.id,
      sesionConRoles(['auditor']),
    );
    await screen.findByRole('heading', { name: 'Comentarios' });
    expect(
      screen.getByText('Solo lectura: tu rol no puede dejar comentarios.'),
    ).toBeInTheDocument();
    expect(
      within(tarjeta()).queryByRole('textbox', { name: 'Dejar un comentario' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Comentar' })).toBeNull();
    expect(screen.getByText('Luis Reyes')).toBeInTheDocument();
  });

  it('un caso conciliado también tiene su tarjeta de comentarios', async () => {
    montar(servir(casoConciliado({ puedeComentar: true })).movimiento.id);
    expect(
      await screen.findByRole('heading', { name: 'Comentarios' }),
    ).toBeInTheDocument();
  });

  it('un sin match, sin propuestas, no tiene tarjeta de comentarios', async () => {
    montar(servir(casoSinMatch()).movimiento.id);
    await screen.findByRole('heading', { level: 3, name: 'Sin match' });
    expect(screen.queryByRole('heading', { name: 'Comentarios' })).toBeNull();
    expect(screen.queryByText(/dejar comentarios/)).toBeNull();
  });

  it.each([
    ['vacío', ''],
    ['solo espacios', '   \n  '],
  ])(
    'un comentario %s no envía nada y marca el campo con el error',
    async (_nombre, texto) => {
      const espia = espiarSolicitudes();
      const usuario = userEvent.setup();
      montar(servir(casoSugerencia({ puedeComentar: true })).movimiento.id);
      const campo = await screen.findByRole('textbox', {
        name: 'Dejar un comentario',
      });
      if (texto !== '') await usuario.type(campo, texto);
      await usuario.click(screen.getByRole('button', { name: 'Comentar' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'El comentario no puede estar vacío.',
      );
      expect(campo).toHaveAttribute('aria-invalid', 'true');
      expect(espia.solicitudes.filter((s) => s.metodo === 'POST')).toHaveLength(
        0,
      );
      espia.detener();
    },
  );

  it('pasados 1000 caracteres el contador marca el error y no se envía', async () => {
    const espia = espiarSolicitudes();
    const usuario = userEvent.setup();
    montar(servir(casoSugerencia({ puedeComentar: true })).movimiento.id);
    const campo = await screen.findByRole('textbox', {
      name: 'Dejar un comentario',
    });
    await usuario.click(campo);
    await usuario.paste('a'.repeat(1001));
    expect(screen.getByText('1001 / 1000')).toBeInTheDocument();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    await usuario.click(screen.getByRole('button', { name: 'Comentar' }));
    expect(espia.solicitudes.filter((s) => s.metodo === 'POST')).toHaveLength(
      0,
    );
    espia.detener();
  });

  it('comenta: envía a la decisión, vacía el campo y el comentario aparece en la lista y en el historial', async () => {
    const usuario = userEvent.setup();
    const { id, decisionId } = sugerenciaComentable();
    const espia = espiarSolicitudes();
    montar(id);
    const campo = await screen.findByRole('textbox', {
      name: 'Dejar un comentario',
    });
    await usuario.type(campo, '  Este CFDI parece de otra obra  ');
    await usuario.click(screen.getByRole('button', { name: 'Comentar' }));
    const items = await within(tarjeta()).findAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(
      within(items[0]!).getByText('Este CFDI parece de otra obra'),
    ).toBeInTheDocument();
    expect(campo).toHaveValue('');
    expect(
      espia.cuantas('POST', `/api/conciliaciones/${decisionId}/comentarios`),
    ).toBe(1);
    expect(await screen.findByText('Comentario')).toBeInTheDocument();
    expect(
      await screen.findByText(/^.+ · Este CFDI parece de otra obra$/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    espia.detener();
  });

  it('en un caso conciliado comenta sobre la propuesta confirmada', async () => {
    const usuario = userEvent.setup();
    const espia = espiarSolicitudes();
    const confirmada = propuestaCaso(4, {
      estado: 'confirmada',
      confirmadaAt: '2026-09-03T15:04:05.000Z',
      confirmadaPor: { nombre: 'Ana' },
    });
    const caso = servir(
      casoConciliado({ puedeComentar: true, propuestas: [confirmada] }),
    );
    servidor.use(
      http.post('/api/conciliaciones/:id/comentarios', () =>
        HttpResponse.json(
          { ...COMENTARIOS[0], decisionId: confirmada.conciliacionId },
          { status: 201 },
        ),
      ),
    );
    montar(caso.movimiento.id);
    const campo = await screen.findByRole('textbox', {
      name: 'Dejar un comentario',
    });
    await usuario.type(campo, 'Hola');
    await usuario.click(screen.getByRole('button', { name: 'Comentar' }));
    await within(tarjeta()).findByRole('button', { name: 'Comentar' });
    expect(
      espia.cuantas(
        'POST',
        `/api/conciliaciones/${confirmada.conciliacionId}/comentarios`,
      ),
    ).toBe(1);
    espia.detener();
  });

  it('con varias propuestas y ninguna confirmada comenta sobre la primera', async () => {
    const usuario = userEvent.setup();
    const espia = espiarSolicitudes();
    const caso = servir(casoVarias({ puedeComentar: true }));
    servidor.use(
      http.post('/api/conciliaciones/:id/comentarios', () =>
        HttpResponse.json(COMENTARIOS[0], { status: 201 }),
      ),
    );
    montar(caso.movimiento.id);
    const campo = await screen.findByRole('textbox', {
      name: 'Dejar un comentario',
    });
    await usuario.type(campo, 'Hola');
    await usuario.click(screen.getByRole('button', { name: 'Comentar' }));
    await within(tarjeta()).findByRole('button', { name: 'Comentar' });
    expect(
      espia.cuantas(
        'POST',
        `/api/conciliaciones/${caso.propuestas[0]!.conciliacionId}/comentarios`,
      ),
    ).toBe(1);
    espia.detener();
  });

  it.each([
    [403, comentarFalla(403), 'No tienes permiso para esta acción.'],
    [404, comentarFalla(404), 'No encontramos este caso.'],
    ['red', comentarRedDeFallo(), 'No se pudo conectar con el servidor.'],
  ])(
    'si falla (%s) muestra una alerta junto al botón y conserva el texto',
    async (_nombre, manejador, titulo) => {
      const usuario = userEvent.setup();
      const caso = servir(casoSugerencia({ puedeComentar: true }));
      servidor.use(manejador);
      montar(caso.movimiento.id);
      const campo = await screen.findByRole('textbox', {
        name: 'Dejar un comentario',
      });
      await usuario.type(campo, 'Mi comentario');
      await usuario.click(screen.getByRole('button', { name: 'Comentar' }));
      const alerta = await within(tarjeta()).findByRole('alert');
      expect(alerta).toHaveTextContent(titulo);
      expect(campo).toHaveValue('Mi comentario');
      expect(screen.getByRole('button', { name: 'Comentar' })).toBeEnabled();
    },
  );

  it('al volver a escribir tras un fallo la alerta desaparece', async () => {
    const usuario = userEvent.setup();
    const caso = servir(casoSugerencia({ puedeComentar: true }));
    servidor.use(comentarFalla(403));
    montar(caso.movimiento.id);
    const campo = await screen.findByRole('textbox', {
      name: 'Dejar un comentario',
    });
    await usuario.type(campo, 'a');
    await usuario.click(screen.getByRole('button', { name: 'Comentar' }));
    await within(tarjeta()).findByRole('alert');
    await usuario.type(campo, 'b');
    expect(within(tarjeta()).queryByRole('alert')).toBeNull();
  });
});
