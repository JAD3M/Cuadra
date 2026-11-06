import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { contextoSesion } from '@/shared/api/contratos';
import { SessionStateProvider, type SessionState } from '@/shared/sesion';
import { CONTEXTO_SESION, SESION_LISTA } from '@/test/fixtures';
import { clienteDePruebas } from '@/test/montarBandeja';
import { BitacoraPage } from './BitacoraPage';

const TITULO = 'Esta empresa opera sin separación de funciones.';

function montar(estado: SessionState) {
  const router = createMemoryRouter(
    [{ path: '/bitacora', element: <BitacoraPage /> }],
    { initialEntries: ['/bitacora'] },
  );
  render(
    <QueryClientProvider client={clienteDePruebas()}>
      <SessionStateProvider estado={estado}>
        <RouterProvider router={router} />
      </SessionStateProvider>
    </QueryClientProvider>,
  );
}

const sinSeparacion: SessionState = {
  ...SESION_LISTA,
  contexto: contextoSesion.parse({
    ...CONTEXTO_SESION,
    empresa: { ...CONTEXTO_SESION.empresa, separacionFunciones: false },
  }),
} as SessionState;

describe('aviso sin separación en la bitácora', () => {
  it('aparece con la separación desactivada', () => {
    montar(sinSeparacion);
    expect(screen.getByText(TITULO).closest('[role="status"]')).not.toBeNull();
  });

  it('no aparece con la separación activa', () => {
    montar(SESION_LISTA);
    expect(screen.queryByText(TITULO)).toBeNull();
  });

  it.each([
    ['cargando', { status: 'loading', restaurarOrigen: false }],
    ['no disponible', { status: 'unavailable' }],
  ] as const)('no aparece con el contexto %s', (_n, estado) => {
    montar(estado);
    expect(screen.queryByText(TITULO)).toBeNull();
  });
});
