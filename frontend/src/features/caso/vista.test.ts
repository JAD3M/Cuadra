import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import {
  casoConciliado,
  casoSinMatch,
  casoSugerencia,
  casoVarias,
  propuestaCaso,
} from '@/test/fixturesCaso';
import { derivarVista, propuestaSeleccionada, vistaDeLectura } from './vista';

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
