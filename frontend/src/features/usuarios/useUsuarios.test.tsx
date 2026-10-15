import { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { clienteDePruebas, envoltura } from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import {
  useCancelarInvitacion,
  useReenviarInvitacion,
} from './useAccionInvitacionPendiente';
import { useInvitarUsuario } from './useInvitarUsuario';
import { useUsuarios } from './useUsuarios';

const ID = '11111111-1111-4111-8111-111111111111';
const FILA = {
  id: ID,
  email: 'ana@ferreteria.mx',
  nombre: 'Ana Mendoza',
  roles: ['admin'],
  estado: 'activo',
  invitacionId: null,
  vencida: false,
  venceEn: null,
  creadaEn: null,
  invitadaPor: null,
};

function montar(habilitado = true, cliente: QueryClient = clienteDePruebas()) {
  return {
    cliente,
    ...renderHook(() => useUsuarios(habilitado), {
      wrapper: envoltura(cliente),
    }),
  };
}

describe('useUsuarios', () => {
  it('lee GET /usuarios con el handler por defecto (lista vacía)', async () => {
    const { result } = montar();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('entrega las filas validadas por el contrato', async () => {
    servidor.use(http.get('/api/usuarios', () => HttpResponse.json([FILA])));
    const { result } = montar();
    await waitFor(() => expect(result.current.data).toEqual([FILA]));
  });

  it('no consulta si no está habilitado', () => {
    let pedidas = 0;
    servidor.use(
      http.get('/api/usuarios', () => {
        pedidas += 1;
        return HttpResponse.json([]);
      }),
    );
    const { result } = montar(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(pedidas).toBe(0);
  });

  it('un 403 deja la consulta en error', async () => {
    servidor.use(
      http.get('/api/usuarios', () =>
        HttpResponse.json(
          { statusCode: 403, error: 'Forbidden', message: 'x' },
          { status: 403 },
        ),
      ),
    );
    const { result } = montar();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('un cuerpo fuera de contrato es error', async () => {
    servidor.use(
      http.get('/api/usuarios', () =>
        HttpResponse.json([{ ...FILA, estado: 'baja' }]),
      ),
    );
    const { result } = montar();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('invalidación de la lista de usuarios', () => {
  async function listaCargada() {
    let pedidas = 0;
    servidor.use(
      http.get('/api/usuarios', () => {
        pedidas += 1;
        return HttpResponse.json([FILA]);
      }),
      http.post('/api/usuarios/invitaciones', () =>
        HttpResponse.json(
          { email: 'a@b.mx', roles: ['admin'] },
          { status: 201 },
        ),
      ),
      http.post(`/api/usuarios/invitaciones/${ID}/reenviar`, () =>
        HttpResponse.json(
          { email: 'a@b.mx', roles: ['admin'] },
          { status: 201 },
        ),
      ),
      http.post(`/api/usuarios/invitaciones/${ID}/cancelar`, () =>
        HttpResponse.json({ email: 'a@b.mx' }),
      ),
    );
    const cliente = clienteDePruebas();
    const lista = renderHook(() => useUsuarios(true), {
      wrapper: envoltura(cliente),
    });
    await waitFor(() => expect(lista.result.current.isSuccess).toBe(true));
    return { cliente, pedidas: () => pedidas };
  }

  it('invitar refresca la lista de usuarios', async () => {
    const { cliente, pedidas } = await listaCargada();
    const accion = renderHook(() => useInvitarUsuario(), {
      wrapper: envoltura(cliente),
    });
    accion.result.current.mutate({ email: 'a@b.mx', roles: ['admin'] });
    await waitFor(() => expect(pedidas()).toBe(2));
  });

  it('reenviar refresca la lista de usuarios', async () => {
    const { cliente, pedidas } = await listaCargada();
    const accion = renderHook(() => useReenviarInvitacion(), {
      wrapper: envoltura(cliente),
    });
    accion.result.current.mutate(ID);
    await waitFor(() => expect(pedidas()).toBe(2));
  });

  it('cancelar refresca la lista de usuarios', async () => {
    const { cliente, pedidas } = await listaCargada();
    const accion = renderHook(() => useCancelarInvitacion(), {
      wrapper: envoltura(cliente),
    });
    accion.result.current.mutate(ID);
    await waitFor(() => expect(pedidas()).toBe(2));
  });
});
