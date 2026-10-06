import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
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
    const lista = screen.getByRole('list');
    expect(
      within(lista).getByRole('button', { name: 'Ver propuesta A-1001' }),
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
    expect(screen.getAllByText('✓')).toHaveLength(2);
  });

  it('B14: con otra regla no hay ninguna ✓', async () => {
    servir();
    montar(idDe(1));
    await screen.findByRole('heading', { level: 2, name: /SPEI/ });
    expect(screen.queryByText('✓')).toBeNull();
  });
});
