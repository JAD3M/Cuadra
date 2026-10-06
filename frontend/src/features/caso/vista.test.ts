import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import {
  casoConciliado,
  casoSinMatch,
  casoSugerencia,
  casoVarias,
  propuestaCaso,
} from '@/test/fixturesCaso';
import {
  bannerDe,
  derivarVista,
  historialIdDe,
  propuestaSeleccionada,
  vistaDeLectura,
  type ResolucionVigente,
} from './vista';

describe('derivarVista (variante cargada)', () => {
  it('una propuesta vigente es sugerencia', () => {
    expect(derivarVista(casoSugerencia())).toBe('sugerencia');
  });

  it('dos o más propuestas vigentes son varias', () => {
    expect(derivarVista(casoVarias())).toBe('varias');
    expect(
      derivarVista(
        casoSugerencia({ propuestas: [propuestaCaso(1), propuestaCaso(2)] }),
      ),
    ).toBe('varias');
  });

  it('sin_match y conciliado salen del estado del servidor', () => {
    expect(derivarVista(casoSinMatch())).toBe('sin_match');
    expect(derivarVista(casoConciliado())).toBe('conciliado');
  });

  it('conciliado manda aunque el servidor devolviera varias filas', () => {
    expect(
      derivarVista(
        casoConciliado({ propuestas: [propuestaCaso(1), propuestaCaso(2)] }),
      ),
    ).toBe('conciliado');
  });
});

describe('propuestaSeleccionada', () => {
  const propuestas = [propuestaCaso(1), propuestaCaso(2), propuestaCaso(3)];

  it('devuelve la propuesta elegida', () => {
    expect(
      propuestaSeleccionada(propuestas, propuestas[1]?.conciliacionId ?? null),
    ).toBe(propuestas[1]);
  });

  it('sin selección o con una que ya no existe devuelve la primera', () => {
    expect(propuestaSeleccionada(propuestas, null)).toBe(propuestas[0]);
    expect(propuestaSeleccionada(propuestas, 'ya-no-existe')).toBe(
      propuestas[0],
    );
  });

  it('sin propuestas devuelve null', () => {
    expect(propuestaSeleccionada([], null)).toBeNull();
  });
});

describe('vistaDeLectura', () => {
  const sinError = { data: undefined, error: null, isPending: false };

  it('cargando mientras no hay datos ni error', () => {
    expect(
      vistaDeLectura({ data: undefined, error: null, isPending: true }),
    ).toBe('cargando');
  });

  it('con datos no hay vista de lectura', () => {
    expect(
      vistaDeLectura({ data: casoSugerencia(), error: null, isPending: false }),
    ).toBeNull();
  });

  it('404 y 400 son no_encontrado', () => {
    for (const status of [404, 400]) {
      expect(
        vistaDeLectura({
          ...sinError,
          error: new ApiError(status, 'x', []),
        }),
      ).toBe('no_encontrado');
    }
  });

  it('403 es sin_permiso, un fallo de contrato es contrato', () => {
    expect(
      vistaDeLectura({ ...sinError, error: new ApiError(403, 'x', []) }),
    ).toBe('sin_permiso');
    expect(vistaDeLectura({ ...sinError, error: new ContratoError() })).toBe(
      'contrato',
    );
  });

  it('red y 5xx son error', () => {
    expect(vistaDeLectura({ ...sinError, error: new NetworkError() })).toBe(
      'error',
    );
    expect(
      vistaDeLectura({ ...sinError, error: new ApiError(500, 'x', []) }),
    ).toBe('error');
  });

  it('un 401 no muestra vista: lo atiende la sesión', () => {
    expect(
      vistaDeLectura({ ...sinError, error: new ApiError(401, 'x', []) }),
    ).toBeNull();
  });
});

const ZONA = 'UTC';
const confirmar = (rechazadas: number): ResolucionVigente => ({
  accion: 'confirmar',
  conciliacionId: 'c1',
  rechazadas,
});
const rechazar = (conciliacionId = 'c1'): ResolucionVigente => ({
  accion: 'rechazar',
  conciliacionId,
  rechazadas: 0,
});

describe('bannerDe: confirmar', () => {
  it('el usuario y la fecha salen del caso vuelto a pedir', () => {
    const banner = bannerDe(confirmar(0), casoConciliado(), ZONA);
    expect(banner.accion).toBe('confirmar');
    expect(banner.detalle).toBe('Ana · 2026-09-03');
  });

  it('sin el caso (el refetch falló) no hay detalle', () => {
    expect(bannerDe(confirmar(0), undefined, ZONA).detalle).toBeNull();
  });

  it('con un caso que aún no es conciliado tampoco hay detalle', () => {
    expect(bannerDe(confirmar(0), casoSugerencia(), ZONA).detalle).toBeNull();
  });

  it('si falta el usuario o la fecha se muestra solo lo que hay', () => {
    const base = casoConciliado();
    const [propuesta] = base.propuestas;
    const sinUsuario = casoConciliado({
      propuestas: [{ ...propuesta!, confirmadaPor: null }],
    });
    const sinFecha = casoConciliado({
      propuestas: [{ ...propuesta!, confirmadaAt: null }],
    });
    expect(bannerDe(confirmar(0), sinUsuario, ZONA).detalle).toBe('2026-09-03');
    expect(bannerDe(confirmar(0), sinFecha, ZONA).detalle).toBe('Ana');
  });

  it.each([
    [0, null],
    [1, 'La otra propuesta de este movimiento se rechazó.'],
    [2, 'Las demás propuestas de este movimiento se rechazaron.'],
    [5, 'Las demás propuestas de este movimiento se rechazaron.'],
  ])('con %i rechazadas automáticamente la nota es %s', (n, nota) => {
    expect(bannerDe(confirmar(n), casoConciliado(), ZONA).nota).toBe(nota);
  });
});

describe('bannerDe: rechazar', () => {
  it('con dos o más propuestas vigentes dice cuántas quedan', () => {
    const caso = casoSugerencia({
      propuestas: [propuestaCaso(2), propuestaCaso(3)],
    });
    expect(bannerDe(rechazar(), caso).nota).toBe(
      'Quedan 2 propuestas vigentes para este movimiento.',
    );
  });

  it('con una sola usa el singular aprobado (B11)', () => {
    expect(bannerDe(rechazar(), casoSugerencia()).nota).toBe(
      'Queda 1 propuesta vigente para este movimiento.',
    );
  });

  it('sin propuestas el movimiento vuelve a sin match', () => {
    expect(bannerDe(rechazar(), casoSinMatch()).nota).toBe(
      'El movimiento vuelve a sin match.',
    );
  });

  it('sin el caso vuelto a pedir no afirma nada', () => {
    const banner = bannerDe(rechazar(), undefined);
    expect(banner.accion).toBe('rechazar');
    expect(banner.nota).toBeNull();
    expect(banner.detalle).toBeNull();
  });
});

describe('historialIdDe (R5/B5)', () => {
  const propuestas = [propuestaCaso(1), propuestaCaso(2)];
  const primera = propuestas[0] ?? null;

  it('sin resolución, el historial es el de la propuesta mostrada', () => {
    expect(historialIdDe(null, propuestas, primera)).toBe(
      primera?.conciliacionId,
    );
  });

  it('sin propuestas ni resolución no hay historial', () => {
    expect(historialIdDe(null, [], null)).toBeNull();
  });

  it('tras rechazar la última propuesta, el de la rechazada (id de la respuesta)', () => {
    expect(historialIdDe(rechazar('c-rechazada'), [], null)).toBe(
      'c-rechazada',
    );
  });

  it('tras rechazar con propuestas restantes, el de la propuesta mostrada', () => {
    expect(historialIdDe(rechazar('c-rechazada'), propuestas, primera)).toBe(
      primera?.conciliacionId,
    );
  });

  it('tras confirmar sigue siendo el de la propuesta confirmada', () => {
    expect(historialIdDe(confirmar(0), propuestas, primera)).toBe(
      primera?.conciliacionId,
    );
  });
});
