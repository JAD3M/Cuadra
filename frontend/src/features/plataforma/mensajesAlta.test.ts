import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/shared/api';
import { describirFalloAlta } from './mensajesAlta';
import { TEXTOS_ALTA_EMPRESA } from './textos';

const bien = { razonSocial: 'Aurora', rfc: 'fau 210215 qk4' };

describe('describirFalloAlta', () => {
  it('409 es la alerta de RFC duplicado', () => {
    expect(
      describirFalloAlta(new ApiError(409, 'Conflict', ['x']), bien),
    ).toEqual({
      donde: 'alerta',
      titulo: 'Ese RFC ya pertenece a otra empresa',
      detalle: TEXTOS_ALTA_EMPRESA.duplicadoDetalle,
    });
  });

  it('400 con razón social vacía lo explica bajo la razón social', () => {
    expect(
      describirFalloAlta(new ApiError(400, 'Bad', ['x']), {
        ...bien,
        razonSocial: '   ',
      }),
    ).toMatchObject({ donde: 'campo', campo: 'razonSocial' });
  });

  it('400 con RFC genérico o de formato inválido lo explica bajo el RFC', () => {
    expect(
      describirFalloAlta(new ApiError(400, 'Bad', ['x']), {
        ...bien,
        rfc: 'xexx 010101 000',
      }),
    ).toEqual({
      donde: 'campo',
      campo: 'rfc',
      texto: TEXTOS_ALTA_EMPRESA.rfcGenerico,
    });
    expect(
      describirFalloAlta(new ApiError(400, 'Bad', ['x']), {
        ...bien,
        rfc: 'abc',
      }),
    ).toMatchObject({ campo: 'rfc', texto: TEXTOS_ALTA_EMPRESA.rfcFormato });
  });

  it('un fallo de red es la alerta de conexión', () => {
    expect(describirFalloAlta(new NetworkError(), bien)).toMatchObject({
      donde: 'alerta',
      titulo: 'No se pudo conectar con el servidor.',
    });
  });

  it('401 y 403 no se explican: los resuelve la sesión', () => {
    expect(describirFalloAlta(new ApiError(401, 'x', []), bien)).toBeNull();
    expect(describirFalloAlta(new ApiError(403, 'x', []), bien)).toBeNull();
  });
});
