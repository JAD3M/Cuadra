import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AVISOS } from '@/features/auth/components/textos';
import type { FilaBandeja, RespuestaCaso } from '@/shared/api/contratos';
import { EMPRESAS_DISPONIBLES } from '@/test/fixtures';
import {
  casoConciliado,
  casoDeFila,
  casoVarias,
  propuestaCaso,
} from '@/test/fixturesCaso';
import { FILAS_DEMO, idDe } from '@/test/fixturesBandeja';
import { almacenes } from '@/test/handlers';
import { contextoPorToken, espiarSolicitudes } from '@/test/handlersAuth';
import { resolverFalla } from '@/test/handlersCaso';
import {
  elegirEmpresaPorNombre,
  entrarALaApp,
  montarApp,
} from '@/test/montarApp';
import { servidor } from '@/test/servidor';

// Montar la app completa y teclear el login tarda más que una pantalla suelta.
beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

let espia: ReturnType<typeof espiarSolicitudes> | null = null;
const cuerpos: Promise<{ ruta: string; cuerpo: string }>[] = [];
const oyenteCuerpos = ({ request }: { request: Request }) => {
  if (
    request.method === 'POST' &&
    new URL(request.url).pathname.startsWith('/api/conciliaciones/')
  ) {
    cuerpos.push(
      request
        .clone()
        .text()
        .then((cuerpo) => ({ ruta: new URL(request.url).pathname, cuerpo })),
    );
  }
};

afterEach(() => {
  espia?.detener();
  espia = null;
  servidor.events.removeListener('request:start', oyenteCuerpos);
  cuerpos.length = 0;
});

const CONFIRMADA =
  'Conciliación confirmada. El movimiento y el CFDI quedan cerrados.';
const RECHAZADA = 'Propuesta rechazada.';

/** La primera fila por revisar de la bandeja (la que abre el primer enlace). */
const PRIMERA: FilaBandeja = FILAS_DEMO.find((f) => f.estado === 'sugerencia')!;

/** Fila de la bandeja con su caso fijado a tres propuestas. */
function variasEnFila(fila: FilaBandeja): RespuestaCaso {
  const base = casoDeFila(fila);
  const caso = casoVarias({ movimiento: base.movimiento });
  almacenes.caso.establecer([caso]);
  return caso;
}

const confirmar = (cfdi: string) =>
  screen.getByRole('button', { name: `Confirmar conciliación ${cfdi}` });
const rechazar = (cfdi: string) =>
  screen.getByRole('button', { name: `Rechazar ${cfdi}` });
const contador = (n: number) =>
  screen.getByRole('link', {
    name: n === 1 ? 'Bandeja 1 pendiente' : `Bandeja ${n} pendientes`,
  });

/** Entra a la app directo en un caso y espera a verlo. */
async function abrirCaso(fila: FilaBandeja) {
  const montaje = montarApp(`/casos/${encodeURIComponent(fila.movimientoId)}`);
  await entrarALaApp();
  await screen.findByRole('heading', { level: 2, name: 'Tu decisión' });
  return montaje;
}

describe('flujos del detalle del caso', () => {
  it('login, bandeja, enlace de la fila, confirmar: banner, solo lectura y bandeja y contador al día con una sola solicitud más', async () => {
    espia = espiarSolicitudes();
    const { router } = montarApp('/bandeja');
    await entrarALaApp();
    await screen.findByRole('table');
    expect(contador(39)).toBeInTheDocument();

    const enlace = within(screen.getByRole('table')).getAllByRole('link')[0];
    const href = enlace?.getAttribute('href') ?? '';
    expect(href).toBe(`/casos/${encodeURIComponent(PRIMERA.movimientoId)}`);
    await userEvent.setup().click(enlace!);
    await screen.findByRole('heading', { level: 2, name: 'Tu decisión' });
    expect(router.state.location.pathname).toBe(href);

    const antes = espia.cuantas('GET', '/api/bandeja/resumen');
    await userEvent.setup().click(confirmar('A-1001'));
    await screen.findByText(CONFIRMADA);
    await screen.findByRole('link', { name: 'Bandeja 38 pendientes' });

    // Solo lectura y sin navegar.
    expect(screen.queryByRole('heading', { name: 'Tu decisión' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Confirmar|Rechazar/ }),
    ).toBeNull();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Conciliado' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Confirmado por Jorge Tapia el 2026-10-05.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(href);
    // El contador comparte la clave del resumen: una sola solicitud más.
    expect(espia.cuantas('GET', '/api/bandeja/resumen') - antes).toBe(1);

    // De vuelta en la bandeja la fila ya no está entre las por revisar.
    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: '← Volver a la bandeja' }));
    await screen.findByRole('table');
    expect(screen.queryByText(PRIMERA.descripcion)).toBeNull();
    expect(contador(38)).toBeInTheDocument();
  });

  it('rechazar sin motivo con propuestas restantes: banner, la rechazada se va y las demás conservan los controles', async () => {
    const caso = variasEnFila(PRIMERA);
    servidor.events.on('request:start', oyenteCuerpos);
    await abrirCaso(PRIMERA);
    await userEvent.setup().click(rechazar('A-1001'));
    await screen.findByText(RECHAZADA);
    expect(
      screen.getByText('Quedan 2 propuestas vigentes para este movimiento.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ver propuesta A-1001' }),
    ).toBeNull();
    expect(confirmar('A-1002')).toBeEnabled();
    const [post] = await Promise.all(cuerpos);
    expect(post?.ruta).toBe(
      `/api/conciliaciones/${caso.propuestas[0]!.conciliacionId}/rechazar`,
    );
    expect(JSON.parse(post?.cuerpo ?? '')).toEqual({});
  });

  it('rechazar con motivo la última propuesta: sin match con banner, historial de la rechazada y el contador sin cambio', async () => {
    servidor.events.on('request:start', oyenteCuerpos);
    await abrirCaso(PRIMERA);
    const usuario = userEvent.setup();
    await usuario.type(
      screen.getByLabelText('Motivo del rechazo (opcional)'),
      '  Monto no corresponde  ',
    );
    await usuario.click(rechazar('A-1001'));
    await screen.findByText(RECHAZADA);
    expect(
      screen.getByText('El movimiento vuelve a sin match.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Sin match').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Tu decisión' })).toBeNull();
    // B5: el historial es el de la propuesta rechazada.
    await screen.findByText('Rechazada');
    const [post] = await Promise.all(cuerpos);
    expect(JSON.parse(post?.cuerpo ?? '')).toEqual({
      motivo: 'Monto no corresponde',
    });
    // Sugerencia y sin match cuentan como pendientes: el contador sigue igual.
    expect(contador(39)).toBeInTheDocument();
  });

  it('409 y «Recargar caso»: sin recarga sola, y al hacer clic se ve el estado que dejó la otra persona', async () => {
    espia = espiarSolicitudes();
    const caso = variasEnFila(PRIMERA);
    await abrirCaso(PRIMERA);
    servidor.use(resolverFalla(409));
    await userEvent.setup().click(confirmar('A-1001'));
    await screen.findByText('Este caso ya cambió.');
    const rutaCaso = `/api/casos/${caso.movimiento.id}`;
    const antes = espia.cuantas('GET', rutaCaso);
    await new Promise((r) => setTimeout(r, 150));
    expect(espia.cuantas('GET', rutaCaso)).toBe(antes);

    // Otra persona confirmó la primera propuesta mientras tanto.
    almacenes.caso.establecer([
      casoConciliado({
        movimiento: caso.movimiento,
        propuestas: [
          propuestaCaso(1, {
            estado: 'confirmada',
            confirmadaAt: '2026-10-05T10:00:00.000Z',
            confirmadaPor: { nombre: 'Ana' },
          }),
        ],
      }),
    ]);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Recargar caso' }));
    await screen.findByText(/Confirmado por Ana/);
    expect(espia.cuantas('GET', rutaCaso)).toBe(antes + 1);
    expect(screen.queryByText('Este caso ya cambió.')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Tu decisión' })).toBeNull();
  });

  it('D-08: un 403 al confirmar muestra el aviso aprobado sin el código y el caso sigue sugerencia; otra persona confirma sin problema', async () => {
    await abrirCaso(PRIMERA);
    servidor.use(resolverFalla(403));
    const usuario = userEvent.setup();
    await usuario.click(confirmar('A-1001'));
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No puedes confirmar este caso.');
    expect(alerta).toHaveTextContent(
      'Quien subió el CFDI o el estado de cuenta no puede confirmarlo. Pide a otra persona de la empresa que lo revise.',
    );
    expect(document.body).not.toHaveTextContent('acceso_denegado');
    expect(document.body).not.toHaveTextContent('detalle del servidor');
    expect(screen.getByText('Sugerencia')).toBeInTheDocument();
    expect(confirmar('A-1001')).toBeEnabled();

    // El cliente no lleva ninguna regla por persona: con otra sesión el mismo
    // servidor acepta la misma acción.
    servidor.resetHandlers();
    await usuario.click(confirmar('A-1001'));
    await screen.findByText(CONFIRMADA);
  });

  it('cambiar de empresa con un POST en vuelo: nada del caso de A se ve ni se escribe en la nueva época', async () => {
    const idB = EMPRESAS_DISPONIBLES[1]!.id;
    contextoPorToken(idB);
    servidor.use(
      http.post('/api/conciliaciones/:id/:accion', async () => {
        await delay(200);
        return HttpResponse.json({
          id: idDe(5001),
          estado: 'confirmada',
          cfdiId: idDe(7001),
          movimientoId: PRIMERA.movimientoId,
          motivo: null,
          confirmadaAt: '2026-10-05T10:00:00.000Z',
          rechazadasAutomaticamente: [],
        });
      }),
    );
    espia = espiarSolicitudes();
    const { router } = await abrirCaso(PRIMERA);
    const usuario = userEvent.setup();
    await usuario.click(confirmar('A-1001'));
    await screen.findByText('Confirmando…');
    await usuario.click(
      screen.getByRole('button', { name: /Cambiar de empresa/ }),
    );
    await elegirEmpresaPorNombre(/Abarrotes/);
    // El cambio de empresa lleva a la bandeja de la nueva época.
    await screen.findByRole('table');
    expect(router.state.location.pathname).toBe('/bandeja');
    // Deja que el POST de la empresa A termine mucho después del cambio.
    await new Promise((r) => setTimeout(r, 400));

    expect(screen.queryByText(CONFIRMADA)).toBeNull();
    expect(screen.queryByText('Confirmando…')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Tu decisión' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    // Lo escrito por la mutación vieja no invalidó nada de la época nueva: la
    // bandeja y el contador se pidieron una vez, y el caso nunca.
    const deLaNueva = espia.solicitudes.filter((s) =>
      (s.autorizacion ?? '').endsWith(idB),
    );
    expect(deLaNueva.filter((s) => s.ruta === '/api/bandeja')).toHaveLength(1);
    expect(
      deLaNueva.filter((s) => s.ruta === '/api/bandeja/resumen'),
    ).toHaveLength(1);
    expect(
      deLaNueva.filter((s) => s.ruta.startsWith('/api/casos/')),
    ).toHaveLength(0);
  });

  it('cerrar sesión con un POST en vuelo: no se escribe nada ni se toca la pantalla de acceso', async () => {
    servidor.use(
      http.post('/api/conciliaciones/:id/:accion', async () => {
        await delay(200);
        return HttpResponse.json({
          id: idDe(5001),
          estado: 'confirmada',
          cfdiId: idDe(7001),
          movimientoId: PRIMERA.movimientoId,
          motivo: null,
          confirmadaAt: '2026-10-05T10:00:00.000Z',
          rechazadasAutomaticamente: [],
        });
      }),
    );
    espia = espiarSolicitudes();
    await abrirCaso(PRIMERA);
    const usuario = userEvent.setup();
    await usuario.click(confirmar('A-1001'));
    await screen.findByText('Confirmando…');
    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await screen.findByText(AVISOS.cierre_voluntario);
    const hasta = espia.solicitudes.length;
    await new Promise((r) => setTimeout(r, 400));

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByText(CONFIRMADA)).toBeNull();
    expect(screen.getByText(AVISOS.cierre_voluntario)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    // Tras cerrar sesión no sale ninguna lectura de bandeja ni de caso.
    expect(
      espia.solicitudes
        .slice(hasta)
        .filter((s) => /^\/api\/(bandeja|casos|conciliaciones)/.test(s.ruta)),
    ).toEqual([]);
  });

  it('sin pendientes tras confirmar la última, el contador desaparece', async () => {
    almacenes.bandeja.establecer([PRIMERA]);
    await abrirCaso(PRIMERA);
    expect(contador(1)).toBeInTheDocument();
    await userEvent.setup().click(confirmar('A-1001'));
    await screen.findByText(CONFIRMADA);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Bandeja' })).toBeInTheDocument(),
    );
  });

  it('Bandeja sigue como actual en /casos/abc, incluso cuando el id no existe', async () => {
    montarApp('/casos/abc');
    await entrarALaApp();
    await screen.findByText('No encontramos este caso.');
    expect(screen.getByRole('link', { name: /^Bandeja/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
