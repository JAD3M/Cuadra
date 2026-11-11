import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { FilaBandeja } from '@/shared/api/contratos';
import { SessionStateProvider, type SessionState } from '@/shared/sesion';
import { SESION_LISTA, capacidadesDeRoles } from '@/test/fixtures';
import { conPropuesta, filaBandeja, idDe } from '@/test/fixturesBandeja';
import { clienteDePruebas } from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import { BandejaPage } from './BandejaPage';

// Confirmación en lote (5.3) con los textos de los mockups 2 y 7.

const regla = (n: number, r: string, extra: Partial<FilaBandeja> = {}) =>
  filaBandeja({
    movimientoId: idDe(n),
    estado: 'sugerencia',
    propuestasCount: 1,
    motivo: null,
    regla: r,
    descripcion: `Movimiento ${n}`,
    monto: `${1000 - n}.0000`,
    mejorPropuesta: conPropuesta(n),
    ...extra,
  });

const R1A = regla(1, 'referencia_monto_exacto');
const R1B = regla(2, 'referencia_monto_exacto');
const BLOQUEADA = regla(3, 'referencia_monto_exacto', {
  motivoBloqueo: 'separacion_de_funciones',
});
const GRUPO = regla(4, 'suma_grupo');
const R2 = regla(5, 'referencia_monto_diferente');
const R3 = regla(6, 'monto_unico');
const IA = regla(7, 'llm_sugerencia');
const SIN_MATCH = filaBandeja({
  movimientoId: idDe(8),
  descripcion: 'Movimiento 8',
});
const FILAS = [R1A, R1B, BLOQUEADA, GRUPO, R2, R3, IA, SIN_MATCH];
const propuestaDe = (f: FilaBandeja) => f.mejorPropuesta?.conciliacionId;

function sesionDe(roles: string[]): SessionState {
  if (SESION_LISTA.status !== 'ready') throw new Error('fixture inválida');
  return {
    ...SESION_LISTA,
    contexto: {
      ...SESION_LISTA.contexto,
      roles: roles as never,
      capacidades: capacidadesDeRoles(roles) as never,
    },
  };
}

interface Opciones {
  filas?: FilaBandeja[];
  roles?: string[];
  lote?: () => Response | Promise<Response>;
}

function montar({ filas = FILAS, roles, lote }: Opciones = {}) {
  const pedidos = { lotes: [] as unknown[], listas: 0 };
  servidor.use(
    http.get('/api/bandeja', () => {
      pedidos.listas += 1;
      return HttpResponse.json({
        datos: filas,
        pagina: 1,
        limite: 50,
        total: filas.length,
      });
    }),
    http.get('/api/bandeja/resumen', () =>
      HttpResponse.json({
        conteos: { conciliado: 0, sugerencia: filas.length, sin_match: 0 },
        montoPorRevisar: [],
        requiereRevision: 0,
      }),
    ),
    http.post('/api/conciliaciones/lotes', async ({ request }) => {
      pedidos.lotes.push(await request.json());
      return (
        lote ??
        (() =>
          HttpResponse.json({
            loteId: idDe(900),
            confirmadas: [],
            omitidas: [],
          }))
      )();
    }),
  );
  const router = createMemoryRouter(
    [{ path: '/bandeja', element: <BandejaPage /> }],
    { initialEntries: ['/bandeja'] },
  );
  render(
    <QueryClientProvider client={clienteDePruebas()}>
      <SessionStateProvider estado={roles ? sesionDe(roles) : SESION_LISTA}>
        <RouterProvider router={router} />
      </SessionStateProvider>
    </QueryClientProvider>,
  );
  return pedidos;
}

const abrir = async () => {
  const usuario = userEvent.setup();
  await screen.findByRole('table');
  await usuario.click(
    screen.getByRole('button', { name: 'Confirmar en lote' }),
  );
  return usuario;
};
const casilla = (nombre: RegExp | string) =>
  screen.getByRole('checkbox', { name: nombre });
const marcada = (n: number) =>
  (casilla(new RegExp(`Movimiento ${n},`)) as HTMLInputElement).checked;
const botonConfirmar = () =>
  screen.getByRole('button', {
    name: /^Confirmar (\d+ propuestas?|propuestas)$|^Confirmando…$/,
  });

describe('Confirmación en lote: quién la ve (S5)', () => {
  it('admin/contador y revisor ven «Confirmar en lote»', async () => {
    for (const roles of [['admin', 'contador'], ['revisor']]) {
      const { unmount } = (() => {
        montar({ roles });
        return { unmount: () => undefined };
      })();
      expect(
        await screen.findByRole('button', { name: 'Confirmar en lote' }),
      ).toBeInTheDocument();
      unmount();
      document.body.innerHTML = '';
    }
  });

  it('un auditor no ve el botón ni ninguna casilla', async () => {
    montar({ roles: ['auditor'] });
    await screen.findByRole('table');
    expect(
      screen.queryByRole('button', { name: 'Confirmar en lote' }),
    ).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
  });

  it('sin filas no hay nada que confirmar: no ofrece el lote', async () => {
    montar({ filas: [] });
    await screen.findByText(/No hay movimientos/);
    expect(
      screen.queryByRole('button', { name: 'Confirmar en lote' }),
    ).toBeNull();
  });
});

describe('Confirmación en lote: qué viene marcado (S1, S4)', () => {
  it('solo la regla 1 viene marcada; grupo, reglas 2 y 3 e IA desmarcados', async () => {
    montar();
    await abrir();
    expect([1, 2, 4, 5, 6, 7].map(marcada)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it('la bloqueada sale desmarcada, deshabilitada y con su motivo', async () => {
    montar();
    await abrir();
    const bloqueada = casilla(/Movimiento 3,/) as HTMLInputElement;
    expect(bloqueada.checked).toBe(false);
    expect(bloqueada).toBeDisabled();
    expect(
      screen.getByText(
        'No puedes confirmarla: subiste su CFDI o su estado de cuenta. Debe confirmarla otra persona.',
      ),
    ).toBeInTheDocument();
  });

  it('un sin match no lleva casilla', async () => {
    montar();
    await abrir();
    expect(
      screen.queryByRole('checkbox', { name: /Movimiento 8,/ }),
    ).toBeNull();
    // 7 sugerencias con casilla (una bloqueada); el sin match no.
    expect(screen.getAllByRole('checkbox')).toHaveLength(7);
  });

  it('el contador cuenta las marcadas sobre las que tienen casilla y el botón lo repite', async () => {
    montar();
    await abrir();
    expect(
      screen.getByText('2 de 7 marcadas en esta página'),
    ).toBeInTheDocument();
    expect(botonConfirmar()).toHaveTextContent('Confirmar 2 propuestas');
    expect(
      within(
        screen.getByRole('region', { name: 'Confirmación en lote' }),
      ).getByText(
        'Solo la regla 1 viene marcada. Desmarca lo que no te convenza. El lote no pide motivo.',
      ),
    ).toBeInTheDocument();
  });

  it('marcar y desmarcar actualiza el contador y el botón (singular y cero)', async () => {
    montar();
    const usuario = await abrir();
    await usuario.click(casilla(/Movimiento 2,/));
    expect(botonConfirmar()).toHaveTextContent('Confirmar 1 propuesta');
    await usuario.click(casilla(/Movimiento 1,/));
    expect(
      screen.getByText(
        '0 de 7 marcadas en esta página · Marca al menos una propuesta',
      ),
    ).toBeInTheDocument();
    expect(botonConfirmar()).toBeDisabled();
    await usuario.click(casilla(/Movimiento 5,/));
    expect(botonConfirmar()).toBeEnabled();
    expect(botonConfirmar()).toHaveTextContent('Confirmar 1 propuesta');
  });

  it('«Cancelar» vuelve al modo normal sin enviar nada', async () => {
    const pedidos = montar();
    const usuario = await abrir();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    expect(
      screen.getByRole('button', { name: 'Confirmar en lote' }),
    ).toBeInTheDocument();
    expect(pedidos.lotes).toEqual([]);
  });

  it('cambiar de filtro cancela el lote', async () => {
    montar();
    const usuario = await abrir();
    await usuario.click(screen.getByRole('button', { name: 'Conciliado' }));
    expect(
      screen.queryByRole('region', { name: 'Confirmación en lote' }),
    ).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
  });
});

describe('Confirmación en lote: confirmar (S2, S3, S6)', () => {
  it('manda exactamente las marcadas, sin motivo, y muestra el resultado', async () => {
    const pedidos = montar({
      lote: () =>
        HttpResponse.json({
          loteId: idDe(900),
          confirmadas: [propuestaDe(R1A), propuestaDe(R2)],
          omitidas: [
            { id: propuestaDe(R1B), razon: 'ya_resuelta' },
            { id: propuestaDe(R3), razon: 'choca_con_otra_del_lote' },
          ],
        }),
    });
    const usuario = await abrir();
    await usuario.click(casilla(/Movimiento 2,/)); // desmarca R1B
    await usuario.click(casilla(/Movimiento 5,/)); // marca R2
    await usuario.click(casilla(/Movimiento 6,/)); // marca R3

    await usuario.click(botonConfirmar());

    await screen.findByText('Lote confirmado: 2 propuestas.');
    // R1B venía marcada y la persona la quitó: viaja como desmarcada (6.2).
    expect(pedidos.lotes).toEqual([
      {
        ids: [propuestaDe(R1A), propuestaDe(R2), propuestaDe(R3)],
        desmarcadas: [propuestaDe(R1B)],
      },
    ]);
    expect(
      screen.getByText(
        '2 se omitieron y siguen en la bandeja. Ninguna se confirmó a medias.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Otra persona ya la resolvió.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Choca con otra marcada (misma factura o mismo movimiento): confírmala a mano.',
      ),
    ).toBeInTheDocument();
    // Cada omitida se nombra con el movimiento y la factura que la persona vio.
    const lista = screen.getByRole('list');
    expect(within(lista).getByText(/Movimiento 6/)).toBeInTheDocument();
    // Sale del lote y vuelve a pedir la lista.
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    await waitFor(() => expect(pedidos.listas).toBeGreaterThan(1));
  });

  it('quitar una marca y volver a ponerla no la manda como desmarcada', async () => {
    const pedidos = montar();
    const usuario = await abrir();
    await usuario.click(casilla(/Movimiento 2,/));
    await usuario.click(casilla(/Movimiento 2,/));

    await usuario.click(botonConfirmar());

    await waitFor(() => expect(pedidos.lotes).toHaveLength(1));
    expect(pedidos.lotes[0]).toEqual({
      ids: [propuestaDe(R1A), propuestaDe(R1B)],
    });
  });

  it('marcar algo que no venía marcado y quitarlo después no cuenta como desmarcada', async () => {
    const pedidos = montar();
    const usuario = await abrir();
    await usuario.click(casilla(/Movimiento 5,/)); // marca R2
    await usuario.click(casilla(/Movimiento 5,/)); // la quita

    await usuario.click(botonConfirmar());

    await waitFor(() => expect(pedidos.lotes).toHaveLength(1));
    expect(pedidos.lotes[0]).toEqual({
      ids: [propuestaDe(R1A), propuestaDe(R1B)],
    });
  });

  it('nunca manda la bloqueada ni lo que no estaba marcado', async () => {
    const pedidos = montar();
    const usuario = await abrir();
    await usuario.click(botonConfirmar());
    await waitFor(() => expect(pedidos.lotes).toHaveLength(1));
    expect(pedidos.lotes[0]).toEqual({
      ids: [propuestaDe(R1A), propuestaDe(R1B)],
    });
  });

  it('si todas se omiten no dice «Lote confirmado» y explica por qué', async () => {
    montar({
      lote: () =>
        HttpResponse.json({
          loteId: null,
          confirmadas: [],
          omitidas: [
            { id: propuestaDe(R1A), razon: 'ya_resuelta' },
            { id: propuestaDe(R1B), razon: 'cambio_concurrente' },
          ],
        }),
    });
    const usuario = await abrir();
    await usuario.click(botonConfirmar());
    await screen.findByText('No se confirmó ninguna propuesta.');
    expect(screen.queryByText(/Lote confirmado/)).toBeNull();
    expect(
      screen.getByText('Las 2 se omitieron y siguen en la bandeja.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Cambió mientras se confirmaba: revísala de nuevo.'),
    ).toBeInTheDocument();
  });

  it('con una sola confirmada y ninguna omitida solo dice el título', async () => {
    montar({
      lote: () =>
        HttpResponse.json({
          loteId: idDe(900),
          confirmadas: [propuestaDe(R1A)],
          omitidas: [],
        }),
    });
    const usuario = await abrir();
    await usuario.click(botonConfirmar());
    await screen.findByText('Lote confirmado: 1 propuesta.');
    expect(screen.queryByText(/se omiti/)).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('mientras envía bloquea casillas y botones y el botón dice «Confirmando…»', async () => {
    montar({
      lote: async () => {
        await delay(80);
        return HttpResponse.json({
          loteId: idDe(900),
          confirmadas: [propuestaDe(R1A)],
          omitidas: [],
        });
      },
    });
    const usuario = await abrir();
    await usuario.click(botonConfirmar());
    expect(
      await screen.findByRole('button', { name: 'Confirmando…' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(casilla(/Movimiento 1,/)).toBeDisabled();
    await screen.findByText('Lote confirmado: 1 propuesta.');
  });

  it('una omitida cuyo id ya no está en la lista se nombra sin inventar datos', async () => {
    montar({
      lote: () =>
        HttpResponse.json({
          loteId: null,
          confirmadas: [],
          omitidas: [{ id: idDe(5999), razon: 'no_existe' }],
        }),
    });
    const usuario = await abrir();
    await usuario.click(botonConfirmar());
    await screen.findByText('No se confirmó ninguna propuesta.');
    expect(screen.getByText('Ya no existe.')).toBeInTheDocument();
  });
});

describe('Confirmación en lote: fallos', () => {
  it('un error del servidor no afirma que nada se aplicó y ofrece recargar', async () => {
    const pedidos = montar({
      lote: () => HttpResponse.json({ message: 'x' }, { status: 500 }),
    });
    const usuario = await abrir();
    await usuario.click(botonConfirmar());
    const alerta = await screen.findByRole('alert');
    expect(
      within(alerta).getByText('No pudimos confirmar el resultado del lote.'),
    ).toBeInTheDocument();
    expect(
      within(alerta).getByText(
        'Puede que una parte se haya aplicado. Recarga la bandeja para ver qué quedó.',
      ),
    ).toBeInTheDocument();
    // Sigue en el modo lote, con lo marcado, hasta que la persona recargue.
    expect(casilla(/Movimiento 1,/)).toBeChecked();
    const antes = pedidos.listas;
    await usuario.click(
      within(alerta).getByRole('button', { name: 'Recargar bandeja' }),
    );
    await waitFor(() => expect(pedidos.listas).toBeGreaterThan(antes));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
  });

  it('un 200 con cuerpo ilegible también pide recargar', async () => {
    montar({ lote: () => HttpResponse.json({ cualquier: 'cosa' }) });
    const usuario = await abrir();
    await usuario.click(botonConfirmar());
    expect(
      await screen.findByText('No pudimos confirmar el resultado del lote.'),
    ).toBeInTheDocument();
  });

  it('un 403 dice que no hay permiso y no ofrece recargar', async () => {
    montar({
      lote: () => HttpResponse.json({ message: 'no' }, { status: 403 }),
    });
    const usuario = await abrir();
    await usuario.click(botonConfirmar());
    const alerta = await screen.findByRole('alert');
    expect(
      within(alerta).getByText('No tienes permiso para esta acción.'),
    ).toBeInTheDocument();
    expect(within(alerta).queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Puede que una parte/)).toBeNull();
  });
});
