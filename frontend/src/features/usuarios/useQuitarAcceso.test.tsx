import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { clienteDePruebas, envoltura } from '@/test/montarBandeja';
import {
  accionRolesFalla,
  accionesRolesRecibidas,
  personaActiva,
  usarHandlersUsuarios,
} from '@/test/handlersUsuarios';
import { servidor } from '@/test/servidor';
import { useQuitarAcceso } from './useQuitarAcceso';
import { useUsuarios } from './useUsuarios';

const ID = '55555555-5555-4555-8555-555555555551';
const RUTA = `/api/usuarios/${ID}/roles`;

async function listaCargada() {
  let pedidas = 0;
  servidor.use(
    http.get('/api/usuarios', () => {
      pedidas += 1;
      return HttpResponse.json([]);
    }),
  );
  const cliente = clienteDePruebas();
  const lista = renderHook(() => useUsuarios(true), {
    wrapper: envoltura(cliente),
  });
  await waitFor(() => expect(lista.result.current.isSuccess).toBe(true));
  return { cliente, pedidas: () => pedidas };
}

describe('useQuitarAcceso', () => {
  it('manda DELETE sobre el id, devuelve la respuesta y refresca la lista', async () => {
    servidor.use(
      http.delete(RUTA, () =>
        HttpResponse.json({ id: ID, email: 'luis@ferreteria.mx', roles: [] }),
      ),
    );
    const { cliente, pedidas } = await listaCargada();
    const accion = renderHook(() => useQuitarAcceso(), {
      wrapper: envoltura(cliente),
    });
    accion.result.current.mutate(ID);
    await waitFor(() => expect(accion.result.current.isSuccess).toBe(true));
    expect(accion.result.current.data?.roles).toEqual([]);
    await waitFor(() => expect(pedidas()).toBe(2));
  });

  it('un 409 llega como ApiError y no refresca la lista', async () => {
    servidor.use(
      http.delete(RUTA, () =>
        HttpResponse.json(
          { statusCode: 409, error: 'Conflict', message: 'x' },
          { status: 409 },
        ),
      ),
    );
    const { cliente, pedidas } = await listaCargada();
    const accion = renderHook(() => useQuitarAcceso(), {
      wrapper: envoltura(cliente),
    });
    accion.result.current.mutate(ID);
    await waitFor(() => expect(accion.result.current.isError).toBe(true));
    expect(accion.result.current.error).toBeInstanceOf(ApiError);
    expect(pedidas()).toBe(1);
  });

  it('con los handlers compartidos la lista deja de traer a la persona', async () => {
    usarHandlersUsuarios([
      personaActiva(),
      personaActiva({
        id: ID,
        email: 'luis@ferreteria.mx',
        roles: ['revisor'],
      }),
    ]);
    const cliente = clienteDePruebas();
    const lista = renderHook(() => useUsuarios(true), {
      wrapper: envoltura(cliente),
    });
    await waitFor(() => expect(lista.result.current.data).toHaveLength(2));
    const accion = renderHook(() => useQuitarAcceso(), {
      wrapper: envoltura(cliente),
    });
    accion.result.current.mutate(ID);
    await waitFor(() => expect(lista.result.current.data).toHaveLength(1));
    expect(accionesRolesRecibidas).toEqual([{ accion: 'quitar', id: ID }]);
  });

  it('accionRolesFalla fuerza el 409 del único administrador', async () => {
    usarHandlersUsuarios([personaActiva({ id: ID })]);
    accionRolesFalla('quitar', 409);
    const cliente = clienteDePruebas();
    const accion = renderHook(() => useQuitarAcceso(), {
      wrapper: envoltura(cliente),
    });
    accion.result.current.mutate(ID);
    await waitFor(() => expect(accion.result.current.isError).toBe(true));
  });
});
