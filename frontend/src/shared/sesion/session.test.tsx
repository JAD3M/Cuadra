import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { contextoSesion } from '@/shared/api/contratos';
import { ROLES } from '@/shared/dominio';
import { ESTADO_SESION_PLACEHOLDER } from './contextoPlaceholder';
import {
  PlaceholderSessionProvider,
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
    ['loading', { status: 'loading' }, 'loading'],
    ['ended', { status: 'ended' }, 'ended'],
  ])('publica el estado %s del proveedor genérico', (_n, estado, esperado) => {
    render(
      <SessionStateProvider estado={estado}>
        <Lector />
      </SessionStateProvider>,
    );
    expect(screen.getByTestId('estado')).toHaveTextContent(esperado);
  });

  it('publica el contexto cuando el estado es ready', () => {
    render(
      <SessionStateProvider estado={ESTADO_SESION_PLACEHOLDER}>
        <Lector />
      </SessionStateProvider>,
    );
    expect(screen.getByTestId('estado')).toHaveTextContent('ready:Jorge Tapia');
  });
});

describe('PlaceholderSessionProvider', () => {
  it('entrega siempre un estado ready', () => {
    render(
      <PlaceholderSessionProvider>
        <Lector />
      </PlaceholderSessionProvider>,
    );
    expect(screen.getByTestId('estado')).toHaveTextContent('ready:Jorge Tapia');
  });

  it('sus datos cumplen el contrato de contextoSesion de la API', () => {
    if (ESTADO_SESION_PLACEHOLDER.status !== 'ready') {
      throw new Error('el placeholder debe estar en ready');
    }
    expect(
      contextoSesion.safeParse(ESTADO_SESION_PLACEHOLDER.contexto).success,
    ).toBe(true);
  });

  it('sus roles pertenecen al espejo del dominio', () => {
    if (ESTADO_SESION_PLACEHOLDER.status !== 'ready') {
      throw new Error('el placeholder debe estar en ready');
    }
    for (const rol of ESTADO_SESION_PLACEHOLDER.contexto.roles) {
      expect(ROLES).toContain(rol);
    }
  });
});
