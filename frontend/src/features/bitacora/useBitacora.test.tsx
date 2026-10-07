import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError } from '@/shared/api';
import { crearCompuerta } from '@/test/compuerta';
import { EVENTOS_MAQUETA, generarEventos } from '@/test/fixturesBitacora';
import { almacenes } from '@/test/handlers';
import {
  listaFalla,
  listaFueraDeContrato,
  listaRedDeFallo,
} from '@/test/handlersBitacora';
import {
  clienteDePruebas,
  envoltura,
  sesionConEpoca,
} from '@/test/montarBandeja';
import { esperarIntervalos } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { clavesBitacora } from './claves';
import { armarConsulta, type ConsultaBitacora } from './consulta';
import { useBitacora } from './useBitacora';

const bitacora = almacenes.bitacora;
const UUID = '3f2b7c1e-9a4d-4e6b-8c15-2d7a90b4e1f3';

/** Las peticiones del listado (no las de usuarios). */
const peticionesLista = () =>
  bitacora.peticiones().filter((p) => p.ruta === '/api/bitacora');

const PRIMERA: ConsultaBitacora = { pagina: 1, limite: 50 };

describe('useBitacora', () => {
  it('pide la consulta tal cual y deja la página en la clave de su época', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    const cliente = clienteDePruebas();
    const { result } = renderHook(() => useBitacora(PRIMERA), {
      wrapper: envoltura(cliente),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(peticionesLista()).toEqual([
      {
        metodo: 'GET',
        ruta: '/api/bitacora',
        consulta: { pagina: '1', limite: '50' },
      },
    ]);
    expect(result.current.data).toMatchObject({
      pagina: 1,
      limite: 50,
      total: 7,
    });
    expect(cliente.getQueryData(clavesBitacora.lista(1, PRIMERA))).toBe(
      result.current.data,
    );
  });

  it('envía cada filtro con su nombre de la API y nada más', async () => {
    const consulta: ConsultaBitacora = {
      entidad: 'companies',
      accion: 'actualizar',
      userId: UUID,
      desde: '2026-09-01T06:00:00.000Z',
      hasta: '2026-10-01T06:00:00.000Z',
      pagina: 2,
      limite: 50,
    };
    const { result } = renderHook(() => useBitacora(consulta), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(peticionesLista().map((p) => p.consulta)).toEqual([
      {
        entidad: 'companies',
        accion: 'actualizar',
        userId: UUID,
        desde: '2026-09-01T06:00:00.000Z',
        hasta: '2026-10-01T06:00:00.000Z',
        pagina: '2',
        limite: '50',
      },
    ]);
  });

  it('el mismo día en ambos lados llega al servidor como un día completo, sin 400', async () => {
    const consulta = armarConsulta({
      desde: '2026-09-18',
      hasta: '2026-09-18',
      pagina: 1,
    });
    const { result } = renderHook(() => useBitacora(consulta), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(peticionesLista()).toHaveLength(1);
  });

  it('el contrato descarta ip, userAgent y el correo', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    const { result } = renderHook(() => useBitacora(PRIMERA), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const texto = JSON.stringify(result.current.data);
    expect(texto).not.toMatch(/userAgent|"ip"|email|@despacho\.mx/);
    expect(result.current.data?.datos[0]?.usuario).toEqual({
      nombre: 'Luis Reyes',
    });
  });

  it('una consulta nula (rango invertido) no envía nada y queda apagada', async () => {
    const { result } = renderHook(() => useBitacora(null), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await esperarIntervalos();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(peticionesLista()).toEqual([]);
  });

  it('está deshabilitado mientras la sesión no está lista', async () => {
    const { result } = renderHook(() => useBitacora(PRIMERA), {
      wrapper: envoltura(clienteDePruebas(), () => ({
        status: 'loading',
        restaurarOrigen: false,
      })),
    });
    await esperarIntervalos();
    expect(result.current.fetchStatus).toBe('idle');
    expect(peticionesLista()).toEqual([]);
  });

  it('un cuerpo fuera del contrato es ContratoError y no se usa como dato', async () => {
    servidor.use(listaFueraDeContrato());
    const { result } = renderHook(() => useBitacora(PRIMERA), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ContratoError);
    expect(result.current.data).toBeUndefined();
  });

  it('un 403 llega como ApiError con su estado', async () => {
    servidor.use(listaFalla(403));
    const { result } = renderHook(() => useBitacora(PRIMERA), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).statusCode).toBe(403);
  });

  it('un fallo de red es un error y no deja datos', async () => {
    servidor.use(listaRedDeFallo());
    const { result } = renderHook(() => useBitacora(PRIMERA), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('conserva las filas anteriores mientras carga la página siguiente', async () => {
    bitacora.establecer(generarEventos(120));
    const { result, rerender } = renderHook(
      ({ consulta }) => useBitacora(consulta),
      {
        wrapper: envoltura(clienteDePruebas()),
        initialProps: { consulta: PRIMERA },
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const primera = result.current.data;
    const compuerta = crearCompuerta();
    bitacora.compuertas({ lista: compuerta.promesa });
    rerender({ consulta: { pagina: 2, limite: 50 } });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toBe(primera);
    compuerta.abrir();
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.data?.pagina).toBe(2);
    expect(result.current.data?.total).toBe(120);
  });

  it('al pasar a un rango invertido no se quedan las filas de antes', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    const { result, rerender } = renderHook<
      ReturnType<typeof useBitacora>,
      { consulta: ConsultaBitacora | null }
    >(({ consulta }) => useBitacora(consulta), {
      wrapper: envoltura(clienteDePruebas()),
      initialProps: { consulta: PRIMERA },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ consulta: null });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);
    expect(peticionesLista()).toHaveLength(1);
  });

  it('no reutiliza como provisional lo de otra época', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    let estado = sesionConEpoca(1);
    const { result, rerender } = renderHook(() => useBitacora(PRIMERA), {
      wrapper: envoltura(clienteDePruebas(), () => estado),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const compuerta = crearCompuerta();
    bitacora.compuertas({ lista: compuerta.promesa });
    estado = sesionConEpoca(2);
    rerender();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);
    expect(result.current.isPending).toBe(true);
    compuerta.abrir();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('lo cargado en la época 1 no se sirve en la época 2', async () => {
    const cliente = clienteDePruebas();
    let estado = sesionConEpoca(1);
    bitacora.establecer(EVENTOS_MAQUETA);
    const { result, rerender } = renderHook(() => useBitacora(PRIMERA), {
      wrapper: envoltura(cliente, () => estado),
    });
    await waitFor(() => expect(result.current.data?.total).toBe(7));
    bitacora.establecer([]);
    estado = sesionConEpoca(2);
    rerender();
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.total).toBe(0));
    expect(peticionesLista()).toHaveLength(2);
    expect(
      cliente.getQueryData(clavesBitacora.lista(1, PRIMERA)),
    ).toMatchObject({ total: 7 });
  });
});
