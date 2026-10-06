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
  propuestaCaso,
} from '@/test/fixturesCaso';
import { idDe } from '@/test/fixturesBandeja';
import { espiarSolicitudes } from '@/test/handlersAuth';
import {
  casoFalla,
  casoRedDeFallo,
  resolverFalla,
  resolverRedDeFallo,
} from '@/test/handlersCaso';
import { clienteDePruebas, sesionConEpoca } from '@/test/montarBandeja';
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

  describe('estados de lectura', () => {
    const SIN_RASTRO = 'detalle del servidor';

    it('404: copy de no encontrado, enlace a la bandeja y nada del servidor', async () => {
      servidor.use(casoFalla(404));
      montar(idDe(9));
      expect(
        await screen.findByText('No encontramos este caso.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Puede que no exista o que pertenezca a otra empresa.',
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Volver a la bandeja' }),
      ).toHaveAttribute('href', '/bandeja');
      expect(document.body.textContent).not.toContain(SIN_RASTRO);
      expect(document.body.textContent).not.toContain(idDe(9));
      expect(screen.queryByRole('heading', { name: 'Tu decisión' })).toBeNull();
    });

    it('400 (id mal formado) muestra lo mismo que un 404', async () => {
      servidor.use(casoFalla(400));
      montar('42');
      expect(
        await screen.findByText('No encontramos este caso.'),
      ).toBeInTheDocument();
    });

    it('403 en la lectura: permiso genérico, sin redirigir', async () => {
      servidor.use(casoFalla(403));
      const router = montar(idDe(1));
      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
      expect(alerta).toHaveTextContent(
        'Si crees que es un error, pide acceso a un administrador de la empresa.',
      );
      expect(router.state.location.pathname).toBe(`/casos/${idDe(1)}`);
      expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    });

    it('fallo de red: avisa, ofrece «Reintentar» y el reintento muestra el caso', async () => {
      servidor.use(casoRedDeFallo());
      const caso = casoSugerencia();
      montar(caso.movimiento.id);
      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
      expect(alerta).toHaveTextContent(
        'Revisa tu conexión e inténtalo de nuevo.',
      );
      expect(
        screen.getByRole('link', { name: '← Volver a la bandeja' }),
      ).toBeInTheDocument();
      servir(caso);
      servirHistorial();
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(
        await screen.findByRole('heading', { level: 2, name: /SPEI/ }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('5xx: mismo aviso de conectividad, sin texto del servidor', async () => {
      servidor.use(casoFalla(500));
      montar(idDe(1));
      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
      expect(document.body.textContent).not.toContain(SIN_RASTRO);
    });

    it('contrato: un monto numérico no se pinta a medias y «Reintentar» lo vuelve a pedir', async () => {
      const espia = espiarSolicitudes();
      const malo = { ...casoSugerencia(), toleranciaMonto: 0.5 };
      servir(malo as unknown as ReturnType<typeof casoSugerencia>);
      montar(idDe(1));
      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent('No pudimos mostrar este caso.');
      expect(alerta).toHaveTextContent(
        'El servidor respondió con datos inesperados. Inténtalo de nuevo más tarde.',
      );
      expect(screen.queryByText(/SPEI/)).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      await waitFor(() =>
        expect(espia.cuantas('GET', `/api/casos/${idDe(1)}`)).toBe(2),
      );
      espia.detener();
    });

    it('401: la capa de sesión decide; la pantalla no pinta ningún mensaje', async () => {
      const espia = espiarSolicitudes();
      servidor.use(casoFalla(401));
      montar(idDe(1));
      await waitFor(() =>
        expect(espia.cuantas('GET', `/api/casos/${idDe(1)}`)).toBe(1),
      );
      await new Promise((r) => setTimeout(r, 40));
      espia.detener();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByText('No encontramos este caso.')).toBeNull();
      expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
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

    describe('errores de la acción', () => {
      const SIN_RASTRO = 'detalle del servidor';
      const sugerencia = () => screen.getByText('Sugerencia');

      async function abrir(caso = casoSugerencia()) {
        servir(caso);
        servirHistorial();
        montar(caso.movimiento.id);
        await screen.findByRole('heading', { name: 'Tu decisión' });
        return caso;
      }

      it('403 al confirmar (D-08): copy aprobado, sin código ni texto del servidor, foco en la alerta', async () => {
        await abrir();
        servidor.use(resolverFalla(403));
        await userEvent.click(confirmar('A-1001'));
        const alerta = await screen.findByRole('alert');
        expect(alerta).toHaveTextContent('No puedes confirmar este caso.');
        expect(alerta).toHaveTextContent(
          'Quien subió el CFDI o el estado de cuenta no puede confirmarlo. Pide a otra persona de la empresa que lo revise.',
        );
        expect(document.body.textContent).not.toMatch(/acceso_denegado/i);
        expect(document.body.textContent).not.toContain(SIN_RASTRO);
        expect(alerta).toHaveFocus();
        expect(sugerencia()).toBeInTheDocument();
        expect(confirmar('A-1001')).toBeEnabled();
        expect(rechazar('A-1001')).toBeEnabled();
      });

      it('403 al rechazar: permiso genérico, no el de la segregación', async () => {
        await abrir();
        servidor.use(resolverFalla(403));
        await userEvent.click(rechazar('A-1001'));
        const alerta = await screen.findByRole('alert');
        expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
        expect(alerta).not.toHaveTextContent('No puedes confirmar este caso.');
      });

      it('400 por motivo largo: el mensaje queda bajo el campo, el texto se conserva y el foco vuelve al campo', async () => {
        await abrir();
        servidor.use(resolverFalla(400));
        await userEvent.type(campo(), 'No corresponde');
        await userEvent.click(rechazar('A-1001'));
        await waitFor(() =>
          expect(campo()).toHaveAttribute('aria-invalid', 'true'),
        );
        expect(
          screen.getByText('El motivo no puede pasar de 500 caracteres.'),
        ).toBeInTheDocument();
        expect(screen.queryByRole('alert')).toBeNull();
        expect(campo()).toHaveValue('No corresponde');
        expect(campo()).toHaveFocus();
        expect(rechazar('A-1001')).toBeEnabled();
        await userEvent.type(campo(), '!');
        expect(campo()).not.toHaveAttribute('aria-invalid');
      });

      it('409: alerta con «Recargar caso», controles bloqueados y ninguna recarga por sí sola', async () => {
        const espia = espiarSolicitudes();
        const caso = await abrir();
        const ruta = `/api/casos/${caso.movimiento.id}`;
        servidor.use(resolverFalla(409));
        await userEvent.click(confirmar('A-1001'));
        const alerta = await screen.findByRole('alert');
        expect(alerta).toHaveTextContent('Este caso ya cambió.');
        expect(alerta).toHaveTextContent(
          'Otra persona lo resolvió o la propuesta ya no está vigente. Recarga para ver su estado actual.',
        );
        expect(confirmar('A-1001')).toBeDisabled();
        expect(rechazar('A-1001')).toBeDisabled();
        const antes = espia.cuantas('GET', ruta);
        await new Promise((r) => setTimeout(r, 120));
        fireEvent.focus(window);
        fireEvent(document, new Event('visibilitychange'));
        await new Promise((r) => setTimeout(r, 60));
        espia.detener();
        expect(espia.cuantas('GET', ruta)).toBe(antes);
        expect(antes).toBe(1);
      });

      it('«Recargar caso» vuelve a pedir el caso, limpia la alerta y pinta el estado del servidor', async () => {
        const espia = espiarSolicitudes();
        const caso = await abrir();
        const ruta = `/api/casos/${caso.movimiento.id}`;
        servidor.use(resolverFalla(409));
        await userEvent.click(confirmar('A-1001'));
        await screen.findByRole('alert');
        servir(casoConciliado({ movimiento: caso.movimiento }));
        await userEvent.click(
          screen.getByRole('button', { name: 'Recargar caso' }),
        );
        expect(
          await screen.findByRole('heading', { level: 3, name: 'Conciliado' }),
        ).toBeInTheDocument();
        expect(screen.queryByRole('alert')).toBeNull();
        espia.detener();
        expect(espia.cuantas('GET', ruta)).toBe(2);
      });

      it('404 al resolver: copy de no encontrado y controles bloqueados', async () => {
        await abrir();
        servidor.use(resolverFalla(404));
        await userEvent.click(confirmar('A-1001'));
        const alerta = await screen.findByRole('alert');
        expect(alerta).toHaveTextContent('No encontramos este caso.');
        expect(
          within(alerta).getByRole('link', { name: 'Volver a la bandeja' }),
        ).toHaveAttribute('href', '/bandeja');
        expect(confirmar('A-1001')).toBeDisabled();
      });

      it('fallo de red: aviso de conectividad, controles habilitados y el motivo intacto', async () => {
        await abrir();
        servidor.use(resolverRedDeFallo());
        await userEvent.type(campo(), 'Monto no corresponde');
        await userEvent.click(rechazar('A-1001'));
        const alerta = await screen.findByRole('alert');
        expect(alerta).toHaveTextContent(
          'No se pudo conectar con el servidor.',
        );
        expect(confirmar('A-1001')).toBeEnabled();
        expect(rechazar('A-1001')).toBeEnabled();
        expect(campo()).toHaveValue('Monto no corresponde');
      });

      it('5xx: el mismo aviso y el motivo escrito sigue ahí', async () => {
        await abrir();
        servidor.use(resolverFalla(500));
        await userEvent.type(campo(), 'otra obra');
        await userEvent.click(rechazar('A-1001'));
        expect(await screen.findByRole('alert')).toHaveTextContent(
          'No se pudo conectar con el servidor.',
        );
        expect(campo()).toHaveValue('otra obra');
      });

      it('un 200 con cuerpo ilegible: aviso de contrato, sin banner y el caso se vuelve a pedir', async () => {
        const espia = espiarSolicitudes();
        const caso = await abrir();
        servirResolucion(() => HttpResponse.json({ estado: 'otra' }));
        await userEvent.click(confirmar('A-1001'));
        expect(await screen.findByRole('alert')).toHaveTextContent(
          'No pudimos mostrar este caso.',
        );
        expect(
          screen.queryByRole('status', { name: /confirmada/i }),
        ).toBeNull();
        await waitFor(() =>
          expect(espia.cuantas('GET', `/api/casos/${caso.movimiento.id}`)).toBe(
            2,
          ),
        );
        espia.detener();
      });

      it('un fallo cuya época ya pasó no se muestra', async () => {
        const caso = casoSugerencia();
        servir(caso);
        servirHistorial();
        servidor.use(
          http.post('/api/conciliaciones/:id/:accion', async () => {
            await delay(80);
            return HttpResponse.json({ statusCode: 409 }, { status: 409 });
          }),
        );
        const router = createMemoryRouter(
          [{ path: '/casos/:movimientoId', element: <CasoPage /> }],
          { initialEntries: [`/casos/${caso.movimiento.id}`] },
        );
        const cliente = clienteDePruebas();
        const dibujar = (epoca: number) => (
          <QueryClientProvider client={cliente}>
            <SessionStateProvider estado={sesionConEpoca(epoca)}>
              <RouterProvider router={router} />
            </SessionStateProvider>
          </QueryClientProvider>
        );
        const { rerender } = render(dibujar(1));
        await screen.findByRole('heading', { name: 'Tu decisión' });
        await userEvent.click(confirmar('A-1001'));
        rerender(dibujar(2));
        await new Promise((r) => setTimeout(r, 160));
        expect(screen.queryByRole('alert')).toBeNull();
      });
    });

    describe('banners, foco y caso desactualizado', () => {
      const CONFIRMADA =
        'Conciliación confirmada. El movimiento y el CFDI quedan cerrados.';

      const bannerDe = (texto: string) => {
        const banner = screen.getByText(texto).closest('[role="status"]');
        if (!(banner instanceof HTMLElement)) throw new Error('sin banner');
        return banner;
      };

      /** Sirve `antes` hasta que se resuelve y `despues` desde entonces. */
      function servirTrasResolver(
        antes: ReturnType<typeof casoSugerencia>,
        despues: ReturnType<typeof casoSugerencia>,
        respuesta: () => object,
      ) {
        let resuelto = false;
        servidor.use(
          http.get('/api/casos/:id', () =>
            HttpResponse.json(resuelto ? despues : antes),
          ),
        );
        servirResolucion(() => {
          resuelto = true;
          return HttpResponse.json(respuesta());
        });
      }

      it('tras confirmar: banner con usuario y fecha del caso vuelto a pedir, variante conciliado, sin controles y sin navegar', async () => {
        const base = casoVarias();
        servirTrasResolver(
          base,
          casoConciliado({ movimiento: base.movimiento }),
          () => ({
            ...resolucion('confirmada'),
            rechazadasAutomaticamente: [idDe(5002), idDe(5003)],
          }),
        );
        servirHistorial(() => [
          ...EVENTOS,
          {
            id: 'e2',
            accion: 'confirmar',
            createdAt: '2026-10-05T18:00:00.000Z',
            usuario: { nombre: 'Ana' },
          },
        ]);
        const router = montar(base.movimiento.id);
        await screen.findByRole('heading', { name: 'Tu decisión' });
        await userEvent.click(confirmar('A-1001'));
        await screen.findByText(CONFIRMADA);
        const banner = bannerDe(CONFIRMADA);
        expect(banner).toHaveTextContent(/Ana · \d{4}-\d{2}-\d{2}/);
        expect(banner).toHaveTextContent(
          'Las demás propuestas de este movimiento se rechazaron.',
        );
        expect(banner).toHaveFocus();
        expect(
          screen.getByRole('heading', { level: 3, name: 'Conciliado' }),
        ).toBeInTheDocument();
        expect(
          screen.queryByRole('heading', { name: 'Tu decisión' }),
        ).toBeNull();
        expect(
          screen.queryByRole('button', { name: /Confirmar|Rechazar/ }),
        ).toBeNull();
        expect(await screen.findByText('Confirmada')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe(
          `/casos/${base.movimiento.id}`,
        );
      });

      it('confirmar sin hermanas rechazadas no lleva nota', async () => {
        const base = casoSugerencia();
        servirTrasResolver(
          base,
          casoConciliado({ movimiento: base.movimiento }),
          () => resolucion('confirmada'),
        );
        servirHistorial();
        montar(base.movimiento.id);
        await screen.findByRole('heading', { name: 'Tu decisión' });
        await userEvent.click(confirmar('A-1001'));
        await screen.findByText(CONFIRMADA);
        expect(
          screen.queryByText(/otra propuesta|demás propuestas/),
        ).toBeNull();
      });

      it('con una hermana rechazada usa el singular aprobado', async () => {
        const base = casoVarias();
        servirTrasResolver(
          base,
          casoConciliado({ movimiento: base.movimiento }),
          () => ({
            ...resolucion('confirmada'),
            rechazadasAutomaticamente: [idDe(5002)],
          }),
        );
        servirHistorial();
        montar(base.movimiento.id);
        await screen.findByRole('heading', { name: 'Tu decisión' });
        await userEvent.click(confirmar('A-1001'));
        expect(
          await screen.findByText(
            'La otra propuesta de este movimiento se rechazó.',
          ),
        ).toBeInTheDocument();
      });

      it('tras rechazar con propuestas restantes: la rechazada desaparece y las demás conservan los controles', async () => {
        const base = casoVarias();
        servirTrasResolver(
          base,
          casoSugerencia({
            movimiento: base.movimiento,
            propuestas: [propuestaCaso(2), propuestaCaso(3)],
          }),
          () => ({ ...resolucion('rechazada'), id: idDe(5001) }),
        );
        servirHistorial();
        montar(base.movimiento.id);
        await screen.findByRole('heading', { name: 'Tu decisión' });
        await userEvent.click(rechazar('A-1001'));
        await screen.findByText('Propuesta rechazada.');
        expect(
          screen.getByText(
            'Quedan 2 propuestas vigentes para este movimiento.',
          ),
        ).toBeInTheDocument();
        expect(screen.queryByText('A-1001')).toBeNull();
        expect(confirmar('A-1002')).toBeEnabled();
        expect(rechazar('A-1002')).toBeEnabled();
      });

      it('con una sola propuesta restante usa «Queda 1 propuesta vigente» (B11)', async () => {
        const base = casoVarias();
        servirTrasResolver(
          base,
          casoSugerencia({
            movimiento: base.movimiento,
            propuestas: [propuestaCaso(2)],
          }),
          () => resolucion('rechazada'),
        );
        servirHistorial();
        montar(base.movimiento.id);
        await screen.findByRole('heading', { name: 'Tu decisión' });
        await userEvent.click(rechazar('A-1001'));
        expect(
          await screen.findByText(
            'Queda 1 propuesta vigente para este movimiento.',
          ),
        ).toBeInTheDocument();
      });

      it('al rechazar la última: variante sin match con el banner y el historial de la rechazada (B5)', async () => {
        const base = casoSugerencia();
        const rechazada = base.propuestas[0]?.conciliacionId ?? '';
        servirTrasResolver(
          base,
          casoSinMatch({ movimiento: base.movimiento }),
          () => ({ ...resolucion('rechazada'), id: rechazada }),
        );
        servirHistorial((id) =>
          id === rechazada
            ? [
                ...EVENTOS,
                {
                  id: 'e2',
                  accion: 'rechazar',
                  createdAt: '2026-10-05T18:00:00.000Z',
                  usuario: { nombre: 'Luis' },
                },
              ]
            : [],
        );
        montar(base.movimiento.id);
        await screen.findByRole('heading', { name: 'Tu decisión' });
        await userEvent.click(rechazar('A-1001'));
        await screen.findByText('El movimiento vuelve a sin match.');
        expect(screen.getByText('Propuesta rechazada.')).toBeInTheDocument();
        expect(
          screen.getByRole('heading', { level: 3, name: 'Sin match' }),
        ).toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /Confirmar|Rechazar/ }),
        ).toBeNull();
        expect(await screen.findByText('Rechazada')).toBeInTheDocument();
        expect(
          screen.queryByText('Aún no hay eventos en el historial.'),
        ).toBeNull();
      });

      it('una respuesta con estado inesperado es un fallo de contrato y no pinta ningún banner', async () => {
        const caso = casoSugerencia();
        servir(caso);
        servirHistorial();
        servirResolucion(() => HttpResponse.json({ estado: 'otra' }));
        montar(caso.movimiento.id);
        await screen.findByRole('heading', { name: 'Tu decisión' });
        await userEvent.click(confirmar('A-1001'));
        await screen.findByText('No pudimos mostrar este caso.');
        expect(
          screen.queryByText(/Conciliación confirmada|Propuesta rechazada/),
        ).toBeNull();
      });

      it('un exceso de caracteres devuelve el foco al campo del motivo', async () => {
        const caso = servir();
        servirHistorial();
        montar(caso.movimiento.id);
        await screen.findByRole('heading', { name: 'Tu decisión' });
        fireEvent.change(campo(), { target: { value: 'a'.repeat(501) } });
        await userEvent.click(rechazar('A-1001'));
        expect(campo()).toHaveFocus();
      });

      it('tras «Recargar caso» el foco va a la descripción del movimiento', async () => {
        const caso = servir();
        servirHistorial();
        montar(caso.movimiento.id);
        await screen.findByRole('heading', { name: 'Tu decisión' });
        servidor.use(resolverFalla(409));
        await userEvent.click(confirmar('A-1001'));
        await screen.findByRole('alert');
        servir(casoSugerencia({ movimiento: caso.movimiento }));
        await userEvent.click(
          screen.getByRole('button', { name: 'Recargar caso' }),
        );
        await waitFor(() =>
          expect(
            screen.getByRole('heading', { level: 2, name: /SPEI/ }),
          ).toHaveFocus(),
        );
      });

      it('desactualizado (B9): si el caso no se puede volver a pedir, banner sin detalle, el aviso de conectividad debajo y los controles bloqueados', async () => {
        const base = casoSugerencia();
        let lecturas = 0;
        servidor.use(
          http.get('/api/casos/:id', () => {
            lecturas += 1;
            return lecturas === 1
              ? HttpResponse.json(base)
              : HttpResponse.error();
          }),
        );
        servirHistorial();
        servirResolucion(() => HttpResponse.json(resolucion('confirmada')));
        montar(base.movimiento.id);
        await screen.findByRole('heading', { name: 'Tu decisión' });
        await userEvent.click(confirmar('A-1001'));
        await screen.findByText(CONFIRMADA);
        const banner = bannerDe(CONFIRMADA);
        expect(banner.querySelectorAll('span')).toHaveLength(0);
        const alerta = await screen.findByRole('alert');
        expect(alerta).toHaveTextContent(
          'No se pudo conectar con el servidor.',
        );
        expect(alerta).toHaveTextContent(
          'Revisa tu conexión e inténtalo de nuevo.',
        );
        expect(
          banner.compareDocumentPosition(alerta) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(confirmar('A-1001')).toBeDisabled();
        expect(rechazar('A-1001')).toBeDisabled();
        expect(campo()).toBeDisabled();

        servir(casoConciliado({ movimiento: base.movimiento }));
        await userEvent.click(
          within(alerta).getByRole('button', { name: 'Reintentar' }),
        );
        await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
        expect(bannerDe(CONFIRMADA)).toHaveTextContent(/Ana · /);
        expect(
          screen.getByRole('heading', { level: 3, name: 'Conciliado' }),
        ).toBeInTheDocument();
      });

      it('si la época cambió en vuelo no se muestra ningún banner', async () => {
        const caso = casoSugerencia();
        servir(caso);
        servirHistorial();
        servirResolucion(async () => {
          await delay(80);
          return HttpResponse.json(resolucion('confirmada'));
        });
        const router = createMemoryRouter(
          [{ path: '/casos/:movimientoId', element: <CasoPage /> }],
          { initialEntries: [`/casos/${caso.movimiento.id}`] },
        );
        const cliente = clienteDePruebas();
        const dibujar = (epoca: number) => (
          <QueryClientProvider client={cliente}>
            <SessionStateProvider estado={sesionConEpoca(epoca)}>
              <RouterProvider router={router} />
            </SessionStateProvider>
          </QueryClientProvider>
        );
        const { rerender } = render(dibujar(1));
        await screen.findByRole('heading', { name: 'Tu decisión' });
        await userEvent.click(confirmar('A-1001'));
        rerender(dibujar(2));
        await new Promise((r) => setTimeout(r, 160));
        expect(screen.queryByText(CONFIRMADA)).toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
      });
    });
  });
});
