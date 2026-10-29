import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { contextoSesion } from '@/shared/api/contratos';
import { SessionStateProvider, type SessionState } from '@/shared/sesion';
import { crearCompuerta } from '@/test/compuerta';
import {
  CONTEXTO_SESION,
  SESION_LISTA,
  capacidadesDeRoles,
} from '@/test/fixtures';
import { clienteDePruebas } from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import {
  ID_CARGA,
  RUTA_ACEPTAR,
  RUTA_RECHAZAR,
  RUTA_VISTA_PREVIA,
  aceptarFalla,
  leerVistaPrevia,
  leerVistaPreviaFalla,
  rechazarFalla,
  rechazarResponde,
  vistaPrevia,
} from './pruebas';
import { VistaPreviaPage } from './VistaPreviaPage';

function sesion(roles: string[], capacidades?: string[]): SessionState {
  return {
    ...SESION_LISTA,
    contexto: contextoSesion.parse({
      ...CONTEXTO_SESION,
      roles,
      capacidades: capacidades ?? capacidadesDeRoles(roles),
    }),
  } as SessionState;
}

function montar(estado: SessionState = sesion(['contador'])) {
  const cliente = clienteDePruebas();
  const invalidar = vi.spyOn(cliente, 'invalidateQueries');
  const router = createMemoryRouter(
    [
      { path: '/cargas/:cargaId/vista-previa', element: <VistaPreviaPage /> },
      { path: '/cargas', element: <p>Pantalla de cargas</p> },
      { path: '/bandeja', element: <p>Pantalla de bandeja</p> },
    ],
    { initialEntries: [`/cargas/${ID_CARGA}/vista-previa`] },
  );
  render(
    <QueryClientProvider client={cliente}>
      <SessionStateProvider estado={estado}>
        <RouterProvider router={router} />
      </SessionStateProvider>
    </QueryClientProvider>,
  );
  return { router, invalidar };
}

const usuario = () => userEvent.setup();
const aceptar = () =>
  screen.getByRole('button', { name: 'Aceptar e importar' });
const rechazar = () => screen.getByRole('button', { name: 'Rechazar' });
const esperarContenido = () =>
  screen.findByRole('region', { name: 'Resumen de la lectura' });

describe('VistaPreviaPage: lectura', () => {
  it('mientras llega: esqueleto ocupado y nada que activar', async () => {
    const compuerta = crearCompuerta();
    servidor.use(
      http.get(RUTA_VISTA_PREVIA, async () => {
        await compuerta.promesa;
        return HttpResponse.json(vistaPrevia());
      }),
    );
    montar();
    const carga = await screen.findByRole('status', {
      name: 'Cargando vista previa',
    });
    expect(carga).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    compuerta.abrir();
    await esperarContenido();
    expect(
      screen.queryByRole('status', { name: 'Cargando vista previa' }),
    ).not.toBeInTheDocument();
  });

  it('normal: resumen, movimientos, acciones y enlace de regreso', async () => {
    servidor.use(
      leerVistaPrevia(
        vistaPrevia({
          movimientos: [
            {
              fecha: '2026-09-01',
              monto: '9007199254740993.12',
              referencia: null,
            },
          ],
          total: 1,
        }),
      ),
    );
    montar();
    const resumen = await esperarContenido();
    expect(resumen).toHaveTextContent('estado-sep-2026.pdf · BBVA');
    expect(screen.getByText('Pendiente de vista previa')).toBeVisible();
    expect(screen.getByText('+9,007,199,254,740,993.12')).toBeVisible();
    expect(aceptar()).toBeEnabled();
    expect(rechazar()).toBeEnabled();
    expect(
      screen.getByRole('link', { name: /Volver a Cargas/ }),
    ).toHaveAttribute('href', '/cargas');
  });

  it('sin saldos: «—» y la caja informativa', async () => {
    servidor.use(
      leerVistaPrevia(vistaPrevia({ saldoInicial: null, saldoFinal: null })),
    );
    montar();
    const resumen = await esperarContenido();
    expect(within(resumen).getAllByText('—')).toHaveLength(2);
    expect(within(resumen).getByRole('status')).toHaveTextContent(
      'no se pueden mostrar',
    );
    expect(aceptar()).toBeEnabled();
  });

  it('404: no encontrada, con salida a Cargas y sin acciones', async () => {
    servidor.use(leerVistaPreviaFalla(404));
    montar();
    expect(await screen.findByText('No encontramos esta carga.')).toBeVisible();
    expect(
      screen.getByText('Puede que no exista o que pertenezca a otra empresa.'),
    ).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /Volver a Cargas/ }).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('409: ya no está en espera, en una alerta y sin acciones', async () => {
    servidor.use(leerVistaPreviaFalla(409));
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Esta carga ya no está en espera.');
    expect(alerta).toHaveTextContent(
      'Otra persona pudo haberla aceptado o rechazado hace un momento. Revisa su estado en Cargas.',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('403 del servidor: sin permiso, nunca texto del servidor', async () => {
    servidor.use(leerVistaPreviaFalla(403));
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
    expect(alerta).not.toHaveTextContent('texto-interno-del-servidor');
  });

  it('500: error de conexión con «Reintentar» que vuelve a pedir', async () => {
    let intentos = 0;
    servidor.use(
      http.get(RUTA_VISTA_PREVIA, () => {
        intentos += 1;
        return intentos === 1
          ? HttpResponse.json(
              { statusCode: 500, error: 'Error', message: 'x' },
              { status: 500 },
            )
          : HttpResponse.json(vistaPrevia());
      }),
    );
    montar();
    await screen.findByRole('alert');
    await usuario().click(screen.getByRole('button', { name: 'Reintentar' }));
    await esperarContenido();
    expect(intentos).toBe(2);
  });

  it('sin cargas.ver (revisor): sin permiso y ni siquiera pide la carga', async () => {
    let pidio = false;
    servidor.use(
      http.get(RUTA_VISTA_PREVIA, () => {
        pidio = true;
        return HttpResponse.json(vistaPrevia());
      }),
    );
    montar(sesion(['revisor']));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tienes permiso para esta acción.',
    );
    expect(pidio).toBe(false);
  });

  it('con cargas.ver pero sin cargas.cargar: solo consulta, sin botones', async () => {
    servidor.use(leerVistaPrevia());
    montar(sesion(['revisor'], ['cargas.ver', 'bandeja.ver']));
    await esperarContenido();
    expect(screen.getByRole('status', { name: '' })).toBeDefined();
    expect(
      screen.getByText('Tu rol solo permite consultar las cargas.'),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Pide a un administrador o contador que acepte o rechace esta vista previa.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Movimientos leídos' }),
    ).toBeVisible();
  });
});

describe('VistaPreviaPage: aceptar', () => {
  it('mientras importa: botones apagados, barra y chip «Importando»; luego el banner', async () => {
    const compuerta = crearCompuerta();
    servidor.use(
      leerVistaPrevia(),
      http.post(RUTA_ACEPTAR, async ({ params }) => {
        await compuerta.promesa;
        return HttpResponse.json({
          cargaId: String(params.id),
          estado: 'procesada',
          movimientos: 14,
        });
      }),
    );
    const { invalidar } = montar();
    await esperarContenido();
    await usuario().click(aceptar());
    expect(
      await screen.findByRole('button', { name: 'Importando…' }),
    ).toBeDisabled();
    expect(rechazar()).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Importando')).toBeVisible();
    compuerta.abrir();
    const banner = await screen.findByText(
      'Importación aceptada. Los 14 movimientos entraron a conciliación.',
    );
    expect(banner).toBeVisible();
    expect(screen.getByText('Procesada')).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Resumen de la lectura' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ir a la bandeja' }),
    ).toHaveAttribute('href', '/bandeja');
    await waitFor(() =>
      expect(banner.closest('[role="status"]')).toHaveFocus(),
    );
    expect(invalidar).toHaveBeenCalled();
  });

  it('un fallo del servidor no acepta nada y deja reintentar', async () => {
    let intentos = 0;
    servidor.use(
      leerVistaPrevia(),
      http.post(RUTA_ACEPTAR, ({ params }) => {
        intentos += 1;
        return intentos === 1
          ? HttpResponse.json(
              { statusCode: 500, error: 'Error', message: 'boom' },
              { status: 500 },
            )
          : HttpResponse.json({
              cargaId: String(params.id),
              estado: 'procesada',
              movimientos: 3,
            });
      }),
    );
    montar();
    await esperarContenido();
    const u = usuario();
    await u.click(aceptar());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo completar la solicitud.');
    expect(alerta).toHaveTextContent(
      'No se aceptó nada: ningún movimiento entró a conciliación. Inténtalo de nuevo en unos minutos.',
    );
    expect(alerta).not.toHaveTextContent('boom');
    expect(aceptar()).toBeEnabled();
    expect(
      screen.getByRole('region', { name: 'Resumen de la lectura' }),
    ).toBeVisible();
    await u.click(aceptar());
    await screen.findByText(/Importación aceptada/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('409 al aceptar: ya no está en espera y se quitan las acciones', async () => {
    servidor.use(leerVistaPrevia(), aceptarFalla(409));
    montar();
    await esperarContenido();
    await usuario().click(aceptar());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta carga ya no está en espera.',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('404 al aceptar: no encontrada', async () => {
    servidor.use(leerVistaPrevia(), aceptarFalla(404));
    montar();
    await esperarContenido();
    await usuario().click(aceptar());
    expect(await screen.findByText('No encontramos esta carga.')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('403 al aceptar: sin permiso y sin acciones', async () => {
    servidor.use(leerVistaPrevia(), aceptarFalla(403));
    montar();
    await esperarContenido();
    await usuario().click(aceptar());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tienes permiso para esta acción.',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('un doble clic envía una sola petición', async () => {
    const compuerta = crearCompuerta();
    let peticiones = 0;
    servidor.use(
      leerVistaPrevia(),
      http.post(RUTA_ACEPTAR, async ({ params }) => {
        peticiones += 1;
        await compuerta.promesa;
        return HttpResponse.json({
          cargaId: String(params.id),
          estado: 'procesada',
          movimientos: 3,
        });
      }),
    );
    montar();
    await esperarContenido();
    const boton = aceptar();
    const u = usuario();
    await u.dblClick(boton);
    compuerta.abrir();
    await screen.findByText(/Importación aceptada/);
    expect(peticiones).toBe(1);
  });
});

describe('VistaPreviaPage: rechazar', () => {
  it('pide confirmación en un alertdialog que cambia las acciones por Sí/Cancelar', async () => {
    servidor.use(leerVistaPrevia());
    montar();
    await esperarContenido();
    await usuario().click(rechazar());
    const dialogo = screen.getByRole('alertdialog', {
      name: '¿Rechazar esta vista previa?',
    });
    expect(dialogo).toHaveTextContent(
      'Se descartarán los 3 movimientos leídos',
    );
    expect(
      screen.queryByRole('button', { name: 'Aceptar e importar' }),
    ).not.toBeInTheDocument();
    expect(dialogo).toHaveFocus();
  });

  it('Cancelar vuelve a las acciones, con el foco en «Rechazar», sin llamar al servidor', async () => {
    let llamadas = 0;
    servidor.use(
      leerVistaPrevia(),
      http.post(RUTA_RECHAZAR, () => {
        llamadas += 1;
        return HttpResponse.json({});
      }),
    );
    montar();
    await esperarContenido();
    const u = usuario();
    await u.click(rechazar());
    await u.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(aceptar()).toBeEnabled();
    expect(rechazar()).toHaveFocus();
    expect(llamadas).toBe(0);
  });

  it('«Sí, rechazar»: mientras rechaza chip y botones; luego banner ámbar y chip «Rechazada»', async () => {
    const compuerta = crearCompuerta();
    servidor.use(
      leerVistaPrevia(),
      http.post(RUTA_RECHAZAR, async ({ params }) => {
        await compuerta.promesa;
        return HttpResponse.json({
          cargaId: String(params.id),
          estado: 'rechazada',
        });
      }),
    );
    const { invalidar } = montar();
    await esperarContenido();
    const u = usuario();
    await u.click(rechazar());
    await u.click(screen.getByRole('button', { name: 'Sí, rechazar' }));
    expect(
      await screen.findByRole('button', { name: 'Rechazando…' }),
    ).toBeDisabled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Rechazando')).toBeVisible();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    compuerta.abrir();
    const banner = await screen.findByText('Vista previa rechazada.');
    expect(screen.getByText('Rechazada')).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Resumen de la lectura' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Ir a la bandeja' }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(banner.closest('[role="status"]')).toHaveFocus(),
    );
    expect(invalidar).toHaveBeenCalled();
  });

  it('un fallo al rechazar dice que no se rechazó nada y no se oculta el contenido', async () => {
    servidor.use(leerVistaPrevia(), rechazarFalla(500));
    montar();
    await esperarContenido();
    const u = usuario();
    await u.click(rechazar());
    await u.click(screen.getByRole('button', { name: 'Sí, rechazar' }));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(
      'No se rechazó nada: la vista previa sigue en espera. Inténtalo de nuevo en unos minutos.',
    );
    expect(aceptar()).toBeEnabled();
    expect(
      screen.getByRole('region', { name: 'Resumen de la lectura' }),
    ).toBeVisible();
  });

  it('409 al rechazar: ya no está en espera', async () => {
    servidor.use(leerVistaPrevia(), rechazarFalla(409));
    montar();
    await esperarContenido();
    const u = usuario();
    await u.click(rechazar());
    await u.click(screen.getByRole('button', { name: 'Sí, rechazar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta carga ya no está en espera.',
    );
  });

  it('el éxito de rechazar usa el endpoint de rechazar y no el de aceptar', async () => {
    let aceptadas = 0;
    servidor.use(
      leerVistaPrevia(),
      rechazarResponde(),
      http.post(RUTA_ACEPTAR, () => {
        aceptadas += 1;
        return HttpResponse.json({});
      }),
    );
    montar();
    await esperarContenido();
    const u = usuario();
    await u.click(rechazar());
    await u.click(screen.getByRole('button', { name: 'Sí, rechazar' }));
    await screen.findByText('Vista previa rechazada.');
    expect(aceptadas).toBe(0);
  });
});
