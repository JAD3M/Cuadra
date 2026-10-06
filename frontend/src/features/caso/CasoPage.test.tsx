import { QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SessionStateProvider } from '@/shared/sesion';
import { SESION_LISTA } from '@/test/fixtures';
import {
  casoConciliado,
  casoSinMatch,
  casoSugerencia,
  casoVarias,
} from '@/test/fixturesCaso';
import { idDe } from '@/test/fixturesBandeja';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { clienteDePruebas } from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import { CasoPage } from './CasoPage';

function montar(movimientoId: string) {
  const router = createMemoryRouter(
    [
      { path: '/casos/:movimientoId', element: <CasoPage /> },
      { path: '/bandeja', element: <p>Bandeja</p> },
    ],
    { initialEntries: [`/casos/${encodeURIComponent(movimientoId)}`] },
  );
  render(
    <QueryClientProvider client={clienteDePruebas()}>
      <SessionStateProvider estado={SESION_LISTA}>
        <RouterProvider router={router} />
      </SessionStateProvider>
    </QueryClientProvider>,
  );
  return router;
}

function servir(caso = casoSugerencia()) {
  servidor.use(http.get('/api/casos/:id', () => HttpResponse.json(caso)));
  return caso;
}

const EVENTOS = [
  {
    id: 'e1',
    accion: 'crear',
    createdAt: '2026-09-16T15:14:00.000Z',
    usuario: null,
  },
];

/** Historial por conciliación; `eventosPor` decide qué devuelve cada id. */
function servirHistorial(
  eventosPor: (id: string) => readonly object[] = () => EVENTOS,
) {
  servidor.use(
    http.get('/api/conciliaciones/:id/historial', ({ params }) =>
      HttpResponse.json({ datos: eventosPor(String(params.id)) }),
    ),
  );
}

/** Las ✓ de coincidencia (datos), sin la del botón de confirmar. */
function marcasDeCoincidencia() {
  return screen.queryAllByText('✓').filter((el) => el.closest('dd') !== null);
}

describe('CasoPage', () => {
  it('lee el parámetro movimientoId y pide ese caso', async () => {
    const espia = espiarSolicitudes();
    const caso = servir();
    montar(caso.movimiento.id);
    await screen.findByRole('heading', {
      level: 2,
      name: caso.movimiento.descripcion,
    });
    espia.detener();
    expect(espia.cuantas('GET', `/api/casos/${caso.movimiento.id}`)).toBe(1);
  });

  it('muestra la espera accesible mientras carga', async () => {
    servidor.use(
      http.get('/api/casos/:id', async () => {
        await new Promise((r) => setTimeout(r, 40));
        return HttpResponse.json(casoSugerencia());
      }),
    );
    montar(idDe(1));
    expect(screen.getByText('Cargando caso')).toBeInTheDocument();
    await screen.findByRole('heading', { level: 2, name: /SPEI/ });
    expect(screen.queryByText('Cargando caso')).toBeNull();
  });

  it('una sugerencia muestra encabezado, movimiento y la propuesta expandida', async () => {
    const caso = servir();
    montar(caso.movimiento.id);
    await screen.findByRole('heading', { level: 2, name: /SPEI/ });
    expect(screen.getByText('Sugerencia')).toBeInTheDocument();
    expect(screen.getAllByText('$1,160.00').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('region', { name: 'Movimiento bancario' }),
    ).toBeInTheDocument();
    expect(screen.getByText('CFDI candidato')).toBeInTheDocument();
    expect(screen.getByText('Por qué el motor lo propone')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ver propuesta/ })).toBeNull();
    expect(screen.queryByText(/Este movimiento tiene/)).toBeNull();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Propuestas' }),
    ).toBeInTheDocument();
  });

  it('con varias propuestas avisa y deja la mejor expandida', async () => {
    const caso = servir(casoVarias());
    montar(caso.movimiento.id);
    await screen.findByText(
      'Este movimiento tiene 3 propuestas. Al confirmar una, las demás se rechazan.',
    );
    expect(
      screen.getAllByRole('button', { name: /^Ver propuesta/ }),
    ).toHaveLength(2);
  });

  it('expandir otra propuesta cambia la tarjeta y deja la anterior como fila', async () => {
    const caso = servir(casoVarias());
    montar(caso.movimiento.id);
    await screen.findByText(/Este movimiento tiene 3/);
    const segunda = caso.propuestas[1];
    const primera = caso.propuestas[0];
    if (!segunda || !primera) throw new Error('sin propuestas');
    expect(screen.getByText('A-1001', { selector: 'dd' })).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Ver propuesta A-1002' }),
    );
    expect(screen.getByText('A-1002', { selector: 'dd' })).toBeInTheDocument();
    const lista = screen
      .getByRole('button', { name: 'Ver propuesta A-1001' })
      .closest('ul');
    expect(lista).not.toBeNull();
    expect(
      within(lista as HTMLElement).getByRole('button', {
        name: 'Ver propuesta A-1001',
      }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('sin_match y conciliado no muestran lista ni propuestas', async () => {
    const caso = servir(casoSinMatch());
    montar(caso.movimiento.id);
    await screen.findByRole('heading', { level: 2, name: /SPEI/ });
    expect(screen.queryByText('CFDI candidato')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Propuestas' })).toBeNull();
  });

  it('un sin_match muestra la tarjeta de solo lectura con el motivo del servidor', async () => {
    const caso = servir(casoSinMatch());
    montar(caso.movimiento.id);
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Sin match' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Hay varios CFDI con el mismo monto.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('un conciliado muestra el CFDI confirmado y la tarjeta de cierre, sin controles', async () => {
    const caso = servir(casoConciliado());
    montar(caso.movimiento.id);
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Conciliado' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Confirmado por Ana el /)).toBeInTheDocument();
    expect(screen.getByText('CFDI candidato')).toBeInTheDocument();
    expect(
      screen.getByText('Este caso ya está cerrado y no admite cambios.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('un caso conciliado tampoco lista propuestas', async () => {
    const caso = servir(casoConciliado());
    montar(caso.movimiento.id);
    await screen.findByRole('heading', { level: 2, name: /SPEI/ });
    expect(screen.queryByRole('heading', { name: 'Propuestas' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Ver propuesta/ })).toBeNull();
  });

  it('cambiar de caso (X a Y) muestra solo los datos de Y', async () => {
    const x = casoSugerencia();
    const y = casoSugerencia({
      movimiento: { ...x.movimiento, id: idDe(2), descripcion: 'CASO Y' },
    });
    servidor.use(
      http.get('/api/casos/:id', async ({ params }) => {
        if (params.id === x.movimiento.id) {
          await new Promise((r) => setTimeout(r, 60));
          return HttpResponse.json(x);
        }
        return HttpResponse.json(y);
      }),
    );
    const router = montar(x.movimiento.id);
    await router.navigate(`/casos/${y.movimiento.id}`);
    await screen.findByRole('heading', { level: 2, name: 'CASO Y' });
    await new Promise((r) => setTimeout(r, 90));
    expect(screen.queryByText(x.movimiento.descripcion)).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 2, name: 'CASO Y' }),
      ).toBeInTheDocument(),
    );
  });

  it('no hay h1 en la página: el h1 es del shell', async () => {
    servir();
    montar(idDe(1));
    await screen.findByRole('heading', { level: 2, name: /SPEI/ });
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('B14: con la regla referencia_monto_exacto marca la referencia y la serie-folio', async () => {
    const base = casoSugerencia();
    const caso = servir({
      ...base,
      propuestas: [
        {
          ...(base.propuestas[0] as (typeof base.propuestas)[number]),
          regla: 'referencia_monto_exacto',
        },
      ],
    });
    montar(caso.movimiento.id);
    await screen.findByRole('heading', { level: 2, name: /SPEI/ });
    expect(marcasDeCoincidencia()).toHaveLength(2);
  });

  it('B14: con otra regla no hay ninguna ✓', async () => {
    servir();
    montar(idDe(1));
    await screen.findByRole('heading', { level: 2, name: /SPEI/ });
    expect(marcasDeCoincidencia()).toHaveLength(0);
  });

  describe('historial', () => {
    it('una sugerencia pide el historial de la propuesta y muestra «Esperando decisión»', async () => {
      const espia = espiarSolicitudes();
      const caso = servir();
      servirHistorial();
      montar(caso.movimiento.id);
      expect(
        await screen.findByText('El motor propuso el CFDI A-1001'),
      ).toBeInTheDocument();
      expect(screen.getByText('Esperando decisión')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 2, name: 'Historial' }),
      ).toBeInTheDocument();
      espia.detener();
      const primera = caso.propuestas[0];
      expect(
        espia.cuantas(
          'GET',
          `/api/conciliaciones/${primera?.conciliacionId}/historial`,
        ),
      ).toBe(1);
    });

    it('al expandir otra propuesta pide el historial de la nueva', async () => {
      const espia = espiarSolicitudes();
      const caso = servir(casoVarias());
      servirHistorial();
      montar(caso.movimiento.id);
      await screen.findByText(/Este movimiento tiene 3/);
      await userEvent.click(
        screen.getByRole('button', { name: 'Ver propuesta A-1002' }),
      );
      await screen.findByText('El motor propuso el CFDI A-1002');
      espia.detener();
      const segunda = caso.propuestas[1];
      expect(
        espia.cuantas(
          'GET',
          `/api/conciliaciones/${segunda?.conciliacionId}/historial`,
        ),
      ).toBe(1);
    });

    it('un sin_match no pide historial y dice que no hay eventos', async () => {
      const espia = espiarSolicitudes();
      const caso = servir(casoSinMatch());
      montar(caso.movimiento.id);
      await screen.findByText('Aún no hay eventos en el historial.');
      espia.detener();
      expect(espia.solicitudes.some((s) => s.ruta.includes('historial'))).toBe(
        false,
      );
      expect(screen.queryByText('Esperando decisión')).toBeNull();
    });

    it('un conciliado muestra los eventos y no la fila pendiente', async () => {
      const caso = servir(casoConciliado());
      servirHistorial(() => [
        ...EVENTOS,
        {
          id: 'e2',
          accion: 'confirmar',
          createdAt: '2026-10-05T18:00:00.000Z',
          usuario: { nombre: 'Ana' },
        },
      ]);
      montar(caso.movimiento.id);
      expect(await screen.findByText('Confirmada')).toBeInTheDocument();
      expect(screen.queryByText('Esperando decisión')).toBeNull();
    });

    it('si el historial falla el caso sigue usable y el error trae «Reintentar»', async () => {
      const caso = servir();
      servidor.use(
        http.get('/api/conciliaciones/:id/historial', () =>
          HttpResponse.json({ statusCode: 500 }, { status: 500 }),
        ),
      );
      montar(caso.movimiento.id);
      expect(
        await screen.findByRole('button', { name: 'Reintentar' }),
      ).toBeInTheDocument();
      expect(screen.getByText('CFDI candidato')).toBeInTheDocument();
      servirHistorial();
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(
        await screen.findByText('El motor propuso el CFDI A-1001'),
      ).toBeInTheDocument();
    });
  });

  describe('decisión', () => {
    interface Pedido {
      ruta: string;
      cuerpo: string;
    }

    /** Registra los POST de resolución y responde `respuesta`. */
    function servirResolucion(
      respuesta: () => Response | Promise<Response> = () =>
        HttpResponse.json(resolucion('confirmada')),
    ) {
      const pedidos: Pedido[] = [];
      servidor.use(
        http.post('/api/conciliaciones/:id/:accion', async ({ request }) => {
          pedidos.push({
            ruta: new URL(request.url).pathname,
            cuerpo: await request.text(),
          });
          return respuesta();
        }),
      );
      return pedidos;
    }

    function resolucion(estado: 'confirmada' | 'rechazada') {
      return {
        id: idDe(5001),
        estado,
        cfdiId: idDe(7001),
        movimientoId: idDe(1),
        motivo: null,
        confirmadaAt:
          estado === 'confirmada' ? '2026-10-05T10:00:00.000Z' : null,
        rechazadasAutomaticamente: [],
      };
    }

    const confirmar = (cfdi: string) =>
      screen.getByRole('button', { name: `Confirmar conciliación ${cfdi}` });
    const rechazar = (cfdi: string) =>
      screen.getByRole('button', { name: `Rechazar ${cfdi}` });
    const campo = () => screen.getByLabelText('Motivo del rechazo (opcional)');

    it('una sugerencia muestra «Tu decisión» con los controles habilitados', async () => {
      const caso = servir();
      servirHistorial();
      montar(caso.movimiento.id);
      expect(
        await screen.findByRole('heading', { level: 2, name: 'Tu decisión' }),
      ).toBeInTheDocument();
      expect(confirmar('A-1001')).toBeEnabled();
      expect(rechazar('A-1001')).toBeEnabled();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('sin_match y conciliado no tienen panel de decisión', async () => {
      const sinMatch = servir(casoSinMatch());
      montar(sinMatch.movimiento.id);
      await screen.findByRole('heading', { level: 3, name: 'Sin match' });
      expect(screen.queryByText('Tu decisión')).toBeNull();
    });

    it('B12: el orden del DOM es la propuesta expandida, la decisión y las filas colapsadas', async () => {
      const caso = servir(casoVarias());
      servirHistorial();
      montar(caso.movimiento.id);
      const cfdi = await screen.findByText('CFDI candidato');
      const decision = screen.getByRole('heading', { name: 'Tu decisión' });
      const fila = screen.getByRole('button', { name: 'Ver propuesta A-1002' });
      const despues = Node.DOCUMENT_POSITION_FOLLOWING;
      expect(cfdi.compareDocumentPosition(decision) & despues).toBeTruthy();
      expect(decision.compareDocumentPosition(fila) & despues).toBeTruthy();
    });

    it('confirmar envía un único POST a la propuesta expandida, sin cuerpo', async () => {
      const caso = servir(casoVarias());
      servirHistorial();
      const pedidos = servirResolucion();
      montar(caso.movimiento.id);
      await screen.findByText(/Este movimiento tiene 3/);
      await userEvent.click(
        screen.getByRole('button', { name: 'Ver propuesta A-1002' }),
      );
      await userEvent.click(confirmar('A-1002'));
      await waitFor(() => expect(pedidos).toHaveLength(1));
      expect(pedidos[0]).toEqual({
        ruta: `/api/conciliaciones/${caso.propuestas[1]?.conciliacionId}/confirmar`,
        cuerpo: '',
      });
    });

    it('un doble clic o Enter envía una sola solicitud', async () => {
      const caso = servir();
      servirHistorial();
      const pedidos = servirResolucion(async () => {
        await delay(60);
        return HttpResponse.json(resolucion('confirmada'));
      });
      montar(caso.movimiento.id);
      await screen.findByRole('heading', { name: 'Tu decisión' });
      const boton = confirmar('A-1001');
      fireEvent.click(boton);
      fireEvent.click(boton);
      fireEvent.keyDown(boton, { key: 'Enter' });
      await waitFor(() => expect(pedidos).toHaveLength(1));
      await new Promise((r) => setTimeout(r, 120));
      expect(pedidos).toHaveLength(1);
    });

    it('en vuelo no hay optimismo: sigue siendo sugerencia, sin banner y con los botones bloqueados', async () => {
      const caso = servir();
      servirHistorial();
      servirResolucion(async () => {
        await delay(80);
        return HttpResponse.json(resolucion('confirmada'));
      });
      montar(caso.movimiento.id);
      await screen.findByRole('heading', { name: 'Tu decisión' });
      await userEvent.click(confirmar('A-1001'));
      expect(
        await screen.findByRole('button', { name: /^Confirmando…/ }),
      ).toBeDisabled();
      expect(rechazar('A-1001')).toBeDisabled();
      expect(screen.getByText('Sugerencia')).toBeInTheDocument();
      expect(screen.getByText('Enviando tu decisión')).toBeInTheDocument();
    });

    it('tras confirmar y volver a pedir el caso conciliado, desaparecen los controles', async () => {
      let confirmado = false;
      const base = casoSugerencia();
      servidor.use(
        http.get('/api/casos/:id', () =>
          HttpResponse.json(
            confirmado ? casoConciliado({ movimiento: base.movimiento }) : base,
          ),
        ),
      );
      servirHistorial();
      servirResolucion(() => {
        confirmado = true;
        return HttpResponse.json(resolucion('confirmada'));
      });
      montar(base.movimiento.id);
      await screen.findByRole('heading', { name: 'Tu decisión' });
      await userEvent.click(confirmar('A-1001'));
      expect(
        await screen.findByRole('heading', { level: 3, name: 'Conciliado' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Tu decisión' })).toBeNull();
      expect(screen.queryByRole('button', { name: /Confirmar/ })).toBeNull();
    });

    it('rechazar sin motivo envía un objeto vacío, sin clave motivo', async () => {
      const caso = servir();
      servirHistorial();
      const pedidos = servirResolucion(() =>
        HttpResponse.json(resolucion('rechazada')),
      );
      montar(caso.movimiento.id);
      await screen.findByRole('heading', { name: 'Tu decisión' });
      await userEvent.type(campo(), '   ');
      await userEvent.click(rechazar('A-1001'));
      await waitFor(() => expect(pedidos).toHaveLength(1));
      expect(pedidos[0]?.ruta).toBe(
        `/api/conciliaciones/${caso.propuestas[0]?.conciliacionId}/rechazar`,
      );
      expect(JSON.parse(pedidos[0]?.cuerpo ?? '')).toEqual({});
    });

    it('rechazar con motivo lo envía recortado', async () => {
      const caso = servir();
      servirHistorial();
      const pedidos = servirResolucion(() =>
        HttpResponse.json(resolucion('rechazada')),
      );
      montar(caso.movimiento.id);
      await screen.findByRole('heading', { name: 'Tu decisión' });
      await userEvent.type(campo(), '  Monto no corresponde  ');
      await userEvent.click(rechazar('A-1001'));
      await waitFor(() => expect(pedidos).toHaveLength(1));
      expect(JSON.parse(pedidos[0]?.cuerpo ?? '')).toEqual({
        motivo: 'Monto no corresponde',
      });
    });

    it('con más de 500 caracteres no se envía nada', async () => {
      const caso = servir();
      servirHistorial();
      const pedidos = servirResolucion();
      montar(caso.movimiento.id);
      await screen.findByRole('heading', { name: 'Tu decisión' });
      fireEvent.change(campo(), { target: { value: 'a'.repeat(501) } });
      await userEvent.click(rechazar('A-1001'));
      await new Promise((r) => setTimeout(r, 60));
      expect(pedidos).toHaveLength(0);
      expect(
        screen.getByText('El motivo no puede pasar de 500 caracteres.'),
      ).toBeInTheDocument();
    });

    it('un motivo de exactamente 500 caracteres sí se envía', async () => {
      const caso = servir();
      servirHistorial();
      const pedidos = servirResolucion(() =>
        HttpResponse.json(resolucion('rechazada')),
      );
      montar(caso.movimiento.id);
      await screen.findByRole('heading', { name: 'Tu decisión' });
      fireEvent.change(campo(), { target: { value: 'a'.repeat(500) } });
      await userEvent.click(rechazar('A-1001'));
      await waitFor(() => expect(pedidos).toHaveLength(1));
    });

    it('al expandir otra propuesta el motivo escrito no viaja con ella', async () => {
      const caso = servir(casoVarias());
      servirHistorial();
      montar(caso.movimiento.id);
      await screen.findByRole('heading', { name: 'Tu decisión' });
      await userEvent.type(campo(), 'motivo de la primera');
      await userEvent.click(
        screen.getByRole('button', { name: 'Ver propuesta A-1002' }),
      );
      await screen.findByRole('button', {
        name: 'Rechazar A-1002',
      });
      expect(campo()).toHaveValue('');
    });
  });
});
