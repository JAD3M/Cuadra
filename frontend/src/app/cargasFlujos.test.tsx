import {
  act,
  configure,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AVISOS } from '@/features/auth/components/textos';
import type { ConfigPolling } from '@/features/cargas/ContextoPolling';
import type { ItemCarga } from '@/shared/api/contratos';
import { CLAVE_TEMA } from '@/shared/tema/tipos';
import { crearCompuerta } from '@/test/compuerta';
import { EMPRESAS_DISPONIBLES } from '@/test/fixtures';
import { filaBandeja, idDe } from '@/test/fixturesBandeja';
import {
  detalleCfdiConErrores,
  detalleCsvConErrores,
  itemCarga,
} from '@/test/fixturesCargas';
import { almacenes } from '@/test/handlers';
import { contextoPorToken, espiarSolicitudes } from '@/test/handlersAuth';
import { listaFalla, type ParcheDeCarga } from '@/test/handlersCargas';
import {
  elegirEmpresaPorNombre,
  entrarALaApp,
  enviarLogin,
  montarApp,
} from '@/test/montarApp';
import { esperarIntervalos } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';

// Montar la app completa y teclear el login tarda más que una pantalla suelta.
beforeAll(() => configure({ asyncUtilTimeout: 5000 }));
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

/** Constantes diminutas, con un tope que no vence antes de que el flujo avance la carga. */
const POLLING: ConfigPolling = { intervaloMs: 15, topeMs: 10_000 };

let espia: ReturnType<typeof espiarSolicitudes> | null = null;

afterEach(() => {
  espia?.detener();
  espia = null;
  localStorage.removeItem(CLAVE_TEMA);
  document.documentElement.removeAttribute('data-theme');
});

const CFDI = 'CFDI · XML';
const CSV = 'Estado de cuenta';
const PROCESANDO = 'Procesando la carga…';

const usuario = () => userEvent.setup({ applyAccept: false });
const tarjeta = (titulo: string) =>
  screen.getByRole('region', { name: titulo });
const regionDe = (titulo: string) =>
  within(tarjeta(titulo)).getByRole('status');
const resumen = (texto: string) => (_: string, el: Element | null) =>
  el?.tagName === 'P' && el.textContent === texto;
const cambiarEmpresa = () =>
  screen.getByRole('button', { name: /Cambiar de empresa/ });
const filasDeDatos = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1);
const celda = (nombre: RegExp | string) =>
  within(screen.getByRole('table')).findByRole('cell', { name: nombre });

const idDeLaUltima = () => almacenes.cargas.filas()[0]?.id ?? '';
const parcheDe = (
  d: ReturnType<typeof detalleCfdiConErrores>,
): ParcheDeCarga => ({
  totalRegistros: d.totalRegistros,
  registrosOk: d.registrosOk,
  registrosExistentes: d.registrosExistentes,
  registrosError: d.registrosError,
  resultados: d.resultados,
  errorMensaje: d.errorMensaje,
});

async function abrirCargas(
  entrada = '/cargas',
  polling: ConfigPolling = POLLING,
) {
  const montada = montarApp(entrada, { polling });
  await entrarALaApp();
  await screen.findByRole('table');
  await esperarPerfiles();
  return montada;
}

async function esperarPerfiles() {
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Perfil de lectura') as HTMLSelectElement).options
        .length,
    ).toBe(3),
  );
}

async function subirXml(...nombres: string[]) {
  const lista = nombres.length > 0 ? nombres : ['a.xml'];
  const u = usuario();
  await u.upload(
    screen.getByLabelText('Elegir archivos'),
    lista.map((n) => new File(['<c/>'], n)),
  );
  await u.click(
    screen.getByRole('button', {
      name:
        lista.length === 1
          ? 'Subir 1 archivo'
          : `Subir ${lista.length} archivos`,
    }),
  );
}

async function subirCsv(nombre = 'estado.csv') {
  const u = usuario();
  await u.upload(
    screen.getByLabelText('Elegir archivo'),
    new File(['a,b'], nombre),
  );
  await u.click(screen.getByRole('button', { name: 'Subir estado de cuenta' }));
}

describe('flujos de cargas: la pantalla', () => {
  it('tras el login /cargas muestra el título, el subtítulo, el título del documento y la lista (1.4)', async () => {
    montarApp('/cargas', { polling: POLLING });
    await entrarALaApp();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Cargas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Sube CFDI y estados de cuenta. El motor corre al terminar cada carga.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Cargas · Cuadra'));
    await screen.findByRole('table');
    expect(filasDeDatos()).toHaveLength(20);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('un 401 al leer la lista termina la sesión y guarda /cargas como destino', async () => {
    servidor.use(listaFalla(401));
    const { router } = montarApp('/cargas', { polling: POLLING });
    await enviarLogin();
    await elegirEmpresaPorNombre(/Ferreteria/);
    await screen.findByText(AVISOS.sesion_expirada);
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.state).toMatchObject({
      from: { pathname: '/cargas' },
    });
  });

  it('el control de tema cambia data-theme y la pantalla sigue pintando con sus tokens (12.4)', async () => {
    await abrirCargas();
    const control = screen.getByRole('group', { name: 'Tema' });
    const u = userEvent.setup();
    await u.click(within(control).getByRole('radio', { name: /Claro/ }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(tarjeta(CFDI)).toBeInTheDocument();
    await u.click(within(control).getByRole('radio', { name: /Oscuro/ }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(tarjeta(CSV)).toBeInTheDocument();
  });
});

describe('flujos de cargas: subir', () => {
  it('un CFDI 202: la fila aparece por la lista, el panel pasa de pendiente a procesando a resultados (9.1)', async () => {
    espia = espiarSolicitudes();
    await abrirCargas();
    const listas = () => espia?.cuantas('GET', '/api/cargas') ?? 0;
    const antes = listas();
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ detalle: compuerta.promesa });
    await subirXml('a.xml', 'b.xml', 'c.xml');
    const region = regionDe(CFDI);
    // pendiente: el panel sale de lo que respondió el POST, sin esperar al detalle.
    expect(await within(region).findByText(PROCESANDO)).toBeInTheDocument();
    // La fila nueva llega por una lectura de la lista, no por escritura local.
    expect(
      await celda(/3 archivos: a\.xml, b\.xml, c\.xml/),
    ).toBeInTheDocument();
    expect(listas()).toBeGreaterThan(antes);
    const id = idDeLaUltima();
    // procesando: con el detalle retenido el panel sigue como estaba.
    almacenes.cargas.avanzar(id, 'procesando');
    await esperarIntervalos(3);
    expect(within(region).getByText(PROCESANDO)).toBeInTheDocument();
    compuerta.abrir();
    expect(within(region).getByText(PROCESANDO)).toBeInTheDocument();
    almacenes.cargas.avanzar(
      id,
      'con_errores',
      parcheDe(detalleCfdiConErrores()),
    );
    expect(
      await within(region).findByText(
        resumen('1 nuevos, 1 ya existían, 1 con error.'),
      ),
    ).toBeInTheDocument();
    expect(within(region).queryByText(PROCESANDO)).toBeNull();
    expect(within(region).getAllByRole('listitem')).toHaveLength(3);
  });

  it('un estado de cuenta: la fila aparece y el panel termina con las filas con error', async () => {
    await abrirCargas();
    await subirCsv('estado-sep.csv');
    const region = regionDe(CSV);
    expect(await within(region).findByText(PROCESANDO)).toBeInTheDocument();
    expect(await celda('estado-sep.csv')).toBeInTheDocument();
    almacenes.cargas.avanzar(
      idDeLaUltima(),
      'con_errores',
      parcheDe(detalleCsvConErrores()),
    );
    expect(
      await within(region).findByText(
        resumen('98 registros cargados, 2 con error.'),
      ),
    ).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem')).toHaveLength(2);
    expect(regionDe(CFDI)).toBeEmptyDOMElement();
  });

  it('al terminar una carga sondeada la bandeja se entera: el contador y la lista traen lo que produjo el motor, con las lecturas justas (M17)', async () => {
    espia = espiarSolicitudes();
    const { router } = await abrirCargas();
    expect(
      await screen.findByRole('link', { name: 'Bandeja 39 pendientes' }),
    ).toBeInTheDocument();
    await subirXml();
    await within(regionDe(CFDI)).findByText(PROCESANDO);
    // El motor, al terminar, deja una propuesta más por revisar.
    almacenes.bandeja.establecer([
      ...almacenes.bandeja.filas(),
      filaBandeja({ movimientoId: idDe(9001), estado: 'sin_match' }),
    ]);
    const resumenes = () => espia?.cuantas('GET', '/api/bandeja/resumen') ?? 0;
    const listasBandeja = () => espia?.cuantas('GET', '/api/bandeja') ?? 0;
    const resumenesAntes = resumenes();
    const listasAntes = listasBandeja();
    // Control positivo: el panel sondea hasta que la carga termina.
    almacenes.cargas.avanzar(idDeLaUltima(), 'procesada', { registrosOk: 1 });
    expect(
      await screen.findByRole('link', { name: 'Bandeja 40 pendientes' }),
    ).toBeInTheDocument();
    await esperarIntervalos(5);
    // La lista y el panel ven el mismo paso a terminal, pero la bandeja se
    // invalida una sola vez: una lectura del resumen, ni una más.
    expect(resumenes()).toBe(resumenesAntes + 1);
    // La lista de la bandeja no está montada: no se pide hasta que se abre.
    expect(listasBandeja()).toBe(listasAntes);
    await act(() => router.navigate('/bandeja'));
    await screen.findByText('Mostrando 1–20 de 40');
    expect(listasBandeja()).toBe(listasAntes + 1);
  });
  it('una carga fallida que se resube y termina vuelve a avisar a la bandeja: otra lectura del resumen (M17)', async () => {
    espia = espiarSolicitudes();
    await abrirCargas();
    const resumenes = () => espia?.cuantas('GET', '/api/bandeja/resumen') ?? 0;
    await subirXml();
    await within(regionDe(CFDI)).findByText(PROCESANDO);
    const inicio = resumenes();
    almacenes.cargas.avanzar(idDeLaUltima(), 'fallida');
    // Control positivo: la primera terminación sí invalida la bandeja.
    await waitFor(() => expect(resumenes()).toBe(inicio + 1));
    await esperarIntervalos(5);
    expect(resumenes()).toBe(inicio + 1);
    // El mismo archivo: el servidor lo reencola (POST 200 yaExistia).
    await subirXml();
    await within(regionDe(CFDI)).findByText(PROCESANDO);
    expect(almacenes.cargas.subidas()).toHaveLength(2);
    almacenes.cargas.avanzar(idDeLaUltima(), 'procesada', { registrosOk: 1 });
    await waitFor(() => expect(resumenes()).toBe(inicio + 2));
    await esperarIntervalos(5);
    expect(resumenes()).toBe(inicio + 2);
  });
});

describe('flujos de cargas: sesión y empresa', () => {
  const idB = EMPRESAS_DISPONIBLES[1]!.id;
  const deB = (request: Request) =>
    (request.headers.get('Authorization') ?? '').endsWith(idB);
  const itemsB: ItemCarga[] = [
    itemCarga(1, {
      estado: 'procesada',
      nombreArchivo: 'lote-de-la-empresa-B.xml',
      registrosOk: 3,
    }),
  ];

  /** La lista y el detalle según la empresa: A trae las del almacén; B, solo las suyas, terminadas. */
  function listasPorEmpresa() {
    servidor.use(
      http.get('/api/cargas', ({ request }) =>
        deB(request)
          ? HttpResponse.json({ datos: itemsB })
          : HttpResponse.json({ datos: almacenes.cargas.filas() }),
      ),
    );
  }

  it('cambiar de empresa con un POST en vuelo: nada de A se ve ni se escribe en la época nueva (9.2)', async () => {
    contextoPorToken(idB);
    listasPorEmpresa();
    espia = espiarSolicitudes();
    const { router } = await abrirCargas();
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    await subirXml('de-la-empresa-A.xml');
    await screen.findByRole('button', { name: 'Subiendo…' });
    await usuario().click(cambiarEmpresa());
    await elegirEmpresaPorNombre(/Abarrotes/);
    await screen.findByRole('table');
    expect(router.state.location.pathname).toBe('/bandeja');
    await usuario().click(screen.getByRole('link', { name: /^Cargas/ }));
    await celda('lote-de-la-empresa-B.xml');
    // El POST de A responde ahora, ya en la época de B.
    compuerta.abrir();
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    // Control positivo: la lista de B se pidió; se espera a que el temporizador haya corrido.
    const lecturasDeB = () =>
      (espia?.solicitudes ?? []).filter(
        (s) => s.metodo === 'GET' && (s.autorizacion ?? '').endsWith(idB),
      );
    expect(lecturasDeB().some((s) => s.ruta === '/api/cargas')).toBe(true);
    await esperarIntervalos(5);
    expect(screen.queryByText(PROCESANDO)).toBeNull();
    expect(screen.queryByText(/de-la-empresa-A/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      lecturasDeB().filter((s) => /^\/api\/cargas\/[^/]+$/.test(s.ruta)),
    ).toHaveLength(0);
  });

  it('cambiar de empresa: no queda ningún dato de la lista ni del panel de A, y el revisor de B ve la tabla con las tarjetas apagadas', async () => {
    contextoPorToken(idB);
    listasPorEmpresa();
    await abrirCargas();
    await subirXml('de-la-empresa-A.xml');
    await within(regionDe(CFDI)).findByText(PROCESANDO);
    await celda(/de-la-empresa-A\.xml/);
    await usuario().click(cambiarEmpresa());
    await elegirEmpresaPorNombre(/Abarrotes/);
    await screen.findByRole('table');
    await usuario().click(screen.getByRole('link', { name: /^Cargas/ }));
    await celda('lote-de-la-empresa-B.xml');
    expect(screen.queryByText(/de-la-empresa-A/)).toBeNull();
    expect(screen.queryByText(PROCESANDO)).toBeNull();
    expect(
      screen.getByText('Tu rol solo permite consultar las cargas.'),
    ).toBeInTheDocument();
    for (const control of [
      screen.getByLabelText('Elegir archivos'),
      screen.getByLabelText('Elegir archivo'),
      screen.getByLabelText('Banco'),
      screen.getByLabelText('Cuenta'),
      screen.getByRole('button', { name: 'Subir estado de cuenta' }),
    ]) {
      expect(control).toBeDisabled();
    }
  });

  it('cerrar sesión con un POST en vuelo: no se escribe nada ni se pide nada más (9.3)', async () => {
    espia = espiarSolicitudes();
    await abrirCargas();
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    await subirXml();
    await screen.findByRole('button', { name: 'Subiendo…' });
    await usuario().click(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    );
    await screen.findByText(AVISOS.cierre_voluntario);
    const hasta = espia.solicitudes.length;
    compuerta.abrir();
    // Control positivo: el POST retenido sí llegó al servidor.
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    await esperarIntervalos(5);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(AVISOS.cierre_voluntario)).toBeInTheDocument();
    expect(
      espia.solicitudes
        .slice(hasta)
        .filter((s) => /^\/api\/(cargas|bancos|bandeja)/.test(s.ruta)),
    ).toEqual([]);
  });
});

describe('flujos de cargas: la cuenta escrita no sale de la pantalla (6.4)', () => {
  const CUENTA = '98765432101234';

  it('ni la consola ni el historial ni las cachés guardan la cuenta; solo viaja en el POST', async () => {
    const salida: string[] = [];
    const metodos = ['log', 'info', 'warn', 'error', 'debug'] as const;
    for (const metodo of metodos) {
      vi.spyOn(console, metodo).mockImplementation((...args: unknown[]) => {
        salida.push(args.map(String).join(' '));
      });
    }
    try {
      const { router } = await abrirCargas();
      // Control positivo: el espía de la consola registra lo que se le manda.
      console.info('sonda');
      expect(salida).toContain('sonda');
      await usuario().type(screen.getByLabelText('Cuenta'), CUENTA);
      await subirCsv();
      const region = regionDe(CSV);
      await within(region).findByText(PROCESANDO);
      await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
      expect(almacenes.cargas.subidas()[0]?.campos).toContainEqual([
        'cuenta',
        CUENTA,
      ]);
      almacenes.cargas.avanzar(
        idDeLaUltima(),
        'con_errores',
        parcheDe(detalleCsvConErrores()),
      );
      await within(region).findByText(/registros cargados/);
      expect(salida.join('\n')).not.toContain(CUENTA);
      expect(document.body).not.toHaveTextContent(CUENTA);
      expect(
        router.state.location.pathname + router.state.location.search,
      ).not.toContain(CUENTA);
      expect(JSON.stringify(window.history.state ?? null)).not.toContain(
        CUENTA,
      );
    } finally {
      vi.restoreAllMocks();
    }
  });
});
