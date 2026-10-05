import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { contextoSesion } from '@/shared/api/contratos';
import { ROLES } from '@/shared/dominio';
import { CONTEXTO_SESION } from '@/test/fixtures';
import { ESTADO_SESION_PLACEHOLDER } from './contextoPlaceholder';
import {
  PlaceholderSessionProvider,
  SessionStateProvider,
  useSessionActionsOpcional,
  useSessionContext,
  type AccionesSesion,
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

describe('useSessionActionsOpcional', () => {
  function Sonda() {
    const acciones = useSessionActionsOpcional();
    return <p data-testid="acciones">{acciones ? 'con' : 'sin'}</p>;
  }

  it('devuelve null con un proveedor de solo lectura, sin lanzar', () => {
    render(
      <PlaceholderSessionProvider>
        <Sonda />
      </PlaceholderSessionProvider>,
    );
    expect(screen.getByTestId('acciones')).toHaveTextContent('sin');
  });

  it('devuelve las acciones cuando el proveedor las trae', () => {
    const acciones = {} as AccionesSesion;
    render(
      <SessionStateProvider
        estado={{ status: 'anonymous' }}
        acciones={acciones}
      >
        <Sonda />
      </SessionStateProvider>,
    );
    expect(screen.getByTestId('acciones')).toHaveTextContent('con');
  });
});
