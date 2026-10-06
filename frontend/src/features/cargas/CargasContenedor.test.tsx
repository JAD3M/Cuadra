import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { contextoSesion } from '@/shared/api/contratos';
import type { SessionState } from '@/shared/sesion';
import { crearCompuerta } from '@/test/compuerta';
import { CONTEXTO_SESION, SESION_LISTA } from '@/test/fixtures';
import { almacenes } from '@/test/handlers';
import { espiarSolicitudes } from '@/test/handlersAuth';
import {
  perfilesFalla,
  subidaFalla,
  subidaRedDeFallo,
} from '@/test/handlersCargas';
import { clienteDePruebas } from '@/test/montarBandeja';
import { envolturaCargas, esperarIntervalos } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { CargasContenedor } from './CargasContenedor';

function sesionConRoles(roles: string[]): SessionState {
  return {
    ...SESION_LISTA,
    contexto: contextoSesion.parse({ ...CONTEXTO_SESION, roles }),
  } as SessionState;
}

function montar(roles: string[] = ['admin', 'contador']) {
  const estado = sesionConRoles(roles);
  return render(<CargasContenedor />, {
    wrapper: envolturaCargas(clienteDePruebas(), () => estado),
  });
}

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
    expect(screen.queryByRole('table')).toBeNull();
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

  it('si los perfiles no cargaron oculta el campo y el POST no manda perfil (4.5)', async () => {
    servidor.use(perfilesFalla(500));
    const espia = espiarSolicitudes();
    montar();
    await waitFor(() =>
      expect(espia.cuantas('GET', '/api/bancos/perfiles')).toBe(1),
    );
    await esperarIntervalos(3);
    expect(screen.queryByLabelText('Perfil de lectura')).toBeNull();
    const u = usuario();
    await u.upload(screen.getByLabelText('Elegir archivo'), csv('estado.csv'));
    await u.click(botonCsv());
    await waitFor(() => expect(almacenes.cargas.subidas()).toHaveLength(1));
    expect(almacenes.cargas.subidas()[0]?.campos).toEqual([]);
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
