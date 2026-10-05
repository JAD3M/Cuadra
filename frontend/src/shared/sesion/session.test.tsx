import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { contextoSesion } from '@/shared/api/contratos';
import { CONTEXTO_SESION, SESION_LISTA } from '@/test/fixtures';
import {
  SessionStateProvider,
  useSessionContext,
  type SessionState,
} from './index';

function Lector() {
  const estado = useSessionContext();
  return (
    <p data-testid="estado">
      {estado.status === 'ready'
        ? `ready:${estado.contexto.usuario.nombre}`
        : estado.status}
    </p>
  );
}

describe('useSessionContext', () => {
  it('falla con un mensaje claro fuera de un proveedor', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Lector />)).toThrow(/proveedor de sesión/);
    error.mockRestore();
  });

  it.each<[string, SessionState, string]>([
    ['anonymous', { status: 'anonymous' }, 'anonymous'],
    ['loading', { status: 'loading', restaurarOrigen: false }, 'loading'],
    ['unavailable', { status: 'unavailable' }, 'unavailable'],
    ['ended', { status: 'ended', motivo: 'sesion_expirada' }, 'ended'],
  ])('publica el estado %s del proveedor genérico', (_n, estado, esperado) => {
    render(
      <SessionStateProvider estado={estado}>
        <Lector />
      </SessionStateProvider>,
    );
    expect(screen.getByTestId('estado')).toHaveTextContent(esperado);
  });

  it('publica el estado selecting con la lista de empresas', () => {
    render(
      <SessionStateProvider
        estado={{
          status: 'selecting',
          origen: 'login',
          usuario: contextoSesion.parse(CONTEXTO_SESION).usuario,
          empresas: [],
        }}
      >
        <Lector />
      </SessionStateProvider>,
    );
    expect(screen.getByTestId('estado')).toHaveTextContent('selecting');
  });

  it('publica el contexto cuando el estado es ready', () => {
    render(
      <SessionStateProvider estado={SESION_LISTA}>
        <Lector />
      </SessionStateProvider>,
    );
    expect(screen.getByTestId('estado')).toHaveTextContent('ready:Jorge Tapia');
  });
});
