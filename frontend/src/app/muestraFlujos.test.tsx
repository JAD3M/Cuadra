import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONTEXTO_SESION, capacidadesDeRoles } from '@/test/fixtures';
import { almacenes } from '@/test/handlers';
import { casoMuestra, conAvance } from '@/test/handlersMuestra';
import { elegirEmpresaMock, hayEmpresaElegida } from '@/test/sesionMock';
import { entrarALaApp, montarApp } from '@/test/montarApp';
import { servidor } from '@/test/servidor';

beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

/** La sesión entrega estos roles y las capacidades que el servidor derivaría. */
function conRoles(roles: string[]) {
  const contexto = () => ({
    ...CONTEXTO_SESION,
    roles,
    capacidades: capacidadesDeRoles(roles),
  });
  servidor.use(
    http.post('/api/auth/empresa/:id', ({ params }) => {
      elegirEmpresaMock(String(params.id));
      return HttpResponse.json(contexto());
    }),
    http.get('/api/auth/contexto', () =>
      hayEmpresaElegida()
        ? HttpResponse.json(contexto())
        : HttpResponse.json(
            { statusCode: 401, error: 'Unauthorized', message: 'x' },
            { status: 401 },
          ),
    ),
  );
}

const menu = () => screen.getByRole('navigation');
const muestra = almacenes.muestra;

function fijar(
  casos = [casoMuestra(1), casoMuestra(2), casoMuestra(3)],
  extra = {},
) {
  muestra.establecer([
    conAvance({
      mes: '2026-09',
      meses: ['2026-09', '2026-08'],
      sinRevisor: false,
      puedeVerificar: true,
      casos,
      ...extra,
    }),
  ]);
}

const botonConforme = () => screen.queryByRole('button', { name: 'Conforme' });
const botonMal = () => screen.queryByRole('button', { name: 'En desacuerdo' });
const detalle = () => screen.getByRole('region', { name: /^Caso \d+ de \d+$/ });
const avance = () => screen.getByRole('region', { name: 'Avance' });

async function abrir(ruta = '/muestra') {
  montarApp(ruta);
  await entrarALaApp();
  return userEvent.setup();
}

describe('flujos de la muestra de verificación (historia 9.4)', () => {
  it('el menú trae «Muestra» justo después de Bandeja y lleva a la pantalla', async () => {
    fijar();
    montarApp('/bandeja');
    await entrarALaApp();
    const etiquetas = within(menu())
      .getAllByRole('link')
      .map((l) => l.textContent?.trim());
    expect(etiquetas.indexOf('Muestra')).toBe(etiquetas.indexOf('Bandeja') + 1);
    await userEvent
      .setup()
      .click(within(menu()).getByRole('link', { name: 'Muestra' }));
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Muestra de verificación',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/propuestas de la regla 1 confirmadas en lote$/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe('Muestra de verificación · Cuadra'),
    );
    expect(
      within(menu()).getByRole('link', { name: 'Muestra' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('muestra el avance, la lista y el primer caso pendiente con sus datos', async () => {
    fijar();
    await abrir();
    expect(
      await screen.findByRole('heading', { name: 'Caso 1 de 3' }),
    ).toBeInTheDocument();
    const barra = within(avance()).getByRole('progressbar', {
      name: 'Casos verificados',
    });
    expect(barra).toHaveAttribute('aria-valuenow', '0');
    expect(barra).toHaveAttribute('aria-valuemax', '3');
    expect(within(avance()).getByText('0 de 3')).toBeInTheDocument();
    const d = detalle();
    expect(within(d).getByText('SPEI MATERIALES REYES 1')).toBeInTheDocument();
    expect(within(d).getByText('$18,560.40')).toBeInTheDocument();
    expect(within(d).getByText('$18,560.00')).toBeInTheDocument();
    expect(
      within(d).getByText('Regla 1 · referencia y monto'),
    ).toBeInTheDocument();
    expect(
      within(d).getByText('La referencia A-101 coincide con el CFDI.'),
    ).toBeInTheDocument();
    expect(within(d).getByText('Marta Salas')).toBeInTheDocument();
    expect(botonConforme()).toBeEnabled();
    expect(botonMal()).toBeEnabled();
  });

  it('un monto enorme se muestra exacto, sin pasar por flotante', async () => {
    fijar([casoMuestra(1, { monto: '9007199254740993.1000' })]);
    await abrir();
    expect(
      await within(
        await screen.findByRole('region', { name: /^Caso \d+ de \d+$/ }),
      ).findByText('$9,007,199,254,740,993.10'),
    ).toBeInTheDocument();
  });

  it('un caso con varios CFDI los lista todos', async () => {
    const cfdi = (id: string, folio: string, total: string) => ({
      id,
      uuidFiscal: `uuid-${id}`,
      serie: null,
      folio,
      nombreEmisor: `Emisor ${id}`,
      nombreReceptor: null,
      total,
      moneda: 'MXN',
    });
    fijar([
      casoMuestra(1, {
        cfdis: [cfdi('x', '7', '100.0000'), cfdi('y', '8', '200.5000')],
      }),
    ]);
    await abrir();
    const d = await screen.findByRole('region', { name: /^Caso \d+ de \d+$/ });
    expect(within(d).getByText('Emisor x')).toBeInTheDocument();
    expect(within(d).getByText('Emisor y')).toBeInTheDocument();
    expect(within(d).getByText('$100.00')).toBeInTheDocument();
    expect(within(d).getByText('$200.50')).toBeInTheDocument();
  });

  it('marcar conforme manda el POST, actualiza el avance, la lista y el historial', async () => {
    fijar();
    const usuario = await abrir();
    await screen.findByRole('heading', { name: 'Caso 1 de 3' });
    await usuario.click(botonConforme()!);
    expect(await screen.findByText('Marcado conforme')).toBeInTheDocument();
    expect(muestra.posts).toEqual([
      { decisionId: 'dec-1', cuerpo: { resultado: 'conforme' } },
    ]);
    await waitFor(() =>
      expect(within(avance()).getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '1',
      ),
    );
    expect(within(avance()).getByText('1 de 3')).toBeInTheDocument();
    const conformes = within(avance()).getByText('Conformes').parentElement!;
    expect(within(conformes).getByText('1')).toBeInTheDocument();
    expect(botonConforme()).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Cambiar marca' }),
    ).toBeInTheDocument();
    const historial = screen.getByRole('list', { name: 'Marcas de este caso' });
    expect(within(historial).getByText('Jorge Tapia')).toBeInTheDocument();
    expect(within(historial).getByText(/conforme/)).toBeInTheDocument();
    const fila = within(
      screen.getByRole('list', { name: 'Casos de la muestra' }),
    ).getAllByRole('button')[0]!;
    expect(fila).toHaveTextContent('Conforme');
  });

  it('en desacuerdo ofrece el enlace al detalle y no reabre nada', async () => {
    fijar();
    let reaperturas = 0;
    servidor.use(
      http.post('/api/conciliaciones/:id/reabrir', () => {
        reaperturas++;
        return HttpResponse.json({});
      }),
    );
    const usuario = await abrir();
    await screen.findByRole('heading', { name: 'Caso 1 de 3' });
    await usuario.click(botonMal()!);
    expect(
      await screen.findByText('Marcado en desacuerdo'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Esto no reabre nada por sí solo: la confirmación sigue vigente.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'Abrir el detalle del caso para reabrir la confirmación →',
      }),
    ).toHaveAttribute('href', '/casos/mov-1');
    expect(muestra.posts).toEqual([
      { decisionId: 'dec-1', cuerpo: { resultado: 'desacuerdo' } },
    ]);
    expect(reaperturas).toBe(0);
    await waitFor(() =>
      expect(
        within(avance()).getByText('En desacuerdo').parentElement,
      ).toHaveTextContent('1'),
    );
  });

  it('«Cambiar marca» vuelve a ofrecer los botones y la última marca vale', async () => {
    fijar();
    const usuario = await abrir();
    await screen.findByRole('heading', { name: 'Caso 1 de 3' });
    await usuario.click(botonConforme()!);
    await usuario.click(
      await screen.findByRole('button', { name: 'Cambiar marca' }),
    );
    await usuario.click(botonMal()!);
    expect(
      await screen.findByText('Marcado en desacuerdo'),
    ).toBeInTheDocument();
    expect(muestra.posts.map((p) => p.cuerpo)).toEqual([
      { resultado: 'conforme' },
      { resultado: 'desacuerdo' },
    ]);
    const historial = screen.getByRole('list', { name: 'Marcas de este caso' });
    expect(within(historial).getAllByRole('listitem')).toHaveLength(2);
  });

  it('con todo verificado avisa que la muestra está completa', async () => {
    fijar([
      casoMuestra(1, {
        marca: 'conforme',
        marcadaPor: 'Luis',
        marcadaAt: '2026-11-22T16:42:00.000Z',
        marcas: [
          {
            quien: 'Luis',
            resultado: 'conforme',
            cuando: '2026-11-22T16:42:00.000Z',
          },
        ],
      }),
    ]);
    await abrir();
    expect(
      await screen.findByText(
        /Verificaste todos los casos de septiembre 2026\./,
      ),
    ).toBeInTheDocument();
  });

  it('el auditor ve la muestra sin botones y con el texto de solo lectura', async () => {
    conRoles(['auditor']);
    fijar([casoMuestra(1, { puedeMarcar: false })], { puedeVerificar: false });
    await abrir();
    await screen.findByRole('heading', { name: 'Caso 1 de 1' });
    expect(screen.getByText('Solo consulta')).toBeInTheDocument();
    expect(botonConforme()).toBeNull();
    expect(botonMal()).toBeNull();
    expect(
      screen.getByText(
        'Sin marcar todavía. Con el rol Auditor puedes ver este caso, pero no marcarlo.',
      ),
    ).toBeInTheDocument();
  });

  it('el auditor ve las marcas ya hechas, sin «Cambiar marca»', async () => {
    conRoles(['auditor']);
    fijar(
      [
        casoMuestra(1, {
          puedeMarcar: false,
          marca: 'desacuerdo',
          marcadaPor: 'Luis',
          marcadaAt: '2026-11-22T16:42:00.000Z',
          marcas: [
            {
              quien: 'Luis',
              resultado: 'desacuerdo',
              cuando: '2026-11-22T16:42:00.000Z',
            },
          ],
        }),
      ],
      { puedeVerificar: false },
    );
    await abrir();
    expect(
      await screen.findByText('Marcado en desacuerdo'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cambiar marca' })).toBeNull();
    expect(
      screen.getByRole('list', { name: 'Marcas de este caso' }),
    ).toHaveTextContent('Luis');
  });

  it('sin revisor, la administración ve el aviso y puede marcar', async () => {
    fijar(undefined, { sinRevisor: true });
    await abrir();
    expect(
      await screen.findByText('Tu empresa no tiene a nadie con el rol Revisor'),
    ).toBeInTheDocument();
    expect(botonConforme()).toBeEnabled();
    expect(screen.queryByText('Solo consulta')).toBeNull();
  });

  it('quien confirmó el lote lo ve bloqueado con el aviso ámbar', async () => {
    fijar([
      casoMuestra(1, {
        confirmadaPor: 'Marta Salas',
        confirmadaPorMi: true,
        puedeMarcar: false,
      }),
    ]);
    await abrir();
    expect(
      await screen.findByText('Tú confirmaste este lote'),
    ).toBeInTheDocument();
    expect(botonConforme()).toBeDisabled();
    expect(botonMal()).toBeDisabled();
    expect(within(detalle()).getByText('ti')).toBeInTheDocument();
  });

  it('un caso bloqueado de otra persona deja los botones apagados sin el aviso propio', async () => {
    fijar([casoMuestra(1, { puedeMarcar: false })]);
    await abrir();
    await screen.findByRole('heading', { name: 'Caso 1 de 1' });
    expect(botonConforme()).toBeDisabled();
    expect(screen.queryByText('Tú confirmaste este lote')).toBeNull();
  });

  it('un caso reabierto no se marca: sin botones y con una sola línea', async () => {
    fijar([casoMuestra(1, { reabierta: true, puedeMarcar: false })]);
    await abrir();
    expect(
      await screen.findByText('Este caso ya fue reabierto; ya no se marca.'),
    ).toBeInTheDocument();
    expect(botonConforme()).toBeNull();
    expect(botonMal()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cambiar marca' })).toBeNull();
  });

  it('un mes sin muestra dice que no falta nada por verificar', async () => {
    muestra.establecer([]);
    await abrir();
    expect(
      await screen.findByText('No hay muestra de este mes'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('cambiar de mes pide ese mes y muestra su muestra', async () => {
    muestra.establecer([
      conAvance({
        mes: '2026-09',
        meses: ['2026-09', '2026-08'],
        sinRevisor: false,
        puedeVerificar: true,
        casos: [casoMuestra(1)],
      }),
      conAvance({
        mes: '2026-08',
        meses: ['2026-09', '2026-08'],
        sinRevisor: false,
        puedeVerificar: true,
        casos: [casoMuestra(7), casoMuestra(8)],
      }),
    ]);
    const usuario = await abrir();
    await screen.findByRole('heading', { name: 'Caso 1 de 1' });
    const selector = screen.getByRole('combobox', { name: 'Mes' });
    expect(
      within(selector)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['septiembre 2026', 'agosto 2026']);
    await usuario.selectOptions(selector, 'agosto 2026');
    expect(
      await screen.findByRole('heading', { name: 'Caso 1 de 2' }),
    ).toBeInTheDocument();
    expect(muestra.lecturas).toEqual([null, '2026-08']);
    expect(
      within(detalle()).getByText('SPEI MATERIALES REYES 7'),
    ).toBeInTheDocument();
  });

  it('si falla ofrece Reintentar y al reintentar muestra la muestra', async () => {
    fijar();
    let falla = true;
    servidor.use(
      http.get('/api/muestra', () =>
        falla
          ? HttpResponse.json(
              { statusCode: 500, message: 'x' },
              { status: 500 },
            )
          : HttpResponse.json(almacenesLectura()),
      ),
    );
    function almacenesLectura() {
      return conAvance({
        mes: '2026-09',
        meses: ['2026-09'],
        sinRevisor: false,
        puedeVerificar: true,
        casos: [casoMuestra(1)],
      });
    }
    await abrir();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    falla = false;
    await userEvent
      .setup()
      .click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByRole('heading', { name: 'Caso 1 de 1' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un 403 al marcar dice que no puede y no cambia nada', async () => {
    fijar();
    muestra.opciones({ estado: 403 });
    const usuario = await abrir();
    await screen.findByRole('heading', { name: 'Caso 1 de 3' });
    await usuario.click(botonConforme()!);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No puedes marcar este caso.',
    );
    expect(within(avance()).getByText('0 de 3')).toBeInTheDocument();
  });

  it('un 409 al marcar dice que el caso fue reabierto', async () => {
    fijar();
    muestra.opciones({ estado: 409 });
    const usuario = await abrir();
    await screen.findByRole('heading', { name: 'Caso 1 de 3' });
    await usuario.click(botonMal()!);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este caso ya fue reabierto; ya no se marca.',
    );
  });

  it('los filtros acotan la lista y marcan cuál está activo', async () => {
    fijar([
      casoMuestra(1, { marca: 'conforme' }),
      casoMuestra(2, { marca: 'desacuerdo' }),
      casoMuestra(3),
    ]);
    const usuario = await abrir();
    await screen.findByRole('heading', { name: 'Caso 3 de 3' });
    const lista = () =>
      within(screen.getByRole('list', { name: 'Casos de la muestra' }));
    expect(lista().getAllByRole('listitem')).toHaveLength(3);
    const todos = screen.getByRole('button', { name: /^Todos/ });
    expect(todos).toHaveAttribute('aria-pressed', 'true');
    await usuario.click(screen.getByRole('button', { name: /^Pendientes/ }));
    expect(screen.getByRole('button', { name: /^Pendientes/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(todos).toHaveAttribute('aria-pressed', 'false');
    expect(lista().getAllByRole('listitem')).toHaveLength(1);
    await usuario.click(
      screen.getByRole('button', { name: /^En desacuerdo \d/ }),
    );
    const items = lista().getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('SPEI MATERIALES REYES 2');
  });

  it('Anterior y Siguiente recorren los casos y se detienen en los extremos', async () => {
    fijar([casoMuestra(1), casoMuestra(2), casoMuestra(3)]);
    const usuario = await abrir();
    await screen.findByRole('heading', { name: 'Caso 1 de 3' });
    const anterior = screen.getByRole('button', { name: 'Caso anterior' });
    const siguiente = screen.getByRole('button', { name: 'Caso siguiente' });
    expect(anterior).toBeDisabled();
    await usuario.click(siguiente);
    expect(
      screen.getByRole('heading', { name: 'Caso 2 de 3' }),
    ).toBeInTheDocument();
    expect(
      within(detalle()).getByText('SPEI MATERIALES REYES 2'),
    ).toBeInTheDocument();
    await usuario.click(siguiente);
    expect(
      screen.getByRole('heading', { name: 'Caso 3 de 3' }),
    ).toBeInTheDocument();
    expect(siguiente).toBeDisabled();
    await usuario.click(anterior);
    expect(
      screen.getByRole('heading', { name: 'Caso 2 de 3' }),
    ).toBeInTheDocument();
  });

  it('elegir una fila de la lista abre ese caso', async () => {
    fijar();
    const usuario = await abrir();
    await screen.findByRole('heading', { name: 'Caso 1 de 3' });
    const lista = within(
      screen.getByRole('list', { name: 'Casos de la muestra' }),
    );
    await usuario.click(lista.getAllByRole('button')[2]!);
    expect(
      screen.getByRole('heading', { name: 'Caso 3 de 3' }),
    ).toBeInTheDocument();
  });

  it.each([['contador']])(
    'con el rol %s el menú no trae «Muestra» y la ruta directa muestra sin permiso',
    async (rol) => {
      conRoles([rol]);
      fijar();
      await abrir();
      expect(
        await screen.findByText('No tienes permiso para esta acción.'),
      ).toBeInTheDocument();
      expect(
        within(menu()).queryByRole('link', { name: 'Muestra' }),
      ).toBeNull();
      expect(muestra.lecturas).toEqual([]);
    },
  );
});
