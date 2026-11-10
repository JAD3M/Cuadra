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

// Reabrir un lote completo (5.8) con los textos de los mockups 2 y 7.

const regla = (n: number) =>
  filaBandeja({
    movimientoId: idDe(n),
    estado: 'sugerencia',
    propuestasCount: 1,
    motivo: null,
    regla: 'referencia_monto_exacto',
    descripcion: `Movimiento ${n}`,
    monto: `${1000 - n}.0000`,
    mejorPropuesta: conPropuesta(n),
  });

const R1 = regla(1);
const R2 = regla(2);
const R3 = regla(3);
const FILAS = [R1, R2, R3];
const propuestaDe = (f: FilaBandeja) => f.mejorPropuesta?.conciliacionId ?? '';
const LOTE_ID = idDe(900);

function sesionDe(quitar: string[]): SessionState {
  if (SESION_LISTA.status !== 'ready') throw new Error('fixture inválida');
  return {
    ...SESION_LISTA,
    contexto: {
      ...SESION_LISTA.contexto,
      capacidades: capacidadesDeRoles(['admin', 'contador']).filter(
        (c) => !quitar.includes(c),
      ) as never,
    },
  };
}

interface Opciones {
  lote?: () => Response | Promise<Response>;
  reabrir?: () => Response | Promise<Response>;
  sinPermiso?: string[];
}

const LOTE_DOS = () =>
  HttpResponse.json({
    loteId: LOTE_ID,
    confirmadas: [propuestaDe(R1), propuestaDe(R2)],
    omitidas: [],
  });

function montar({ lote = LOTE_DOS, reabrir, sinPermiso = [] }: Opciones = {}) {
  const pedidos = {
    reaperturas: [] as Array<{ ruta: string; cuerpo: unknown }>,
    listas: 0,
  };
  servidor.use(
    http.get('/api/bandeja', () => {
      pedidos.listas += 1;
      return HttpResponse.json({
        datos: FILAS,
        pagina: 1,
        limite: 50,
        total: FILAS.length,
      });
    }),
    http.get('/api/bandeja/resumen', () =>
      HttpResponse.json({
        conteos: { conciliado: 0, sugerencia: FILAS.length, sin_match: 0 },
        montoPorRevisar: [],
        requiereRevision: 0,
      }),
    ),
    http.post('/api/conciliaciones/lotes', () => lote()),
    http.post(
      '/api/conciliaciones/lotes/:loteId/reabrir',
      async ({ request }) => {
        pedidos.reaperturas.push({
          ruta: new URL(request.url).pathname,
          cuerpo: await request.json(),
        });
        return (
          reabrir ??
          (() =>
            HttpResponse.json({
              loteId: LOTE_ID,
              reabiertas: [propuestaDe(R1), propuestaDe(R2)],
              omitidas: [],
            }))
        )();
      },
    ),
  );
  const router = createMemoryRouter(
    [{ path: '/bandeja', element: <BandejaPage /> }],
    { initialEntries: ['/bandeja'] },
  );
  render(
    <QueryClientProvider client={clienteDePruebas()}>
      <SessionStateProvider estado={sesionDe(sinPermiso)}>
        <RouterProvider router={router} />
      </SessionStateProvider>
    </QueryClientProvider>,
  );
  return pedidos;
}

/** Confirma el lote con lo marcado por defecto y espera su resultado. */
async function confirmarLote() {
  const usuario = userEvent.setup();
  await screen.findByRole('table');
  await usuario.click(
    screen.getByRole('button', { name: 'Confirmar en lote' }),
  );
  await usuario.click(
    screen.getByRole('button', { name: /^Confirmar (\d+ propuestas?)$/ }),
  );
  return usuario;
}
const botonReabrir = () => screen.getByRole('button', { name: 'Reabrir lote' });
const abrirFormulario = async (usuario: ReturnType<typeof userEvent.setup>) => {
  await screen.findByText(/^Lote confirmado/);
  await usuario.click(botonReabrir());
  return screen.getByRole('textbox', {
    name: 'Motivo de la reapertura (obligatorio)',
  });
};
const enviarReapertura = async (
  usuario: ReturnType<typeof userEvent.setup>,
  motivo = 'confirmé el lote equivocado',
) => {
  const campo = await abrirFormulario(usuario);
  await usuario.type(campo, motivo);
  const formulario = screen.getByRole('region', { name: 'Reabrir lote' });
  await usuario.click(
    within(formulario).getByRole('button', { name: 'Reabrir lote' }),
  );
};

describe('Reabrir lote: quién lo ve (S6)', () => {
  it('tras confirmar un lote ofrece «Reabrir lote» con su nota', async () => {
    montar();
    await confirmarLote();
    await screen.findByText('Lote confirmado: 2 propuestas.');
    expect(botonReabrir()).toBeInTheDocument();
    expect(
      screen.getByText(
        'Vuelve a pendiente todo lo que este lote confirmó. Queda en la bitácora.',
      ),
    ).toBeInTheDocument();
  });

  it('sin el permiso de reabrir no hay botón, pero el resultado del lote sigue igual', async () => {
    montar({ sinPermiso: ['conciliaciones.reabrir'] });
    await confirmarLote();
    await screen.findByText('Lote confirmado: 2 propuestas.');
    expect(screen.queryByRole('button', { name: 'Reabrir lote' })).toBeNull();
  });

  it('un auditor no puede confirmar un lote y por tanto no ve «Reabrir lote»', async () => {
    montar({
      sinPermiso: ['conciliaciones.resolver', 'conciliaciones.reabrir'],
    });
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: 'Reabrir lote' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Confirmar en lote' }),
    ).toBeNull();
  });

  it('sin id de lote (nada se confirmó) no hay botón', async () => {
    montar({
      lote: () =>
        HttpResponse.json({
          loteId: null,
          confirmadas: [],
          omitidas: [{ id: propuestaDe(R1), razon: 'ya_resuelta' }],
        }),
    });
    await confirmarLote();
    await screen.findByText('No se confirmó ninguna propuesta.');
    expect(screen.queryByRole('button', { name: 'Reabrir lote' })).toBeNull();
  });

  it('mantiene el resultado del lote con su lista de omitidas junto al botón', async () => {
    montar({
      lote: () =>
        HttpResponse.json({
          loteId: LOTE_ID,
          confirmadas: [propuestaDe(R1)],
          omitidas: [{ id: propuestaDe(R3), razon: 'ya_resuelta' }],
        }),
    });
    await confirmarLote();
    await screen.findByText('Lote confirmado: 1 propuesta.');
    expect(
      screen.getByText('Otra persona ya la resolvió.'),
    ).toBeInTheDocument();
    expect(botonReabrir()).toBeInTheDocument();
  });
});

describe('Reabrir lote: el formulario (S6)', () => {
  it('abre el motivo con su contador y su nota, y «Cancelar» lo cierra sin enviar', async () => {
    const pedidos = montar();
    const usuario = await confirmarLote();
    await abrirFormulario(usuario);
    expect(screen.getByText('0 / 500')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Se reabre todo o nada, y cada caso queda en la bitácora con tu nombre y el motivo.',
      ),
    ).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(pedidos.reaperturas).toEqual([]);
  });

  it('sin motivo no envía nada y marca el campo como inválido', async () => {
    const pedidos = montar();
    const usuario = await confirmarLote();
    const campo = await abrirFormulario(usuario);
    const formulario = screen.getByRole('region', { name: 'Reabrir lote' });
    await usuario.click(
      within(formulario).getByRole('button', { name: 'Reabrir lote' }),
    );
    expect(
      screen.getByText('El motivo es obligatorio para reabrir.'),
    ).toBeInTheDocument();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(pedidos.reaperturas).toEqual([]);
  });
});

describe('Reabrir lote: enviar (S2, S6)', () => {
  it('guarda el id del lote y manda el motivo recortado a su ruta', async () => {
    const pedidos = montar();
    const usuario = await confirmarLote();
    await enviarReapertura(usuario, '  confirmé el lote equivocado ');
    await screen.findByText('Lote reabierto: 2 casos.');
    expect(pedidos.reaperturas).toEqual([
      {
        ruta: `/api/conciliaciones/lotes/${LOTE_ID}/reabrir`,
        cuerpo: { motivo: 'confirmé el lote equivocado' },
      },
    ]);
  });

  it('reemplaza el resultado por «Lote reabierto» y vuelve a pedir la bandeja', async () => {
    const pedidos = montar();
    const usuario = await confirmarLote();
    await screen.findByText('Lote confirmado: 2 propuestas.');
    const antes = pedidos.listas;
    await enviarReapertura(usuario);
    await screen.findByText('Lote reabierto: 2 casos.');
    expect(screen.queryByText(/Lote confirmado/)).toBeNull();
    expect(
      screen.getByText(
        'Los casos reabiertos volvieron a la bandeja como pendientes.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reabrir lote' })).toBeNull();
    await waitFor(() => expect(pedidos.listas).toBeGreaterThan(antes));
  });

  it('con un solo caso dice «1 caso» y lista las omitidas con su razón', async () => {
    montar({
      reabrir: () =>
        HttpResponse.json({
          loteId: LOTE_ID,
          reabiertas: [propuestaDe(R1)],
          omitidas: [
            { id: propuestaDe(R2), razon: 'ya_reabierta' },
            { id: propuestaDe(R3), razon: 'reconfirmada' },
          ],
        }),
    });
    const usuario = await confirmarLote();
    await enviarReapertura(usuario);
    await screen.findByText('Lote reabierto: 1 caso.');
    expect(
      screen.getByText(
        '2 se omitieron porque ya no estaban confirmadas. Los casos reabiertos volvieron a la bandeja como pendientes.',
      ),
    ).toBeInTheDocument();
    const lista = screen.getByRole('list');
    expect(within(lista).getByText('Ya estaba reabierta.')).toBeInTheDocument();
    expect(
      within(lista).getByText('Se volvió a confirmar: reábrela desde su caso.'),
    ).toBeInTheDocument();
    expect(within(lista).getByText(/Movimiento 2/)).toBeInTheDocument();
  });

  it('si nada se reabrió no dice «Lote reabierto» y explica por qué', async () => {
    montar({
      reabrir: () =>
        HttpResponse.json({
          loteId: LOTE_ID,
          reabiertas: [],
          omitidas: [
            { id: propuestaDe(R1), razon: 'no_confirmada' },
            { id: propuestaDe(R2), razon: 'ya_reabierta' },
          ],
        }),
    });
    const usuario = await confirmarLote();
    await enviarReapertura(usuario);
    await screen.findByText('No se reabrió ningún caso.');
    expect(screen.queryByText(/Lote reabierto/)).toBeNull();
    expect(
      screen.getByText('Las 2 se omitieron porque ya no estaban confirmadas.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Ya no está confirmada.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('mientras envía bloquea el formulario', async () => {
    montar({
      reabrir: async () => {
        await delay(60);
        return HttpResponse.json({
          loteId: LOTE_ID,
          reabiertas: [],
          omitidas: [],
        });
      },
    });
    const usuario = await confirmarLote();
    await enviarReapertura(usuario);
    expect(screen.getByRole('button', { name: 'Reabriendo…' })).toBeDisabled();
    expect(screen.getByRole('textbox')).toBeDisabled();
    await screen.findByText('No se reabrió ningún caso.');
  });
});

describe('Reabrir lote: fallos (S5)', () => {
  it('un 409 dice que no se reabrió ningún caso y ofrece recargar', async () => {
    const pedidos = montar({
      reabrir: () => HttpResponse.json({ message: 'x' }, { status: 409 }),
    });
    const usuario = await confirmarLote();
    await enviarReapertura(usuario);
    const alerta = await screen.findByRole('alert');
    expect(
      within(alerta).getByText('No se reabrió ningún caso.'),
    ).toBeInTheDocument();
    expect(
      within(alerta).getByText(
        'El lote cambió mientras se reabría. Recarga la bandeja y vuelve a intentarlo.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Lote reabierto/)).toBeNull();
    const antes = pedidos.listas;
    await usuario.click(
      within(alerta).getByRole('button', { name: 'Recargar bandeja' }),
    );
    await waitFor(() => expect(pedidos.listas).toBeGreaterThan(antes));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un 403 dice quién puede reabrir y no ofrece recargar', async () => {
    montar({
      reabrir: () => HttpResponse.json({ message: 'no' }, { status: 403 }),
    });
    const usuario = await confirmarLote();
    await enviarReapertura(usuario);
    const alerta = await screen.findByRole('alert');
    expect(
      within(alerta).getByText(
        'Solo quien confirmó el lote o un administrador puede reabrirlo.',
      ),
    ).toBeInTheDocument();
    expect(within(alerta).queryByRole('button')).toBeNull();
  });

  it('un error de servidor no afirma nada y pide recargar, como el lote', async () => {
    montar({
      reabrir: () => HttpResponse.json({ message: 'x' }, { status: 500 }),
    });
    const usuario = await confirmarLote();
    await enviarReapertura(usuario);
    const alerta = await screen.findByRole('alert');
    expect(
      within(alerta).getByText('No pudimos confirmar el resultado del lote.'),
    ).toBeInTheDocument();
    expect(
      within(alerta).getByRole('button', { name: 'Recargar bandeja' }),
    ).toBeInTheDocument();
  });
});
