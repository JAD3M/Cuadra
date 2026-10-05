import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SessionState } from '@/shared/sesion';
import { ESTADOS, montarRutas, terminada } from '@/test/montarRutas';

const PEDIDA = '/casos/9?x=1#y';
const FROM = { pathname: '/casos/9', search: '?x=1', hash: '#y' };

function pantalla() {
  return screen.getByTestId('pantalla').textContent;
}

function estadoDelRouter(): unknown {
  const texto = screen.getByTestId('state').textContent;
  return texto ? (JSON.parse(texto) as unknown) : null;
}

type Fila = [string, SessionState, string, unknown];

describe('RutaProtegida', () => {
  const filas: Fila[] = [
    ['anonymous', ESTADOS.anonymous, 'login', { from: FROM }],
    [
      'ended sesion_expirada',
      terminada('sesion_expirada'),
      'login',
      { from: FROM },
    ],
    ['ended cierre_voluntario', terminada('cierre_voluntario'), 'login', null],
    ['ended sin_acceso', terminada('sin_acceso'), 'login', null],
    ['ended reingreso', terminada('reingreso'), 'login', null],
    ['ended seleccion_vencida', terminada('seleccion_vencida'), 'login', null],
    ['ended sin_empresas', terminada('sin_empresas'), 'login', null],
    ['selecting (login)', ESTADOS.selectingLogin, 'empresa', { from: FROM }],
    ['selecting (cambio)', ESTADOS.selectingCambio, 'caso', null],
    ['loading', ESTADOS.loading, 'caso', null],
    ['unavailable', ESTADOS.unavailable, 'caso', null],
    ['ready', ESTADOS.ready, 'caso', null],
  ];

  it.each(filas)('%s', (_nombre, estado, esperada, state) => {
    montarRutas(PEDIDA, estado);
    expect(pantalla()).toBe(esperada);
    // Solo las redirecciones tienen un estado que revisar.
    if (esperada !== 'caso') expect(estadoDelRouter()).toEqual(state);
  });

  it('redirige reemplazando la entrada del historial', () => {
    const { router } = montarRutas(PEDIDA, ESTADOS.anonymous);
    expect(router.state.historyAction).toBe('REPLACE');
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('');
  });

  it('no dibuja contenido protegido ni un fotograma sin sesión', () => {
    for (const estado of [
      ESTADOS.anonymous,
      terminada('sesion_expirada'),
      ESTADOS.selectingLogin,
    ]) {
      const { dibujadas } = montarRutas(PEDIDA, estado);
      expect(dibujadas).not.toContain('caso');
      expect(dibujadas).not.toContain('bandeja');
    }
  });

  it('el destino viaja en el estado y no en la dirección', () => {
    const { router } = montarRutas(PEDIDA, ESTADOS.anonymous);
    expect(router.state.location.pathname + router.state.location.search).toBe(
      '/login',
    );
    expect(router.state.location.hash).toBe('');
  });

  it('recuerda solo la ruta cuando no hay search ni hash', () => {
    const { router } = montarRutas('/bandeja', ESTADOS.anonymous);
    expect(router.state.location.state).toEqual({
      from: { pathname: '/bandeja' },
    });
  });

  it('mantiene la pantalla al pasar de ready a un cambio de empresa y volver', async () => {
    const { cambiar, dibujadas } = montarRutas(PEDIDA, ESTADOS.ready);
    await cambiar(ESTADOS.selectingCambio);
    expect(pantalla()).toBe('caso');
    await cambiar(ESTADOS.ready);
    expect(pantalla()).toBe('caso');
    // Ni un solo cuadro con otra pantalla: no hubo carga ni redirección.
    expect(new Set(dibujadas)).toEqual(new Set(['caso']));
  });

  it('expulsa a /login con el destino cuando la sesión expira estando dentro', async () => {
    const { cambiar, router } = montarRutas(PEDIDA, ESTADOS.ready);
    await cambiar(terminada('sesion_expirada'));
    expect(pantalla()).toBe('login');
    expect(estadoDelRouter()).toEqual({ from: FROM });
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('un cierre voluntario estando dentro no recuerda el destino', async () => {
    const { cambiar } = montarRutas(PEDIDA, ESTADOS.ready);
    await cambiar(terminada('cierre_voluntario'));
    expect(pantalla()).toBe('login');
    expect(estadoDelRouter()).toBeNull();
  });

  it('un cambio de empresa que vence estando dentro termina en /login sin destino', async () => {
    const { cambiar } = montarRutas(PEDIDA, ESTADOS.selectingCambio);
    await cambiar(terminada('reingreso'));
    expect(pantalla()).toBe('login');
    expect(estadoDelRouter()).toBeNull();
  });
});

describe('RutaAnonima', () => {
  const sinState = { pathname: '/login' };
  const conFrom = { pathname: '/login', state: { from: FROM } };

  it.each([
    ['anonymous', ESTADOS.anonymous],
    ['ended sesion_expirada', terminada('sesion_expirada')],
    ['ended cierre_voluntario', terminada('cierre_voluntario')],
    ['ended sin_acceso', terminada('sin_acceso')],
    ['ended reingreso', terminada('reingreso')],
    ['ended seleccion_vencida', terminada('seleccion_vencida')],
    ['ended sin_empresas', terminada('sin_empresas')],
  ])('%s muestra la pantalla de acceso', (_nombre, estado) => {
    montarRutas(conFrom, estado);
    expect(pantalla()).toBe('login');
    expect(estadoDelRouter()).toEqual({ from: FROM });
  });

  it.each([
    ['selecting (login)', ESTADOS.selectingLogin],
    ['selecting (cambio)', ESTADOS.selectingCambio],
  ])('%s va a /empresa y conserva el destino', (_nombre, estado) => {
    const { router } = montarRutas(conFrom, estado);
    expect(pantalla()).toBe('empresa');
    expect(estadoDelRouter()).toEqual({ from: FROM });
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('selecting sin destino va a /empresa sin estado', () => {
    montarRutas(sinState, ESTADOS.selectingLogin);
    expect(pantalla()).toBe('empresa');
    expect(estadoDelRouter()).toBeNull();
  });

  it.each([
    ['loading restaurando', ESTADOS.loadingRestaurando, 'caso'],
    ['ready restaurando', ESTADOS.readyRestaurando, 'caso'],
    ['loading sin restaurar', ESTADOS.loading, 'bandeja'],
    ['ready sin restaurar', ESTADOS.ready, 'bandeja'],
    ['unavailable', ESTADOS.unavailable, 'bandeja'],
  ])('%s', (_nombre, estado, esperada) => {
    const { router } = montarRutas(conFrom, estado);
    expect(pantalla()).toBe(esperada);
    expect(router.state.historyAction).toBe('REPLACE');
    if (esperada === 'caso') {
      expect(screen.getByTestId('ruta')).toHaveTextContent(PEDIDA);
    }
  });

  it('con sesión y sin destino va a /bandeja', () => {
    montarRutas(sinState, ESTADOS.readyRestaurando);
    expect(pantalla()).toBe('bandeja');
  });

  it('ignora un destino hostil en el estado del historial', () => {
    montarRutas(
      { pathname: '/login', state: { from: { pathname: '//evil.com' } } },
      ESTADOS.readyRestaurando,
    );
    expect(pantalla()).toBe('bandeja');
  });
});

describe('RutaSeleccion', () => {
  const sinState = { pathname: '/empresa' };
  const conFrom = { pathname: '/empresa', state: { from: FROM } };

  it.each([
    ['selecting (login)', ESTADOS.selectingLogin],
    ['selecting (cambio)', ESTADOS.selectingCambio],
  ])('%s muestra el paso de empresa', (_nombre, estado) => {
    montarRutas(sinState, estado);
    expect(pantalla()).toBe('empresa');
  });

  it('anonymous va a /login con el foco en el correo y el destino', () => {
    const { router } = montarRutas(conFrom, ESTADOS.anonymous);
    expect(pantalla()).toBe('login');
    expect(estadoDelRouter()).toEqual({ from: FROM, foco: 'correo' });
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('anonymous sin destino va a /login solo con el foco', () => {
    montarRutas(sinState, ESTADOS.anonymous);
    expect(estadoDelRouter()).toEqual({ foco: 'correo' });
  });

  it('ended por expiración conserva el destino', () => {
    montarRutas(conFrom, terminada('sesion_expirada'));
    expect(estadoDelRouter()).toEqual({ from: FROM, foco: 'correo' });
  });

  it.each([
    'cierre_voluntario',
    'sin_acceso',
    'reingreso',
    'seleccion_vencida',
    'sin_empresas',
  ] as const)('ended %s no conserva el destino', (motivo) => {
    montarRutas(conFrom, terminada(motivo));
    expect(pantalla()).toBe('login');
    expect(estadoDelRouter()).toEqual({ foco: 'correo' });
  });

  it.each([
    ['loading restaurando', ESTADOS.loadingRestaurando, 'caso'],
    [
      'ready restaurando (misma empresa tras expirar)',
      ESTADOS.readyRestaurando,
      'caso',
    ],
    ['loading sin restaurar (empresa distinta)', ESTADOS.loading, 'bandeja'],
    ['ready sin restaurar (empresa distinta)', ESTADOS.ready, 'bandeja'],
    ['unavailable', ESTADOS.unavailable, 'bandeja'],
  ])('%s', (_nombre, estado, esperada) => {
    const { router } = montarRutas(conFrom, estado);
    expect(pantalla()).toBe(esperada);
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('ready en /empresa sin destino va a /bandeja', () => {
    montarRutas(sinState, ESTADOS.ready);
    expect(pantalla()).toBe('bandeja');
  });

  it('ignora un destino hostil en el estado del historial', () => {
    montarRutas(
      { pathname: '/empresa', state: { from: { pathname: '/\\evil.com' } } },
      ESTADOS.readyRestaurando,
    );
    expect(pantalla()).toBe('bandeja');
  });
});

describe('recorrido tras una expiración', () => {
  async function hastaEmpresa() {
    const montaje = montarRutas(PEDIDA, ESTADOS.ready);
    await montaje.cambiar(terminada('sesion_expirada'));
    // La pantalla de acceso leyó el aviso y consumió el fin.
    await montaje.cambiar(ESTADOS.anonymous);
    await montaje.cambiar(ESTADOS.selectingLogin);
    return montaje;
  }

  it('la misma empresa vuelve a la pantalla de origen', async () => {
    const { cambiar, router } = await hastaEmpresa();
    expect(pantalla()).toBe('empresa');
    expect(estadoDelRouter()).toEqual({ from: FROM });
    await cambiar(ESTADOS.loadingRestaurando);
    expect(pantalla()).toBe('caso');
    expect(screen.getByTestId('ruta')).toHaveTextContent(PEDIDA);
    await cambiar(ESTADOS.readyRestaurando);
    expect(pantalla()).toBe('caso');
    expect(router.state.location.pathname).toBe('/casos/9');
  });

  it('otra empresa va a /bandeja', async () => {
    const { cambiar } = await hastaEmpresa();
    await cambiar(ESTADOS.loading);
    expect(pantalla()).toBe('bandeja');
    await cambiar(ESTADOS.ready);
    expect(pantalla()).toBe('bandeja');
  });

  it('tras un cambio de empresa se entra por /bandeja', async () => {
    const { cambiar, router } = montarRutas(PEDIDA, ESTADOS.ready);
    await cambiar(ESTADOS.selectingCambio);
    // La pantalla de cambio se abre sin destino.
    await act(() => router.navigate('/empresa'));
    expect(pantalla()).toBe('empresa');
    await cambiar(ESTADOS.loading);
    expect(pantalla()).toBe('bandeja');
  });

  it('un login que sigue a un cierre vuelve a /bandeja sin destino viejo', async () => {
    const { cambiar } = montarRutas(PEDIDA, ESTADOS.ready);
    await cambiar(terminada('cierre_voluntario'));
    expect(estadoDelRouter()).toBeNull();
    await cambiar(ESTADOS.anonymous);
    await cambiar(ESTADOS.selectingLogin);
    expect(pantalla()).toBe('empresa');
    await cambiar(ESTADOS.loading);
    expect(pantalla()).toBe('bandeja');
  });
});
