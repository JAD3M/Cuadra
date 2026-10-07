import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError } from '@/shared/api';
import { USUARIOS_BITACORA } from '@/test/fixturesBitacora';
import { almacenes } from '@/test/handlers';
import {
  usuariosFalla,
  usuariosFueraDeContrato,
  usuariosRedDeFallo,
} from '@/test/handlersBitacora';
import {
  clienteDePruebas,
  envoltura,
  sesionConEpoca,
} from '@/test/montarBandeja';
import { esperarIntervalos } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { clavesBitacora } from './claves';
import { useUsuariosBitacora } from './useUsuariosBitacora';

const bitacora = almacenes.bitacora;

const peticionesUsuarios = () =>
  bitacora.peticiones().filter((p) => p.ruta === '/api/bitacora/usuarios');

describe('useUsuariosBitacora', () => {
  it('pide GET /bitacora/usuarios una vez y entrega id y nombre, en su orden', async () => {
    const cliente = clienteDePruebas();
    const { result } = renderHook(() => useUsuariosBitacora(), {
      wrapper: envoltura(cliente),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(
      USUARIOS_BITACORA.map(({ id, nombre }) => ({ id, nombre })),
    );
    expect(peticionesUsuarios()).toEqual([
      { metodo: 'GET', ruta: '/api/bitacora/usuarios', consulta: {} },
    ]);
    expect(cliente.getQueryData(clavesBitacora.usuarios(1))).toBe(
      result.current.data,
    );
  });

  it('nunca entrega el correo', async () => {
    const { result } = renderHook(() => useUsuariosBitacora(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(JSON.stringify(result.current.data)).not.toMatch(/email|@/);
  });

  it('una lista vacía es un éxito vacío', async () => {
    bitacora.establecerUsuarios([]);
    const { result } = renderHook(() => useUsuariosBitacora(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('está deshabilitado mientras la sesión no está lista', async () => {
    const { result } = renderHook(() => useUsuariosBitacora(), {
      wrapper: envoltura(clienteDePruebas(), () => ({
        status: 'loading',
        restaurarOrigen: false,
      })),
    });
    await esperarIntervalos();
    expect(result.current.fetchStatus).toBe('idle');
    expect(peticionesUsuarios()).toEqual([]);
  });

  it('un cuerpo fuera del contrato es ContratoError', async () => {
    servidor.use(usuariosFueraDeContrato());
    const { result } = renderHook(() => useUsuariosBitacora(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ContratoError);
    expect(result.current.data).toBeUndefined();
  });

  it('un 500 llega como ApiError y un corte de red como error', async () => {
    servidor.use(usuariosFalla(500));
    const conFallo = renderHook(() => useUsuariosBitacora(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(conFallo.result.current.isError).toBe(true));
    expect(conFallo.result.current.error).toBeInstanceOf(ApiError);

    servidor.use(usuariosRedDeFallo());
    const sinRed = renderHook(() => useUsuariosBitacora(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(sinRed.result.current.isError).toBe(true));
    expect(sinRed.result.current.data).toBeUndefined();
  });

  it('otra época vuelve a pedir y no sirve la lista de la anterior', async () => {
    let estado = sesionConEpoca(1);
    const { result, rerender } = renderHook(() => useUsuariosBitacora(), {
      wrapper: envoltura(clienteDePruebas(), () => estado),
    });
    await waitFor(() => expect(result.current.data).toHaveLength(3));
    bitacora.establecerUsuarios(USUARIOS_BITACORA.slice(0, 1));
    estado = sesionConEpoca(2);
    rerender();
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(peticionesUsuarios()).toHaveLength(2);
  });
});
