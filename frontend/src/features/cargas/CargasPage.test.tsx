import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { focusManager, type QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { contextoSesion, type DetalleCarga } from '@/shared/api/contratos';
import type { SessionState } from '@/shared/sesion';
import { almacenes } from '@/test/handlers';
import { crearCompuerta } from '@/test/compuerta';
import { CONTEXTO_SESION, SESION_LISTA } from '@/test/fixtures';
import {
  detalleCfdiConErrores,
  detalleCsvConErrores,
  LISTA_CINCO_ESTADOS,
  respuestaYaExistia,
} from '@/test/fixturesCargas';
import { espiarSolicitudes } from '@/test/handlersAuth';
import {
  listaFalla,
  type ParcheDeCarga,
  subida413Html,
  subidaFalla,
} from '@/test/handlersCargas';
import { clienteDePruebas } from '@/test/montarBandeja';
import { envolturaCargas, esperarIntervalos } from '@/test/montarCargas';
import type { ConfigPolling } from './ContextoPolling';
import { servidor } from '@/test/servidor';
import { CargasPage } from './CargasPage';

function sesionConRoles(roles: string[]): SessionState {
  return {
    ...SESION_LISTA,
    contexto: contextoSesion.parse({ ...CONTEXTO_SESION, roles }),
  } as SessionState;
}

function montar(
  polling?: ConfigPolling,
  roles: string[] = ['admin', 'contador'],
  cliente: QueryClient = clienteDePruebas(),
) {
  return render(<CargasPage />, {
    wrapper: envolturaCargas(cliente, () => sesionConRoles(roles), polling),
  });
}

afterEach(() => {
  focusManager.setFocused(undefined);
});

describe('CargasPage: historial', () => {
  it('mientras llega la lista muestra el esqueleto y luego la tabla (1.1)', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ lista: compuerta.promesa });
    montar();
    expect(await screen.findByText('Cargando cargas')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    compuerta.abrir();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('Cargando cargas')).toBeNull();
    expect(screen.getAllByRole('row')).toHaveLength(21);
  });

  it('con cargas en los cinco estados pinta cada chip', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    montar();
    const tabla = await screen.findByRole('table');
    for (const chip of [
      'Pendiente',
      'Procesando',
      'Procesada',
      'Con errores',
      'Fallida',
    ]) {
      expect(within(tabla).getByText(chip)).toBeInTheDocument();
    }
  });

  it('una lista vacía muestra «Aún no hay cargas.» (1.2)', async () => {
    almacenes.cargas.establecer([]);
    montar();
    expect(await screen.findByText('Aún no hay cargas.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('un 500 muestra solo el texto de conectividad y «Reintentar» vuelve a pedir (1.3, 1.5)', async () => {
    servidor.use(listaFalla(500));
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).not.toHaveTextContent('detalle del servidor');
    servidor.resetHandlers();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un 403 muestra el texto de permiso y no ofrece «Reintentar»', async () => {
    servidor.use(listaFalla(403));
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No tienes permiso para esta acción.',
    );
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('ninguna fila del historial pide el detalle: solo se pide la lista y los perfiles (2.5, 13.1)', async () => {
    const espia = espiarSolicitudes();
    montar();
    await screen.findByRole('table');
    // Control positivo: la lista y los perfiles sí se pidieron, una vez.
    await waitFor(() => expect(espia.cuantas('GET', '/api/cargas')).toBe(1));
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/bancos/perfiles')).toBe(1),
    );
    for (const fila of screen.getAllByRole('row').slice(1)) {
      await userEvent.click(fila);
    }
    await esperarIntervalos();
    expect(screen.queryByRole('link')).toBeNull();
    expect(
      espia.solicitudes.map((s) => `${s.metodo} ${s.ruta}`).sort(),
    ).toEqual(['GET /api/bancos/perfiles', 'GET /api/cargas']);
    espia.detener();
  });
});

const HOLGADO: ConfigPolling = { intervaloMs: 15, topeMs: 10_000 };
const CON_TOPE: ConfigPolling = { intervaloMs: 15, topeMs: 120 };
const LEYENDA = 'Se actualiza sola mientras procesa';
const SIN_ACTUALIZAR = 'La lista dejó de actualizarse.';

describe('CargasPage: aviso de actualización del historial', () => {
  it('con cargas activas dice que se actualiza sola y no ofrece «Actualizar» (G13, K5)', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    montar(HOLGADO);
    await screen.findByRole('table');
    expect(screen.getByText(LEYENDA)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar' })).toBeNull();
    expect(screen.queryByText(SIN_ACTUALIZAR)).toBeNull();
  });

  it('sin cargas activas no hay leyenda ni aviso', async () => {
    almacenes.cargas.establecer(
      LISTA_CINCO_ESTADOS.filter((c) => c.estado === 'procesada'),
    );
    const espia = espiarSolicitudes();
    montar(CON_TOPE);
    await screen.findByRole('table');
    await esperarIntervalos(5);
    expect(screen.queryByText(LEYENDA)).toBeNull();
    expect(screen.queryByText(SIN_ACTUALIZAR)).toBeNull();
    expect(espia.cuantas('GET', '/api/cargas')).toBe(1);
    espia.detener();
  });

  it('el esqueleto, el vacío y el error no llevan leyenda (mockup)', async () => {
    almacenes.cargas.establecer([]);
    montar(HOLGADO);
    await screen.findByText('Aún no hay cargas.');
    expect(screen.queryByText(LEYENDA)).toBeNull();
  });

  it('al vencer el tope una fila pendiente sigue ahí, aparece «Actualizar» y no se pide nada más (11.3)', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    const espia = espiarSolicitudes();
    montar(CON_TOPE);
    await screen.findByRole('table');
    expect(await screen.findByText(SIN_ACTUALIZAR)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeEnabled();
    expect(screen.queryByText(LEYENDA)).toBeNull();
    // Control positivo: antes del tope la lista se pidió varias veces.
    expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThan(2);
    const pedidas = espia.cuantas('GET', '/api/cargas');
    await esperarIntervalos(5);
    expect(espia.cuantas('GET', '/api/cargas')).toBe(pedidas);
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    espia.detener();
  });

  it('«Actualizar» vuelve a pedir, oculta el aviso y reabre la ventana (11.5)', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    const espia = espiarSolicitudes();
    montar(CON_TOPE);
    await screen.findByText(SIN_ACTUALIZAR);
    const antes = espia.cuantas('GET', '/api/cargas');
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(await screen.findByText(LEYENDA)).toBeInTheDocument();
    expect(screen.queryByText(SIN_ACTUALIZAR)).toBeNull();
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(
        antes + 3,
      ),
    );
    expect(await screen.findByText(SIN_ACTUALIZAR)).toBeInTheDocument();
    espia.detener();
  });

  it('con la pestaña oculta no pide solo y al volver sigue (11.6)', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    const espia = espiarSolicitudes();
    montar(HOLGADO);
    await screen.findByRole('table');
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThan(1),
    );
    act(() => focusManager.setFocused(false));
    await esperarIntervalos(3);
    const congeladas = espia.cuantas('GET', '/api/cargas');
    await esperarIntervalos(5);
    expect(espia.cuantas('GET', '/api/cargas')).toBe(congeladas);
    act(() => focusManager.setFocused(true));
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThan(congeladas),
    );
    espia.detener();
  });

  it('un sondeo que falla mantiene la tabla y no pinta alerta (11.9)', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    const espia = espiarSolicitudes();
    montar(HOLGADO);
    await screen.findByRole('table');
    servidor.use(listaFalla(500));
    const antes = espia.cuantas('GET', '/api/cargas');
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThan(antes + 1),
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    espia.detener();
  });
});

// ---------------------------------------------------------------------------
// Pantalla completa (S8): las 13 vistas de Cargas.dc.html que dependen de la
// pantalla entera, como combinaciones de lista, sesión, subida y polling.
// ---------------------------------------------------------------------------

const CFDI = 'CFDI · XML';
const CSV = 'Estado de cuenta';
const PROCESANDO = 'Procesando la carga…';
const CON_TOPE_PANEL: ConfigPolling = { intervaloMs: 15, topeMs: 120 };

const usuario = () => userEvent.setup({ applyAccept: false });
const xml = (nombre: string) => new File(['<c/>'], nombre);
const csv = (nombre: string) => new File(['a,b'], nombre);

const tarjeta = (titulo: string) =>
  screen.getByRole('region', { name: titulo });
const regionDe = (titulo: string) =>
  within(tarjeta(titulo)).getByRole('status');
const botonCfdi = (n: number) =>
  screen.getByRole('button', {
    name: n === 1 ? 'Subir 1 archivo' : `Subir ${n} archivos`,
  });
const botonCsv = () =>
  screen.getByRole('button', { name: 'Subir estado de cuenta' });
/** Un párrafo cuyo texto completo es `texto` (las cifras van en sus propios spans). */
const resumen = (texto: string) => (_: string, el: Element | null) =>
  el?.tagName === 'P' && el.textContent === texto;

async function esperarPerfiles() {
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Perfil de lectura') as HTMLSelectElement).options
        .length,
    ).toBe(3),
  );
}

async function subirXml(...nombres: string[]) {
  const u = usuario();
  const lista = nombres.length > 0 ? nombres : ['a.xml'];
  await u.upload(screen.getByLabelText('Elegir archivos'), lista.map(xml));
  await u.click(botonCfdi(lista.length));
}

async function subirCsv() {
  const u = usuario();
  await u.upload(screen.getByLabelText('Elegir archivo'), csv('estado.csv'));
  await u.click(botonCsv());
}

const parcheDe = (d: DetalleCarga): ParcheDeCarga => ({
  totalRegistros: d.totalRegistros,
  registrosOk: d.registrosOk,
  registrosExistentes: d.registrosExistentes,
  registrosError: d.registrosError,
  resultados: d.resultados,
  errorMensaje: d.errorMensaje,
});

const idDeLaUltima = () => almacenes.cargas.filas()[0]?.id ?? '';

describe('CargasPage: las 13 vistas de la pantalla completa', () => {
  it('normal: las dos tarjetas, el historial, la leyenda y ninguna alerta', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    montar(HOLGADO);
    await screen.findByRole('table');
    await esperarPerfiles();
    expect(tarjeta(CFDI)).toBeInTheDocument();
    expect(tarjeta(CSV)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Subir archivos' }),
    ).toBeDisabled();
    expect(botonCsv()).toBeDisabled();
    expect(screen.getByLabelText('Elegir archivos')).toBeEnabled();
    expect(screen.getByText(LEYENDA)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.queryByText('Tu rol solo permite consultar las cargas.'),
    ).toBeNull();
    expect(screen.queryByText('Cargas', { selector: 'h2' })).toBeNull();
  });

  it('cargando: el esqueleto del historial y, ya, las tarjetas (vista cargando)', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ lista: compuerta.promesa });
    montar(HOLGADO);
    expect(await screen.findByText('Cargando cargas')).toBeInTheDocument();
    expect(tarjeta(CFDI)).toBeInTheDocument();
    expect(tarjeta(CSV)).toBeInTheDocument();
    expect(screen.queryByText(LEYENDA)).toBeNull();
    compuerta.abrir();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('vacío: «Aún no hay cargas.» y las tarjetas intactas (vista vacio)', async () => {
    almacenes.cargas.establecer([]);
    montar(HOLGADO);
    expect(await screen.findByText('Aún no hay cargas.')).toBeInTheDocument();
    expect(tarjeta(CFDI)).toBeInTheDocument();
    expect(screen.getByLabelText('Elegir archivos')).toBeEnabled();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('error: una lista que falla muestra solo el texto de conectividad y no esconde las tarjetas (vista error, 1.5)', async () => {
    servidor.use(listaFalla(500));
    montar(HOLGADO);
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(screen.queryByText(/detalle del servidor/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
    expect(tarjeta(CFDI)).toBeInTheDocument();
    expect(tarjeta(CSV)).toBeInTheDocument();
    expect(screen.getByLabelText('Elegir archivos')).toBeEnabled();
    expect(screen.getByLabelText('Elegir archivo')).toBeEnabled();
  });

  it('revisor: el aviso, las tarjetas con cada control apagado y la tabla a la vista (vista revisor)', async () => {
    montar(HOLGADO, ['revisor']);
    await screen.findByRole('table');
    await esperarPerfiles();
    expect(
      screen.getByText('Tu rol solo permite consultar las cargas.'),
    ).toBeInTheDocument();
    for (const control of [
      screen.getByLabelText('Elegir archivos'),
      screen.getByLabelText('Elegir archivo'),
      screen.getByLabelText('Banco'),
      screen.getByLabelText('Cuenta'),
      screen.getByLabelText('Perfil de lectura'),
      botonCsv(),
    ]) {
      expect(control).toBeDisabled();
    }
  });

  it('subiendo: solo la tarjeta que sube dice «Subiendo…» y el historial sigue (vista subiendo)', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    montar(HOLGADO);
    await screen.findByRole('table');
    await esperarPerfiles();
    await subirXml();
    const boton = await screen.findByRole('button', { name: 'Subiendo…' });
    expect(boton).toBeDisabled();
    expect(botonCsv()).toBeDisabled();
    expect(screen.getByLabelText('Banco')).toBeEnabled();
    expect(
      within(tarjeta(CFDI)).getByText('Subiendo tus archivos'),
    ).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    compuerta.abrir();
    expect(
      await within(regionDe(CFDI)).findByText(PROCESANDO),
    ).toBeInTheDocument();
  });

  it('resultado_cfdi: el resumen en la tarjeta de CFDI y la carga nueva en la tabla (vista resultado_cfdi)', async () => {
    montar(HOLGADO);
    await screen.findByRole('table');
    await esperarPerfiles();
    await subirXml('a.xml', 'b.xml', 'c.xml');
    const region = regionDe(CFDI);
    await within(region).findByText(PROCESANDO);
    almacenes.cargas.avanzar(
      idDeLaUltima(),
      'con_errores',
      parcheDe(detalleCfdiConErrores()),
    );
    expect(
      await within(region).findByText(
        resumen('1 nuevos, 1 ya existían, 1 con error.'),
      ),
    ).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem')).toHaveLength(3);
    expect(regionDe(CSV)).toBeEmptyDOMElement();
    // La tabla ya trae la carga que acaba de subirse.
    expect(
      await within(screen.getByRole('table')).findByRole('cell', {
        name: /3 archivos: a\.xml, b\.xml, c\.xml/,
      }),
    ).toBeInTheDocument();
  });

  it('resultado_csv: las filas con error en la tarjeta del estado de cuenta (vista resultado_csv)', async () => {
    montar(HOLGADO);
    await screen.findByRole('table');
    await esperarPerfiles();
    await subirCsv();
    const region = regionDe(CSV);
    await within(region).findByText(PROCESANDO);
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

  it('ya_existia: el aviso de lote ya cargado y debajo su resultado (vista ya_existia)', async () => {
    servidor.use(
      http.post('/api/cargas/cfdi', () =>
        HttpResponse.json(respuestaYaExistia('procesada'), { status: 200 }),
      ),
    );
    montar(HOLGADO);
    await screen.findByRole('table');
    await esperarPerfiles();
    await subirXml();
    const region = regionDe(CFDI);
    expect(
      await within(region).findByText('Este archivo ya se había cargado.'),
    ).toBeInTheDocument();
    expect(within(region).getByText('No se duplicó nada.')).toBeInTheDocument();
    expect(
      within(region).getByRole('region', { name: 'Resultado por archivo' }),
    ).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('error_400: el motivo del servidor en la tarjeta del estado de cuenta (vista error_400)', async () => {
    servidor.use(
      ...subidaFalla(
        400,
        'El encabezado del CSV no coincide con el perfil banco-norte.',
      ),
    );
    montar(HOLGADO);
    await screen.findByRole('table');
    await esperarPerfiles();
    await subirCsv();
    const alerta = await within(tarjeta(CSV)).findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo procesar la carga.');
    expect(alerta).toHaveTextContent(
      'El encabezado del CSV no coincide con el perfil banco-norte.',
    );
    expect(within(tarjeta(CFDI)).queryByRole('alert')).toBeNull();
  });

  it('error_413: «Los archivos pesan demasiado.» en la tarjeta de CFDI (vista error_413)', async () => {
    servidor.use(...subida413Html());
    montar(HOLGADO);
    await screen.findByRole('table');
    await esperarPerfiles();
    await subirXml();
    const alerta = await within(tarjeta(CFDI)).findByRole('alert');
    expect(alerta).toHaveTextContent('Los archivos pesan demasiado.');
    expect(alerta).toHaveTextContent(
      'Divide la carga en partes más pequeñas e inténtalo de nuevo.',
    );
    expect(within(tarjeta(CSV)).queryByRole('alert')).toBeNull();
  });

  it('sin_actualizar: al vencer el tope el encabezado del historial ofrece «Actualizar» (vista sin_actualizar)', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    montar(CON_TOPE_PANEL);
    expect(await screen.findByText(SIN_ACTUALIZAR)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Actualizar' })).toHaveLength(
      1,
    );
    expect(screen.queryByText(LEYENDA)).toBeNull();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('cuenta_completa: el aviso aparece, la cuenta escrita no sale del campo (vista cuenta_completa)', async () => {
    const errores: unknown[][] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => errores.push(args);
    try {
      montar(HOLGADO);
      await screen.findByRole('table');
      await esperarPerfiles();
      const cuenta = screen.getByLabelText('Cuenta');
      await usuario().type(cuenta, '012345678901234567');
      expect(
        screen.getByText(
          'Parece un número de cuenta completo. Escribe solo los últimos dígitos.',
        ),
      ).toBeInTheDocument();
      expect(cuenta).toHaveValue('012345678901234567');
      expect(botonCsv()).toBeDisabled();
    } finally {
      console.log = original;
    }
    expect(JSON.stringify(errores)).not.toContain('0123456789');
  });
});

describe('CargasPage: un solo sondeo para el historial y las tarjetas', () => {
  it('la lista tiene un único observador y el encabezado y la tarjeta ven el mismo tope', async () => {
    almacenes.cargas.establecer(LISTA_CINCO_ESTADOS);
    const cliente = clienteDePruebas();
    montar(CON_TOPE_PANEL, ['admin', 'contador'], cliente);
    await screen.findByRole('table');
    const consultasDeLista = cliente
      .getQueryCache()
      .findAll({ queryKey: ['cargas'] })
      .filter((q) => q.queryKey[2] === 'lista');
    expect(consultasDeLista).toHaveLength(1);
    expect(consultasDeLista[0]?.getObserversCount()).toBe(1);
    expect(await screen.findByText(SIN_ACTUALIZAR)).toBeInTheDocument();
  });

  it('«Actualizar» del encabezado reabre la ventana de las tarjetas: la carga subida vuelve a sondearse', async () => {
    const espia = espiarSolicitudes();
    montar(CON_TOPE_PANEL);
    await screen.findByRole('table');
    await esperarPerfiles();
    await subirXml();
    await within(regionDe(CFDI)).findByText(SIN_ACTUALIZAR);
    const historial = screen.getByRole('region', { name: 'Cargas recientes' });
    const detalle = () =>
      espia.solicitudes.filter(
        (s) => s.metodo === 'GET' && /^\/api\/cargas\/[^/]+$/.test(s.ruta),
      ).length;
    // Control positivo: antes del tope la carga subida sí se sondeó.
    const antes = detalle();
    expect(antes).toBeGreaterThan(1);
    await esperarIntervalos(5);
    expect(detalle()).toBe(antes);
    await userEvent.click(
      within(historial).getByRole('button', { name: 'Actualizar' }),
    );
    await waitFor(() => expect(detalle()).toBeGreaterThan(antes + 1));
    espia.detener();
  });
});

describe('CargasPage: estructura y accesibilidad (12.1, 12.3)', () => {
  it('un h2 por sección, ningún h1 propio, una tabla con ocho encabezados', async () => {
    montar(HOLGADO);
    const tabla = await screen.findByRole('table');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(
      screen
        .getAllByRole('heading')
        .map((h) => [h.tagName, h.textContent ?? '']),
    ).toEqual([
      ['H2', CFDI],
      ['H2', CSV],
      ['H2', 'Cargas recientes'],
    ]);
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual([
      'Tipo',
      'Archivo',
      'Estado',
      'Avance',
      'Válidos',
      'Con error',
      'Subió',
      'Fecha',
    ]);
  });

  it('cada campo tiene su etiqueta y la ayuda de la cuenta cuelga de aria-describedby', async () => {
    montar(HOLGADO);
    await screen.findByRole('table');
    await esperarPerfiles();
    for (const etiqueta of [
      'Elegir archivos',
      'Elegir archivo',
      'Banco',
      'Cuenta',
      'Perfil de lectura',
    ]) {
      expect(screen.getByLabelText(etiqueta)).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Cuenta')).toHaveAccessibleDescription(
      'Escribe solo los últimos dígitos. No hace falta el número completo.',
    );
  });

  it('el orden del teclado es CFDI, estado de cuenta e historial, sin tabindex positivo', async () => {
    montar(HOLGADO);
    const tabla = await screen.findByRole('table');
    await esperarPerfiles();
    const antes = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(antes(tarjeta(CFDI), tarjeta(CSV))).toBe(true);
    expect(antes(tarjeta(CSV), tabla)).toBe(true);
    expect(
      antes(
        screen.getByLabelText('Elegir archivos'),
        screen.getByLabelText('Banco'),
      ),
    ).toBe(true);
    const positivos = [...document.querySelectorAll('[tabindex]')].filter(
      (e) => Number(e.getAttribute('tabindex')) > 0,
    );
    expect(positivos).toHaveLength(0);
  });

  it('el aviso del revisor va antes de las tarjetas, como en el mockup', async () => {
    montar(HOLGADO, ['revisor']);
    await screen.findByRole('table');
    const aviso = screen.getByText('Tu rol solo permite consultar las cargas.');
    expect(
      aviso.compareDocumentPosition(tarjeta(CFDI)) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('las regiones de estado son corteses y los fallos son alertas', async () => {
    servidor.use(...subidaFalla(500));
    montar(HOLGADO);
    await screen.findByRole('table');
    await esperarPerfiles();
    for (const titulo of [CFDI, CSV]) {
      const region = regionDe(titulo);
      expect(region).toHaveAttribute('role', 'status');
      expect(region.getAttribute('aria-live')).not.toBe('assertive');
    }
    await subirXml();
    const alerta = await within(tarjeta(CFDI)).findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo completar la solicitud.');
  });
});
