import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { clienteDePruebas, envoltura } from '@/test/montarBandeja';
import { personaActiva, usarHandlersUsuarios } from '@/test/handlersUsuarios';
import { servidor } from '@/test/servidor';
import { useCambiarRoles } from './useCambiarRoles';
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

describe('useCambiarRoles', () => {
  it('manda PATCH con los roles, devuelve la respuesta y refresca la lista', async () => {
    let cuerpo: unknown;
    servidor.use(
      http.patch(RUTA, async ({ request }) => {
        cuerpo = await request.json();
        return HttpResponse.json({
          id: ID,
          email: 'luis@ferreteria.mx',
          roles: ['contador', 'revisor'],
        });
      }),
    );
    const { cliente, pedidas } = await listaCargada();
    const accion = renderHook(() => useCambiarRoles(), {
      wrapper: envoltura(cliente),
    });
    accion.result.current.mutate({ id: ID, roles: ['contador', 'revisor'] });
    await waitFor(() => expect(accion.result.current.isSuccess).toBe(true));
    expect(cuerpo).toEqual({ roles: ['contador', 'revisor'] });
    expect(accion.result.current.data?.roles).toEqual(['contador', 'revisor']);
    await waitFor(() => expect(pedidas()).toBe(2));
  });

  it('un 409 llega como ApiError y no refresca la lista', async () => {
    servidor.use(
      http.patch(RUTA, () =>
        HttpResponse.json(
          { statusCode: 409, error: 'Conflict', message: 'x' },
          { status: 409 },
        ),
      ),
    );
    const { cliente, pedidas } = await listaCargada();
    const accion = renderHook(() => useCambiarRoles(), {
      wrapper: envoltura(cliente),
    });
    accion.result.current.mutate({ id: ID, roles: ['revisor'] });
    await waitFor(() => expect(accion.result.current.isError).toBe(true));
    expect(accion.result.current.error).toBeInstanceOf(ApiError);
    expect(pedidas()).toBe(1);
  });

  it('con los handlers compartidos la lista refleja los roles nuevos', async () => {
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
    const accion = renderHook(() => useCambiarRoles(), {
      wrapper: envoltura(cliente),
    });
    accion.result.current.mutate({ id: ID, roles: ['contador', 'auditor'] });
    await waitFor(() =>
      expect(
        lista.result.current.data?.find((p) => p.id === ID)?.roles,
      ).toEqual(['contador', 'auditor']),
    );
  });
});
