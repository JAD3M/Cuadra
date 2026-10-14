import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EstadoPlataforma } from '@/shared/sesion/plataforma';
import { ESTADOS_PLATAFORMA, montarRutasPlataforma } from '@/test/montarRutas';

function pantalla() {
  return screen.getByTestId('pantalla').textContent;
}

type Fila = [string, EstadoPlataforma, string];

describe('RutaPlataforma', () => {
  const filas: Fila[] = [
    ['anonymous', ESTADOS_PLATAFORMA.anonymous, 'login-plataforma'],
    [
      'ended sesion_terminada',
      ESTADOS_PLATAFORMA.sesionTerminada,
      'login-plataforma',
    ],
    [
      'ended sesion_cerrada',
      ESTADOS_PLATAFORMA.sesionCerrada,
      'login-plataforma',
    ],
    ['ready', ESTADOS_PLATAFORMA.ready, 'plataforma'],
  ];

  it.each(filas)('%s', (_nombre, estado, esperada) => {
    montarRutasPlataforma('/plataforma', estado);
    expect(pantalla()).toBe(esperada);
  });

  it('restoring: no dibuja nada hasta saber si la cookie vale', () => {
    const { router, dibujadas } = montarRutasPlataforma(
      '/plataforma',
      ESTADOS_PLATAFORMA.restoring,
    );
    expect(screen.queryByTestId('pantalla')).toBeNull();
    expect(dibujadas).toEqual([]);
    expect(router.state.location.pathname).toBe('/plataforma');
  });

  it('redirige a /plataforma/login reemplazando la entrada del historial', () => {
    const { router } = montarRutasPlataforma(
      '/plataforma',
      ESTADOS_PLATAFORMA.anonymous,
    );
    expect(router.state.historyAction).toBe('REPLACE');
    expect(router.state.location.pathname).toBe('/plataforma/login');
  });

  it('nunca manda a la pantalla de acceso de empresa', () => {
    const { router } = montarRutasPlataforma(
      '/plataforma',
      ESTADOS_PLATAFORMA.sesionTerminada,
    );
    expect(router.state.location.pathname).not.toBe('/login');
  });
});

describe('RutaAnonimaPlataforma', () => {
  const filas: Fila[] = [
    ['anonymous', ESTADOS_PLATAFORMA.anonymous, 'login-plataforma'],
    [
      'ended sesion_terminada',
      ESTADOS_PLATAFORMA.sesionTerminada,
      'login-plataforma',
    ],
    [
      'ended sesion_cerrada',
      ESTADOS_PLATAFORMA.sesionCerrada,
      'login-plataforma',
    ],
    ['ready', ESTADOS_PLATAFORMA.ready, 'plataforma'],
  ];

  it.each(filas)('%s', (_nombre, estado, esperada) => {
    montarRutasPlataforma('/plataforma/login', estado);
    expect(pantalla()).toBe(esperada);
  });

  it('restoring: ni login ni redirección', () => {
    const { router } = montarRutasPlataforma(
      '/plataforma/login',
      ESTADOS_PLATAFORMA.restoring,
    );
    expect(screen.queryByTestId('pantalla')).toBeNull();
    expect(router.state.location.pathname).toBe('/plataforma/login');
  });

  it('con sesión, /plataforma/login lleva a /plataforma', () => {
    const { router } = montarRutasPlataforma(
      '/plataforma/login',
      ESTADOS_PLATAFORMA.ready,
    );
    expect(router.state.location.pathname).toBe('/plataforma');
  });

  it('al llegar la sesión desde restoring la guarda reacciona', async () => {
    const { router, cambiar } = montarRutasPlataforma(
      '/plataforma',
      ESTADOS_PLATAFORMA.restoring,
    );
    await cambiar(ESTADOS_PLATAFORMA.anonymous);
    expect(router.state.location.pathname).toBe('/plataforma/login');
  });
});
