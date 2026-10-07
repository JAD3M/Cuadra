import { focusManager } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REINTENTAR } from '@/features/cargas/textos';
import {
  contextoSesion,
  type DetalleCarga,
  type RespuestaCarga,
} from '@/shared/api/contratos';
import type { SessionState } from '@/shared/sesion';
import { crearCompuerta } from '@/test/compuerta';
import { CONTEXTO_SESION, SESION_LISTA } from '@/test/fixtures';
import {
  detalleCarga,
  detalleCfdiConErrores,
  detalleCsvConErrores,
  respuestaYaExistia,
} from '@/test/fixturesCargas';
import { almacenes } from '@/test/handlers';
import { espiarSolicitudes } from '@/test/handlersAuth';
import {
  detalleFalla,
  perfilesFalla,
  type ParcheDeCarga,
  subida413Html,
  subidaFalla,
  subidaRedDeFallo,
} from '@/test/handlersCargas';
import { clienteDePruebas } from '@/test/montarBandeja';
import { envolturaCargas, esperarIntervalos } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { CargasContenedor } from './CargasContenedor';
import type { ConfigPolling } from './ContextoPolling';

function sesionConRoles(roles: string[]): SessionState {
  return {
    ...SESION_LISTA,
    contexto: contextoSesion.parse({ ...CONTEXTO_SESION, roles }),
  } as SessionState;
}

function montar(
  roles: string[] = ['admin', 'contador'],
  polling?: ConfigPolling,
  estado: () => SessionState = () => sesionConRoles(roles),
) {
  return render(<CargasContenedor />, {
    wrapper: envolturaCargas(clienteDePruebas(), estado, polling),
  });
}

/** Constantes diminutas, con un tope que no vence antes de que la prueba avance la carga. */
const POLLING_HOLGADO: ConfigPolling = { intervaloMs: 15, topeMs: 10_000 };

/** El selector del sistema filtra por `accept`; aquí hay que dejar pasar todo. */
const usuario = () => userEvent.setup({ applyAccept: false });

const xml = (nombre: string) => new File(['<c/>'], nombre);
const csv = (nombre: string) => new File(['a,b'], nombre);

const botonCfdi = (n: number) =>
  screen.getByRole('button', {
    name: n === 1 ? 'Subir 1 archivo' : `Subir ${n} archivos`,
  });
const botonCsv = () =>
  screen.getByRole('button', { name: 'Subir estado de cuenta' });

/** La tarjeta (y su región de estado) de cada tipo de carga. */
const tarjeta = (titulo: string) =>
  screen.getByRole('region', { name: titulo });
const regionDe = (titulo: string) =>
  within(tarjeta(titulo)).getByRole('status');

async function esperarPerfiles() {
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Perfil de lectura') as HTMLSelectElement).options
        .length,
    ).toBe(3),
  );
}

describe('CargasContenedor: roles', () => {
  it.each([[['admin']], [['contador']], [['admin', 'contador']]])(
    'con %j las dos tarjetas están activas y no hay aviso (4.1)',
    async (roles) => {
      montar(roles);
      await esperarPerfiles();
      expect(
        screen.queryByText('Tu rol solo permite consultar las cargas.'),
      ).toBeNull();
      expect(screen.getByLabelText('Elegir archivos')).toBeEnabled();
      expect(screen.getByLabelText('Elegir archivo')).toBeEnabled();
      expect(screen.getByLabelText('Banco')).toBeEnabled();
      expect(screen.getByLabelText('Cuenta')).toBeEnabled();
      expect(screen.getByLabelText('Perfil de lectura')).toBeEnabled();
    },
  );

  it('un revisor con otro rol que sube puede subir', async () => {
    montar(['revisor', 'contador']);
    await esperarPerfiles();
    expect(screen.getByLabelText('Elegir archivos')).toBeEnabled();
  });

  it('un revisor ve el aviso y cada control deshabilitado, ninguno oculto (4.2)', async () => {
    montar(['revisor']);
    await esperarPerfiles();
    expect(
      screen.getByText('Tu rol solo permite consultar las cargas.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Pide a un administrador o contador que suba los archivos.',
      ),
    ).toBeInTheDocument();
    for (const control of [
      screen.getByLabelText('Elegir archivos'),
      screen.getByLabelText('Elegir archivo'),
      screen.getByLabelText('Banco'),
      screen.getByLabelText('Cuenta'),
      screen.getByLabelText('Perfil de lectura'),
      screen.getByRole('button', { name: 'Subir archivos' }),
      botonCsv(),
    ]) {
      expect(control).toBeDisabled();
    }
  });

  it('un revisor no puede enviar nada: ni por el selector ni soltando (4.2)', async () => {
    const espia = espiarSolicitudes();
    montar(['revisor']);
    await esperarPerfiles();
    // Control positivo: la lectura de perfiles sí salió.
    expect(espia.cuantas('GET', '/api/bancos/perfiles')).toBe(1);
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivos'), xml('a.xml'));
    await u.upload(screen.getByLabelText('Elegir archivo'), csv('a.csv'));
    await u.click(botonCsv());
    await esperarIntervalos();
    expect(espia.solicitudes.filter((s) => s.metodo === 'POST')).toHaveLength(
      0,
    );
    expect(screen.queryByRole('listitem')).toBeNull();
    espia.detener();
  });

  it('un administrador cuyo POST responde 403 sigue con la pantalla lista (4.3)', async () => {
    servidor.use(...subidaFalla(403));
    montar(['admin']);
    await esperarPerfiles();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivos'), xml('a.xml'));
    await u.click(botonCfdi(1));
    await waitFor(() => expect(botonCfdi(1)).toBeEnabled());
    expect(
      screen.queryByText('Tu rol solo permite consultar las cargas.'),
    ).toBeNull();
    expect(screen.getByLabelText('Elegir archivos')).toBeEnabled();
  });
});

describe('CargasContenedor: subida de CFDI', () => {
  it('una activación manda un solo POST con los archivos aceptados (7.1)', async () => {
    montar();
    await esperarPerfiles();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivos'), [
      xml('a.xml'),
      xml('b.xml'),
      xml('c.pdf'),
    ]);
    await u.click(botonCfdi(2));
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    const [subida] = almacenes.cargas.subidas();
    expect(subida?.ruta).toBe('cfdi');
    expect(subida?.archivos.map((a) => a.nombre)).toEqual(['a.xml', 'b.xml']);
    expect(subida?.archivos.every((a) => a.campo === 'archivos')).toBe(true);
  });

  it('clic doble y Enter envían uno solo (7.1, 7.3)', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    montar();
    await esperarPerfiles();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivos'), xml('a.xml'));
    const boton = botonCfdi(1);
    await u.dblClick(boton);
    await u.keyboard('{Enter}');
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    compuerta.abrir();
    await waitFor(() =>
      expect(screen.getByText('0 archivos listos.')).toBeInTheDocument(),
    );
    // Control positivo: la subida terminó; seguía habiendo un único POST.
    expect(almacenes.cargas.subidas()).toHaveLength(1);
  });

  it('con el POST retenido muestra «Subiendo…», apaga la tarjeta y no pinta filas nuevas (7.2, 7.4)', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    montar();
    await esperarPerfiles();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivos'), xml('a.xml'));
    await u.click(botonCfdi(1));
    const boton = await screen.findByRole('button', { name: 'Subiendo…' });
    expect(boton).toBeDisabled();
    expect(screen.getByLabelText('Elegir archivos')).toBeDisabled();
    expect(regionDe('CFDI · XML')).toHaveTextContent('Subiendo tus archivos');
    // Solo se apaga la tarjeta que sube (M13): la otra sigue disponible.
    expect(screen.getByLabelText('Elegir archivo')).toBeEnabled();
    // El historial ya vive en la pantalla: la carga en vuelo aún no tiene fila.
    expect(screen.queryByRole('cell', { name: 'a.xml' })).toBeNull();
    compuerta.abrir();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Subiendo…' })).toBeNull(),
    );
  });

  it('el foco pasa una sola vez a la región de la tarjeta al enviar (focus)', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    montar();
    await esperarPerfiles();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivos'), xml('a.xml'));
    await u.click(botonCfdi(1));
    await waitFor(() => expect(regionDe('CFDI · XML')).toHaveFocus());
    // Si la persona mueve el foco, la respuesta no se lo vuelve a quitar.
    await u.click(screen.getByLabelText('Banco'));
    expect(screen.getByLabelText('Banco')).toHaveFocus();
    compuerta.abrir();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Subiendo…' })).toBeNull(),
    );
    expect(screen.getByLabelText('Banco')).toHaveFocus();
  });

  it('un 500 conserva la selección y devuelve los controles (7.5)', async () => {
    servidor.use(...subidaFalla(500));
    montar();
    await esperarPerfiles();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivos'), [
      xml('a.xml'),
      xml('b.xml'),
    ]);
    await u.click(botonCfdi(2));
    await waitFor(() => expect(botonCfdi(2)).toBeEnabled());
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByLabelText('Elegir archivos')).toBeEnabled();
  });

  it('un fallo de red conserva la selección y permite reintentar (7.5)', async () => {
    servidor.use(...subidaRedDeFallo());
    montar();
    await esperarPerfiles();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivos'), xml('a.xml'));
    await u.click(botonCfdi(1));
    await waitFor(() => expect(botonCfdi(1)).toBeEnabled());
    expect(screen.getByRole('listitem')).toHaveTextContent('a.xml');
  });

  it('un éxito limpia la selección (7.6)', async () => {
    montar();
    await esperarPerfiles();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivos'), [
      xml('a.xml'),
      xml('b.xml'),
    ]);
    await u.click(botonCfdi(2));
    expect(await screen.findByText('0 archivos listos.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Subir archivos' }),
    ).toBeDisabled();
  });

  it('un lote repetido (200 yaExistia) también limpia la selección', async () => {
    montar();
    await esperarPerfiles();
    const u = usuario();
    for (let vuelta = 0; vuelta < 2; vuelta += 1) {
      await u.upload(screen.getByLabelText('Elegir archivos'), xml('a.xml'));
      await u.click(botonCfdi(1));
      await screen.findByText('0 archivos listos.');
    }
    expect(almacenes.cargas.subidas()).toHaveLength(2);
  });
});

describe('CargasContenedor: subida de estado de cuenta', () => {
  it('manda el CSV con banco, cuenta y perfil tal como se escribieron (CRG-4.4)', async () => {
    montar();
    await esperarPerfiles();
    const u = usuario();
    await u.type(screen.getByLabelText('Banco'), 'Banco del Norte');
    await u.type(screen.getByLabelText('Cuenta'), '****1234');
    await u.selectOptions(
      screen.getByLabelText('Perfil de lectura'),
      'banco-norte',
    );
    await u.upload(screen.getByLabelText('Elegir archivo'), csv('estado.csv'));
    await u.click(botonCsv());
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    const [subida] = almacenes.cargas.subidas();
    expect(subida?.ruta).toBe('estado-cuenta');
    expect(subida?.archivos.map((a) => a.nombre)).toEqual(['estado.csv']);
    expect(subida?.campos).toEqual([
      ['banco', 'Banco del Norte'],
      ['cuenta', '****1234'],
      ['perfil', 'banco-norte'],
    ]);
  });

  it('sin tocar el perfil manda el del servidor, cuadra (M13)', async () => {
    montar();
    await esperarPerfiles();
    expect(screen.getByLabelText('Perfil de lectura')).toHaveValue('cuadra');
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivo'), csv('estado.csv'));
    await u.click(botonCsv());
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    expect(almacenes.cargas.subidas()[0]?.campos).toEqual([
      ['perfil', 'cuadra'],
    ]);
  });

  it('si los perfiles no cargaron el select queda visible y apagado con aviso y Reintentar, y el POST no manda perfil (mockup)', async () => {
    servidor.use(perfilesFalla(500));
    const espia = espiarSolicitudes();
    montar();
    expect(
      await screen.findByText('No se pudieron cargar los perfiles.'),
    ).toBeVisible();
    // Control positivo: la lectura de perfiles sí salió, una sola vez.
    expect(espia.cuantas('GET', '/api/bancos/perfiles')).toBe(1);
    await esperarIntervalos(3);
    expect(espia.cuantas('GET', '/api/bancos/perfiles')).toBe(1);
    expect(screen.getByLabelText('Perfil de lectura')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: REINTENTAR }),
    ).toBeInTheDocument();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivo'), csv('estado.csv'));
    await u.click(botonCsv());
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    expect(almacenes.cargas.subidas()[0]?.campos).toEqual([]);
    espia.detener();
  });

  it('Reintentar vuelve a pedir los perfiles y, si llegan, habilita el select con cuadra por omisión (mockup)', async () => {
    servidor.use(perfilesFalla(500));
    const espia = espiarSolicitudes();
    montar();
    await screen.findByText('No se pudieron cargar los perfiles.');
    servidor.resetHandlers();
    await usuario().click(
      within(tarjeta('Estado de cuenta')).getByRole('button', {
        name: REINTENTAR,
      }),
    );
    await esperarPerfiles();
    expect(espia.cuantas('GET', '/api/bancos/perfiles')).toBe(2);
    const select = screen.getByLabelText('Perfil de lectura');
    expect(select).toBeEnabled();
    expect(select).toHaveValue('cuadra');
    expect(
      screen.queryByText('No se pudieron cargar los perfiles.'),
    ).toBeNull();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivo'), csv('estado.csv'));
    await u.click(botonCsv());
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    expect(almacenes.cargas.subidas()[0]?.campos).toEqual([
      ['perfil', 'cuadra'],
    ]);
    espia.detener();
  });

  it('si el reintento de perfiles vuelve a fallar el aviso se mantiene', async () => {
    servidor.use(perfilesFalla(500));
    const espia = espiarSolicitudes();
    montar();
    await screen.findByText('No se pudieron cargar los perfiles.');
    await usuario().click(
      within(tarjeta('Estado de cuenta')).getByRole('button', {
        name: REINTENTAR,
      }),
    );
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/bancos/perfiles')).toBe(2),
    );
    await esperarIntervalos(3);
    expect(
      screen.getByText('No se pudieron cargar los perfiles.'),
    ).toBeVisible();
    expect(screen.getByLabelText('Perfil de lectura')).toBeDisabled();
    espia.detener();
  });

  it('un 500 conserva archivo y campos escritos (7.5)', async () => {
    servidor.use(...subidaFalla(500));
    montar();
    await esperarPerfiles();
    const u = usuario();
    await u.type(screen.getByLabelText('Banco'), 'BBVA');
    await u.type(screen.getByLabelText('Cuenta'), '1234');
    await u.upload(screen.getByLabelText('Elegir archivo'), csv('estado.csv'));
    await u.click(botonCsv());
    await waitFor(() => expect(botonCsv()).toBeEnabled());
    expect(screen.getByRole('listitem')).toHaveTextContent('estado.csv');
    expect(screen.getByLabelText('Banco')).toHaveValue('BBVA');
    expect(screen.getByLabelText('Cuenta')).toHaveValue('1234');
  });

  it('un éxito limpia archivo, banco y cuenta y deja el perfil (7.6)', async () => {
    montar();
    await esperarPerfiles();
    const u = usuario();
    await u.type(screen.getByLabelText('Banco'), 'BBVA');
    await u.type(screen.getByLabelText('Cuenta'), '1234');
    await u.selectOptions(
      screen.getByLabelText('Perfil de lectura'),
      'banco-sur',
    );
    await u.upload(screen.getByLabelText('Elegir archivo'), csv('estado.csv'));
    await u.click(botonCsv());
    await waitFor(() => expect(screen.queryByRole('listitem')).toBeNull());
    expect(screen.getByLabelText('Banco')).toHaveValue('');
    expect(screen.getByLabelText('Cuenta')).toHaveValue('');
    expect(screen.getByLabelText('Perfil de lectura')).toHaveValue('banco-sur');
    expect(botonCsv()).toBeDisabled();
  });

  it('subiendo, solo la tarjeta del CSV se apaga y el foco va a su región', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    montar();
    await esperarPerfiles();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivo'), csv('estado.csv'));
    await u.click(botonCsv());
    await screen.findByRole('button', { name: 'Subiendo…' });
    expect(screen.getByLabelText('Banco')).toBeDisabled();
    expect(screen.getByLabelText('Elegir archivos')).toBeEnabled();
    expect(regionDe('Estado de cuenta')).toHaveFocus();
    expect(regionDe('Estado de cuenta')).toHaveTextContent(
      'Subiendo tus archivos',
    );
    compuerta.abrir();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Subiendo…' })).toBeNull(),
    );
  });
});

describe('CargasContenedor: ciclo de vida', () => {
  it('desmontado con la subida en vuelo no escribe estado ni falla al responder', async () => {
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    const errores = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { unmount } = montar();
    await esperarPerfiles();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivos'), xml('a.xml'));
    await u.click(botonCfdi(1));
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    unmount();
    await act(async () => {
      compuerta.abrir();
      await esperarIntervalos(3);
    });
    expect(errores).not.toHaveBeenCalled();
    errores.mockRestore();
  });
});

/** Un párrafo cuyo texto completo es `texto` (las cifras van en sus propios spans). */
const resumen = (texto: string) => (_: string, el: Element | null) =>
  el?.tagName === 'P' && el.textContent === texto;

const CFDI = 'CFDI · XML';
const CSV = 'Estado de cuenta';
const PROCESANDO = 'Procesando la carga…';

/** El POST de CFDI responde `cuerpo` con `status` (para los lotes que ya existían). */
function cfdiResponde(cuerpo: RespuestaCarga, status = 200) {
  servidor.use(
    http.post('/api/cargas/cfdi', () => HttpResponse.json(cuerpo, { status })),
  );
}

async function subirXml(...nombres: string[]) {
  const u = usuario();
  await u.upload(
    screen.getByLabelText('Elegir archivos'),
    (nombres.length > 0 ? nombres : ['a.xml']).map(xml),
  );
  await u.click(botonCfdi(Math.max(nombres.length, 1)));
}

/** Lo que `avanzar` puede reemplazar de un detalle, sin su id (el de la carga ya creada manda). */
const parcheDe = (d: DetalleCarga): ParcheDeCarga => ({
  totalRegistros: d.totalRegistros,
  registrosOk: d.registrosOk,
  registrosExistentes: d.registrosExistentes,
  registrosError: d.registrosError,
  resultados: d.resultados,
  errorMensaje: d.errorMensaje,
});

/** Id de la carga más nueva del almacén (la que acaba de crear el POST). */
const idDeLaUltima = () => almacenes.cargas.filas()[0]?.id ?? '';

const getDetalle = (espia: ReturnType<typeof espiarSolicitudes>) =>
  espia.solicitudes.filter(
    (s) => s.metodo === 'GET' && /^\/api\/cargas\/[^/]+$/.test(s.ruta),
  );

describe('CargasContenedor: resultados de la carga', () => {
  it('un CFDI nuevo: procesando, luego el resumen con una entrada por archivo y el motivo (8.1, M3)', async () => {
    const espia = espiarSolicitudes();
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml('a.xml', 'b.xml', 'c.xml');
    const region = regionDe(CFDI);
    expect(await within(region).findByText(PROCESANDO)).toBeInTheDocument();
    // Control positivo: el panel sí consulta GET /cargas/:id mientras está activa.
    await waitFor(() => expect(getDetalle(espia).length).toBeGreaterThan(0));
    const id = idDeLaUltima();
    almacenes.cargas.avanzar(id, 'procesando');
    const consultas = getDetalle(espia).length;
    await waitFor(() =>
      expect(getDetalle(espia).length).toBeGreaterThan(consultas),
    );
    expect(within(region).getByText(PROCESANDO)).toBeInTheDocument();
    expect(within(region).queryByRole('list')).toBeNull();
    const parche = parcheDe(detalleCfdiConErrores());
    almacenes.cargas.avanzar(id, 'con_errores', parche);
    expect(
      await within(region).findByText(
        resumen('1 nuevos, 1 ya existían, 1 con error.'),
      ),
    ).toBeInTheDocument();
    const filas = within(region).getAllByRole('listitem');
    expect(filas).toHaveLength(3);
    expect(filas[0]).toHaveTextContent('a.xml');
    expect(filas[0]).toHaveTextContent('Nuevo');
    expect(filas[1]).toHaveTextContent('Ya existía');
    expect(filas[2]).toHaveTextContent('c.xml');
    expect(filas[2]).toHaveTextContent('Con error');
    expect(filas[2]).toHaveTextContent('XML mal formado');
    expect(within(region).queryByText(PROCESANDO)).toBeNull();
    espia.detener();
  });

  it('el resultado de un CFDI vive en la tarjeta del CFDI y no en la del CSV', async () => {
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    await within(regionDe(CFDI)).findByText(PROCESANDO);
    expect(regionDe(CSV)).toBeEmptyDOMElement();
  });

  it('un estado de cuenta terminado: filas 4 y 17 y el resumen de registros (8.2)', async () => {
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivo'), csv('estado.csv'));
    await u.click(botonCsv());
    const region = regionDe(CSV);
    await within(region).findByText(PROCESANDO);
    const parche = parcheDe(detalleCsvConErrores());
    almacenes.cargas.avanzar(idDeLaUltima(), 'con_errores', parche);
    expect(
      await within(region).findByText(
        resumen('98 registros cargados, 2 con error.'),
      ),
    ).toBeInTheDocument();
    const filas = within(region).getAllByRole('listitem');
    expect(filas.map((f) => f.textContent?.replace('✕', ''))).toEqual([
      'Fila 4: Monto inválido',
      'Fila 17: Fecha vacía',
    ]);
    expect(regionDe(CFDI)).toBeEmptyDOMElement();
    // La cuenta nunca se muestra, ni escrita ni en el resultado.
    expect(region).not.toHaveTextContent('1234');
  });

  it.each([
    ['procesada', '0 nuevos, 2 ya existían, 0 con error.'],
    ['con_errores', '1 nuevos, 1 ya existían, 1 con error.'],
  ] as const)(
    'ya existía y terminó (%s): el aviso de K7 y debajo los resultados del POST, sin GET /cargas/:id (8.3, 8.4)',
    async (estado, texto) => {
      const espia = espiarSolicitudes();
      cfdiResponde(respuestaYaExistia(estado));
      montar(['admin'], POLLING_HOLGADO);
      await esperarPerfiles();
      await subirXml();
      const region = regionDe(CFDI);
      expect(
        await within(region).findByText('Este archivo ya se había cargado.'),
      ).toBeInTheDocument();
      // Mockup v27: bajo el aviso va el resultado de esa carga, del cuerpo del POST.
      expect(within(region).getByText(resumen(texto))).toBeInTheDocument();
      expect(
        within(region).getByRole('region', { name: 'Resultado por archivo' }),
      ).toBeInTheDocument();
      expect(within(region).getAllByRole('listitem').length).toBeGreaterThan(0);
      expect(
        within(region).getByText('No se duplicó nada.'),
      ).toBeInTheDocument();
      expect(within(region).queryByText(/puso en la cola/)).toBeNull();
      // Control positivo: la lista sí se volvió a pedir tras el POST.
      await waitFor(() =>
        expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(2),
      );
      await esperarIntervalos(4);
      expect(getDetalle(espia)).toHaveLength(0);
      espia.detener();
    },
  );

  it('ya existía y estaba pendiente: primero «se volvió a poner en la cola», luego el sondeo y los resultados (8.5)', async () => {
    const espia = espiarSolicitudes();
    const respuesta = respuestaYaExistia('pendiente');
    cfdiResponde(respuesta);
    almacenes.cargas.establecerDetalle(
      detalleCarga(1, { estado: 'pendiente' }),
    );
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    const region = regionDe(CFDI);
    const frase =
      'Este archivo ya se había cargado y se volvió a poner en la cola.';
    expect(await within(region).findByText(frase)).toBeInTheDocument();
    expect(within(region).getByText(PROCESANDO)).toBeInTheDocument();
    expect(within(region).queryByText('No se duplicó nada.')).toBeNull();
    await waitFor(() => expect(getDetalle(espia).length).toBeGreaterThan(0));
    almacenes.cargas.avanzar(respuesta.id, 'procesando');
    almacenes.cargas.avanzar(respuesta.id, 'procesada', {
      registrosOk: 2,
      resultados: [
        { archivo: 'a.xml', resultado: 'nuevo' },
        { archivo: 'b.xml', resultado: 'nuevo' },
      ],
    });
    expect(
      await within(region).findByText(
        resumen('2 nuevos, 0 ya existían, 0 con error.'),
      ),
    ).toBeInTheDocument();
    expect(within(region).queryByText(PROCESANDO)).toBeNull();
    // El aviso lo decide lo que respondió el POST, no el estado de ahora.
    expect(within(region).getByText(frase)).toBeInTheDocument();
    espia.detener();
  });

  it('una carga fallida: el chip Fallida y el aviso del mockup v27, el sondeo se detiene y no hay lista de archivos (8.6)', async () => {
    const espia = espiarSolicitudes();
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    const region = regionDe(CFDI);
    await within(region).findByText(PROCESANDO);
    await waitFor(() => expect(getDetalle(espia).length).toBeGreaterThan(0));
    almacenes.cargas.avanzar(idDeLaUltima(), 'fallida', {
      errorMensaje: 'Falló el worker',
    });
    expect(
      await within(region).findByText(
        'La carga falló por un problema del sistema. Vuelve a subir el archivo para reintentar.',
      ),
    ).toBeInTheDocument();
    expect(within(region).getByText('Fallida')).toBeInTheDocument();
    // El backend escribe siempre un mensaje fijo: el mockup v27 no lo muestra.
    expect(within(region).queryByText('Falló el worker')).toBeNull();
    expect(within(region).queryByRole('list')).toBeNull();
    expect(within(region).queryByText(PROCESANDO)).toBeNull();
    const consultas = getDetalle(espia).length;
    await esperarIntervalos(4);
    expect(getDetalle(espia)).toHaveLength(consultas);
    espia.detener();
  });

  it('las filas del historial nunca piden GET /cargas/:id (8.8)', async () => {
    const espia = espiarSolicitudes();
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    // Control positivo: la lectura de la lista sí salió y trajo filas.
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/cargas')).toBeGreaterThanOrEqual(1),
    );
    expect(almacenes.cargas.filas().length).toBeGreaterThan(0);
    await esperarIntervalos(4);
    expect(getDetalle(espia)).toHaveLength(0);
    expect(regionDe(CFDI)).toBeEmptyDOMElement();
    expect(regionDe(CSV)).toBeEmptyDOMElement();
    espia.detener();
  });

  it('una segunda subida con éxito reemplaza el panel (8.9)', async () => {
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml('a.xml');
    const region = regionDe(CFDI);
    await within(region).findByText(PROCESANDO);
    const parche = parcheDe(detalleCfdiConErrores());
    almacenes.cargas.avanzar(idDeLaUltima(), 'con_errores', parche);
    await within(region).findByText(
      resumen('1 nuevos, 1 ya existían, 1 con error.'),
    );
    await subirXml('z.xml');
    expect(await within(region).findByText(PROCESANDO)).toBeInTheDocument();
    expect(
      within(region).queryByText(
        resumen('1 nuevos, 1 ya existían, 1 con error.'),
      ),
    ).toBeNull();
    expect(within(region).queryByRole('list')).toBeNull();
  });

  it('la región de estado es la misma antes y después del resultado', async () => {
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    const antes = regionDe(CFDI);
    await subirXml();
    await within(regionDe(CFDI)).findByText(PROCESANDO);
    expect(regionDe(CFDI)).toBe(antes);
  });

  it('si la época cambia con la subida en vuelo no aparece nada en la nueva (9.2)', async () => {
    const espia = espiarSolicitudes();
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    let epoca = 1;
    const sesion = (): SessionState =>
      ({ ...sesionConRoles(['admin']), epoca }) as SessionState;
    const { rerender } = montar(['admin'], POLLING_HOLGADO, sesion);
    await esperarPerfiles();
    await subirXml();
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    epoca = 2;
    rerender(<CargasContenedor />);
    compuerta.abrir();
    // Control positivo: el POST sí terminó y el servidor creó la carga.
    await waitFor(() => expect(almacenes.cargas.filas()[0]?.id).toBeTruthy());
    await esperarIntervalos(4);
    expect(within(regionDe(CFDI)).queryByText(PROCESANDO)).toBeNull();
    expect(regionDe(CFDI)).toBeEmptyDOMElement();
    expect(getDetalle(espia)).toHaveLength(0);
    espia.detener();
  });

  it('un panel de una época anterior desaparece al cambiar la sesión (9.2)', async () => {
    let epoca = 1;
    const sesion = (): SessionState =>
      ({ ...sesionConRoles(['admin']), epoca }) as SessionState;
    const { rerender } = montar(['admin'], POLLING_HOLGADO, sesion);
    await esperarPerfiles();
    await subirXml();
    await within(regionDe(CFDI)).findByText(PROCESANDO);
    epoca = 2;
    rerender(<CargasContenedor />);
    await waitFor(() => expect(regionDe(CFDI)).toBeEmptyDOMElement());
  });

  it('un texto con marcado que manda el servidor se queda como texto (8.7)', async () => {
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    const region = regionDe(CFDI);
    await within(region).findByText(PROCESANDO);
    almacenes.cargas.avanzar(idDeLaUltima(), 'con_errores', {
      registrosError: 1,
      registrosOk: 0,
      registrosExistentes: 0,
      resultados: [
        {
          archivo: '<b>x</b>.xml',
          resultado: 'error',
          motivo: '<img src=x onerror=alert(1)>',
        },
      ],
    });
    expect(await within(region).findByText('<b>x</b>.xml')).toBeInTheDocument();
    expect(
      within(region).getByText('<img src=x onerror=alert(1)>'),
    ).toBeInTheDocument();
    expect(region.querySelector('img')).toBeNull();
    expect(region.querySelector('b')).toBeNull();
  });
});

afterEach(() => {
  focusManager.setFocused(undefined);
});

/** La alerta (role=alert) de una tarjeta; `null` si no hay. */
const sinAlertaEn = (titulo: string) =>
  within(tarjeta(titulo)).queryByRole('alert');

async function subirCsv() {
  const u = usuario();
  await u.upload(screen.getByLabelText('Elegir archivo'), csv('estado.csv'));
  await u.click(botonCsv());
}

describe('CargasContenedor: alertas de una subida que falla', () => {
  it('400: el motivo del servidor como texto, en la tarjeta que subió, con la selección intacta y el foco en la alerta (10.1)', async () => {
    servidor.use(
      ...subidaFalla(
        400,
        'El encabezado del CSV no coincide con el perfil banco-norte.',
      ),
    );
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirCsv();
    const alerta = await within(tarjeta(CSV)).findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo procesar la carga.');
    expect(alerta).toHaveTextContent(
      'El encabezado del CSV no coincide con el perfil banco-norte.',
    );
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(botonCsv()).toBeEnabled();
    expect(screen.getByRole('listitem')).toHaveTextContent('estado.csv');
    expect(sinAlertaEn(CFDI)).toBeNull();
    expect(regionDe(CSV)).toBeEmptyDOMElement();
  });

  it('400 sin motivo: solo el título, sin línea de detalle (10.1)', async () => {
    servidor.use(...subidaFalla(400, ''));
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirCsv();
    expect(await within(tarjeta(CSV)).findByRole('alert')).toHaveTextContent(
      /^No se pudo procesar la carga\.$/,
    );
  });

  it('un motivo con marcado queda como texto: no hay elemento script (10.2)', async () => {
    servidor.use(...subidaFalla(400, '<script>x</script>'));
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirCsv();
    const alerta = await within(tarjeta(CSV)).findByRole('alert');
    expect(within(alerta).getByText('<script>x</script>')).toBeInTheDocument();
    expect(alerta.querySelector('script')).toBeNull();
  });

  it.each([
    ['con cuerpo de Nest', () => subidaFalla(413)],
    ['con el HTML de un proxy', () => subida413Html()],
  ])(
    '413 %s: los archivos pesan demasiado, en la tarjeta de CFDI (10.3)',
    async (_, manejadores) => {
      servidor.use(...manejadores());
      montar(['admin'], POLLING_HOLGADO);
      await esperarPerfiles();
      await subirXml('a.xml', 'b.xml');
      const alerta = await within(tarjeta(CFDI)).findByRole('alert');
      expect(alerta).toHaveTextContent('Los archivos pesan demasiado.');
      expect(alerta).toHaveTextContent(
        'Divide la carga en partes más pequeñas e inténtalo de nuevo.',
      );
      expect(alerta).not.toHaveTextContent('detalle del servidor');
      expect(botonCfdi(2)).toBeEnabled();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    },
  );

  it('403: el texto de permiso, sin el código del servidor, y la pantalla sigue lista (10.4)', async () => {
    servidor.use(...subidaFalla(403, 'acceso_denegado'));
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    const alerta = await within(tarjeta(CFDI)).findByRole('alert');
    expect(alerta).toHaveTextContent('No tienes permiso para esta acción.');
    expect(alerta).toHaveTextContent(
      'Si crees que es un error, pide acceso a un administrador de la empresa.',
    );
    expect(screen.queryByText(/acceso_denegado/)).toBeNull();
    expect(botonCfdi(1)).toBeEnabled();
    expect(
      screen.queryByText('Tu rol solo permite consultar las cargas.'),
    ).toBeNull();
  });

  it('fallo de red: el texto de conectividad, Reintentar vuelve a enviar y la alerta desaparece al enviar (10.5, 10.7)', async () => {
    const espia = espiarSolicitudes();
    servidor.use(...subidaRedDeFallo());
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml('a.xml');
    const alerta = await within(tarjeta(CFDI)).findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(alerta).toHaveTextContent(
      'Revisa tu conexión e inténtalo de nuevo.',
    );
    expect(espia.cuantas('POST', '/api/cargas/cfdi')).toBe(1);
    servidor.resetHandlers();
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    await usuario().click(
      within(alerta).getByRole('button', { name: REINTENTAR }),
    );
    await waitFor(() =>
      expect(espia.cuantas('POST', '/api/cargas/cfdi')).toBe(2),
    );
    // Mientras el reintento vuela la alerta ya no está.
    expect(sinAlertaEn(CFDI)).toBeNull();
    compuerta.abrir();
    expect(
      await within(regionDe(CFDI)).findByText(PROCESANDO),
    ).toBeInTheDocument();
    expect(sinAlertaEn(CFDI)).toBeNull();
    espia.detener();
  });

  it('solo la conexión ofrece Reintentar: un 403 no (10.4)', async () => {
    servidor.use(...subidaFalla(403));
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    const alerta = await within(tarjeta(CFDI)).findByRole('alert');
    expect(within(alerta).queryByRole('button')).toBeNull();
  });

  it('un 500: alerta de error inesperado en la tarjeta que subió, sin Reintentar, con el foco, la selección intacta y los controles activos (10.5, mockup v25)', async () => {
    servidor.use(...subidaFalla(500));
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    const alerta = await within(tarjeta(CFDI)).findByRole('alert');
    expect(alerta).toHaveTextContent('No se pudo completar la solicitud.');
    expect(alerta).toHaveTextContent(
      'Tus archivos siguen seleccionados. Inténtalo de nuevo en unos minutos.',
    );
    expect(within(alerta).queryByRole('button')).toBeNull();
    await waitFor(() => expect(alerta).toHaveFocus());
    expect(botonCfdi(1)).toBeEnabled();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(sinAlertaEn(CSV)).toBeNull();
    expect(regionDe(CFDI)).toBeEmptyDOMElement();
  });

  it('un 401 no pinta mensaje: la capa de sesión decide (10.6)', async () => {
    const espia = espiarSolicitudes();
    servidor.use(...subidaFalla(401));
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    // Control positivo: el POST salió y volvió con 401.
    await waitFor(() =>
      expect(espia.cuantas('POST', '/api/cargas/cfdi')).toBe(1),
    );
    await waitFor(() => expect(botonCfdi(1)).toBeEnabled());
    await esperarIntervalos(3);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(regionDe(CFDI)).toBeEmptyDOMElement();
    espia.detener();
  });

  it('una subida nueva quita la alerta anterior y, si funciona, no queda rastro del fallo (10.7)', async () => {
    servidor.use(...subidaFalla(403));
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    await within(tarjeta(CFDI)).findByRole('alert');
    servidor.resetHandlers();
    const compuerta = crearCompuerta();
    almacenes.cargas.compuertas({ subida: compuerta.promesa });
    await usuario().click(botonCfdi(1));
    await screen.findByRole('button', { name: 'Subiendo…' });
    expect(screen.queryByRole('alert')).toBeNull();
    compuerta.abrir();
    await within(regionDe(CFDI)).findByText(PROCESANDO);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('un fallo no crea panel de éxito: la región queda vacía (10.7)', async () => {
    servidor.use(...subidaFalla(413));
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    await within(tarjeta(CFDI)).findByRole('alert');
    await esperarIntervalos(3);
    expect(regionDe(CFDI)).toBeEmptyDOMElement();
  });

  it('un fallo de una tarjeta no toca la otra ni su resultado', async () => {
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirCsv();
    await within(regionDe(CSV)).findByText(PROCESANDO);
    servidor.use(...subidaFalla(413));
    await subirXml();
    await within(tarjeta(CFDI)).findByRole('alert');
    expect(sinAlertaEn(CSV)).toBeNull();
    expect(within(regionDe(CSV)).getByText(PROCESANDO)).toBeInTheDocument();
  });

  it('si la época cambia la alerta de la anterior no se muestra (CRG-9)', async () => {
    servidor.use(...subidaFalla(403));
    let epoca = 1;
    const sesion = (): SessionState =>
      ({ ...sesionConRoles(['admin']), epoca }) as SessionState;
    const { rerender } = montar(['admin'], POLLING_HOLGADO, sesion);
    await esperarPerfiles();
    await subirXml();
    await within(tarjeta(CFDI)).findByRole('alert');
    epoca = 2;
    rerender(<CargasContenedor />);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

/** Tope diminuto: venció tras unos pocos intervalos. */
const POLLING_CON_TOPE: ConfigPolling = { intervaloMs: 15, topeMs: 120 };
const SIN_ACTUALIZAR = 'La lista dejó de actualizarse.';

const botonActualizar = () =>
  within(regionDe(CFDI)).queryByRole('button', { name: 'Actualizar' });

describe('CargasContenedor: tope del polling y Actualizar', () => {
  it('antes del tope no hay «Actualizar» y el panel sigue pidiendo su detalle (11.4, K5)', async () => {
    const espia = espiarSolicitudes();
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    const region = regionDe(CFDI);
    await within(region).findByText(PROCESANDO);
    // Control positivo: el sondeo del panel está corriendo.
    await waitFor(() => expect(getDetalle(espia).length).toBeGreaterThan(2));
    expect(botonActualizar()).toBeNull();
    expect(within(region).queryByText(SIN_ACTUALIZAR)).toBeNull();
    espia.detener();
  });

  it('al vencer el tope una carga pendiente queda como está: aviso con «Actualizar» y ya no pide nada solo (11.3)', async () => {
    const espia = espiarSolicitudes();
    montar(['admin'], POLLING_CON_TOPE);
    await esperarPerfiles();
    await subirXml();
    const region = regionDe(CFDI);
    expect(await within(region).findByText(SIN_ACTUALIZAR)).toBeInTheDocument();
    expect(botonActualizar()).toBeInTheDocument();
    // La barra de proceso cede su lugar al aviso (mockup resultado_sin_actualizar).
    expect(within(region).queryByText(PROCESANDO)).toBeNull();
    // Control positivo: antes del tope sí hubo sondeo del panel.
    expect(getDetalle(espia).length).toBeGreaterThan(1);
    const detalle = getDetalle(espia).length;
    const lista = espia.cuantas('GET', '/api/cargas');
    await esperarIntervalos(5);
    expect(getDetalle(espia)).toHaveLength(detalle);
    expect(espia.cuantas('GET', '/api/cargas')).toBe(lista);
    // La carga sigue pendiente: nada la movió.
    expect(almacenes.cargas.filas()[0]?.estado).toBe('pendiente');
    espia.detener();
  });

  it('«Actualizar» vuelve a pedir, oculta el aviso y abre otra ventana de sondeo (11.5)', async () => {
    const espia = espiarSolicitudes();
    montar(['admin'], POLLING_CON_TOPE);
    await esperarPerfiles();
    await subirXml();
    const region = regionDe(CFDI);
    await within(region).findByText(SIN_ACTUALIZAR);
    const antes = getDetalle(espia).length;
    await usuario().click(botonActualizar() as HTMLElement);
    // El aviso se oculta y la carga activa vuelve a verse como en proceso.
    expect(await within(region).findByText(PROCESANDO)).toBeInTheDocument();
    expect(within(region).queryByText(SIN_ACTUALIZAR)).toBeNull();
    // Pidió de inmediato y la ventana nueva sigue sondeando por su cuenta.
    await waitFor(() =>
      expect(getDetalle(espia).length).toBeGreaterThanOrEqual(antes + 3),
    );
    // La ventana nueva también vence.
    expect(await within(region).findByText(SIN_ACTUALIZAR)).toBeInTheDocument();
    espia.detener();
  });

  it('si la carga termina antes del tope no hay aviso ni botón: manda el resultado (11.4)', async () => {
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    const region = regionDe(CFDI);
    await within(region).findByText(PROCESANDO);
    almacenes.cargas.avanzar(
      idDeLaUltima(),
      'con_errores',
      parcheDe(detalleCfdiConErrores()),
    );
    await within(region).findByText(
      resumen('1 nuevos, 1 ya existían, 1 con error.'),
    );
    expect(botonActualizar()).toBeNull();
    expect(within(region).queryByText(SIN_ACTUALIZAR)).toBeNull();
  });

  it('con la pestaña oculta no pide solo y al volver sigue (11.6)', async () => {
    const espia = espiarSolicitudes();
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    await within(regionDe(CFDI)).findByText(PROCESANDO);
    await waitFor(() => expect(getDetalle(espia).length).toBeGreaterThan(1));
    act(() => focusManager.setFocused(false));
    // Deja pasar una petición en vuelo antes de medir.
    await esperarIntervalos(3);
    const congeladas = getDetalle(espia).length;
    await esperarIntervalos(5);
    expect(getDetalle(espia)).toHaveLength(congeladas);
    act(() => focusManager.setFocused(true));
    await waitFor(() =>
      expect(getDetalle(espia).length).toBeGreaterThan(congeladas),
    );
    espia.detener();
  });

  it('un sondeo del panel que falla no borra el panel ni pinta una alerta (11.9)', async () => {
    servidor.use(detalleFalla(500));
    montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    const region = regionDe(CFDI);
    await within(region).findByText(PROCESANDO);
    await esperarIntervalos(4);
    expect(within(region).getByText(PROCESANDO)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('desmontado con el panel activo no queda ningún temporizador pidiendo (11.8)', async () => {
    const espia = espiarSolicitudes();
    const errores = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { unmount } = montar(['admin'], POLLING_HOLGADO);
    await esperarPerfiles();
    await subirXml();
    await within(regionDe(CFDI)).findByText(PROCESANDO);
    await waitFor(() => expect(getDetalle(espia).length).toBeGreaterThan(1));
    unmount();
    // Una petición ya en vuelo puede terminar; las siguientes no deben salir.
    await esperarIntervalos(3);
    const tras = getDetalle(espia).length;
    const lista = espia.cuantas('GET', '/api/cargas');
    await esperarIntervalos(5);
    expect(getDetalle(espia)).toHaveLength(tras);
    expect(espia.cuantas('GET', '/api/cargas')).toBe(lista);
    expect(errores).not.toHaveBeenCalled();
    errores.mockRestore();
    espia.detener();
  });

  it('un sondeo pendiente cuando cambia la época se ignora (11.7)', async () => {
    const compuerta = crearCompuerta();
    let epoca = 1;
    const sesion = (): SessionState =>
      ({ ...sesionConRoles(['admin']), epoca }) as SessionState;
    const { rerender } = montar(['admin'], POLLING_HOLGADO, sesion);
    await esperarPerfiles();
    await subirXml();
    await within(regionDe(CFDI)).findByText(PROCESANDO);
    // El detalle queda retenido: hay un sondeo pendiente al cambiar de época.
    almacenes.cargas.compuertas({ detalle: compuerta.promesa });
    await esperarIntervalos(3);
    epoca = 2;
    rerender(<CargasContenedor />);
    await waitFor(() => expect(regionDe(CFDI)).toBeEmptyDOMElement());
    almacenes.cargas.avanzar(
      idDeLaUltima(),
      'con_errores',
      parcheDe(detalleCfdiConErrores()),
    );
    compuerta.abrir();
    await esperarIntervalos(4);
    expect(regionDe(CFDI)).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
