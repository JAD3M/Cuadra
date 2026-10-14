import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { CONTEXTO_SESION, CONTEXTO_SESION_B } from '@/test/fixtures';
import { CREDENCIALES, EMPRESA_A, montarSesion } from '@/test/montarSesion';
import { servidor } from '@/test/servidor';

function contextoActual(cuerpo: object) {
  servidor.use(http.get('/api/auth/contexto', () => HttpResponse.json(cuerpo)));
}

describe('abrirSesionDeInvitacion', () => {
  it('desde anónimo pide el contexto con la cookie nueva y queda ready en esa empresa', async () => {
    const { entorno } = montarSesion();
    contextoActual(CONTEXTO_SESION_B);
    await act(() => entorno.acciones().abrirSesionDeInvitacion());
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    const estado = entorno.estado();
    if (estado.status !== 'ready') throw new Error('sin sesión');
    expect(estado.contexto.empresa.id).toBe(CONTEXTO_SESION_B.empresa.id);
    expect(estado.restaurarOrigen).toBe(false);
    expect(JSON.stringify(estado).toLowerCase()).not.toContain('token');
  });

  it('con otra sesión viva la reemplaza y no deja datos de la empresa anterior', async () => {
    const { entorno } = montarSesion();
    await act(() => entorno.acciones().iniciarSesion(CREDENCIALES));
    await act(() => entorno.acciones().elegirEmpresa(EMPRESA_A));
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    entorno.consultas.setQueryData(['bandeja', 'viejo'], { dato: 1 });
    contextoActual(CONTEXTO_SESION_B);
    await act(() => entorno.acciones().abrirSesionDeInvitacion());
    await waitFor(() => {
      const estado = entorno.estado();
      expect(estado.status).toBe('ready');
      if (estado.status === 'ready') {
        expect(estado.contexto.empresa.id).toBe(CONTEXTO_SESION_B.empresa.id);
      }
    });
    expect(
      entorno.consultas.getQueryData(['bandeja', 'viejo']),
    ).toBeUndefined();
  });

  it('si el contexto falla rechaza y deja la sesión como estaba', async () => {
    const { entorno } = montarSesion();
    servidor.use(
      http.get('/api/auth/contexto', () =>
        HttpResponse.json(
          { statusCode: 401, error: 'x', message: 'x' },
          { status: 401 },
        ),
      ),
    );
    await expect(
      act(() => entorno.acciones().abrirSesionDeInvitacion()),
    ).rejects.toBeDefined();
    expect(entorno.estado().status).toBe('anonymous');
  });

  it('usa el contexto del servidor (no arma uno propio)', async () => {
    const { entorno } = montarSesion();
    contextoActual(CONTEXTO_SESION);
    await act(() => entorno.acciones().abrirSesionDeInvitacion());
    await waitFor(() => expect(entorno.estado().status).toBe('ready'));
    const estado = entorno.estado();
    if (estado.status !== 'ready') throw new Error('sin sesión');
    expect(estado.contexto.roles).toEqual(CONTEXTO_SESION.roles);
  });
});
