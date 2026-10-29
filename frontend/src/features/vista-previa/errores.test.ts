import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import { clasificarErrorDecision, clasificarErrorLectura } from './errores';

const api = (status: number) => new ApiError(status, 'Error', ['x']);
const cancelacion = () => new DOMException('abortado', 'AbortError');

describe('clasificarErrorLectura', () => {
  it.each([
    [404, 'no_encontrada'],
    [400, 'no_encontrada'],
    [409, 'ya_resuelta'],
    [403, 'sin_permiso'],
    [500, 'conexion'],
    [502, 'conexion'],
  ] as const)('un %i es %s', (status, clase) => {
    expect(clasificarErrorLectura(api(status))).toBe(clase);
  });

  it('red y contrato son conexión', () => {
    expect(clasificarErrorLectura(new NetworkError())).toBe('conexion');
    expect(clasificarErrorLectura(new ContratoError())).toBe('conexion');
  });

  it('un 401 y una cancelación no dicen nada', () => {
    expect(clasificarErrorLectura(api(401))).toBeNull();
    expect(clasificarErrorLectura(cancelacion())).toBeNull();
  });
});

describe('clasificarErrorDecision', () => {
  it.each([
    [404, 'no_encontrada'],
    [409, 'ya_resuelta'],
    [403, 'sin_permiso'],
    [500, 'servidor'],
    [400, 'servidor'],
  ] as const)('un %i es %s', (status, clase) => {
    expect(clasificarErrorDecision(api(status))).toBe(clase);
  });

  it('red y contrato son «servidor»: no se sabe si se escribió algo', () => {
    expect(clasificarErrorDecision(new NetworkError())).toBe('servidor');
    expect(clasificarErrorDecision(new ContratoError())).toBe('servidor');
  });

  it('un 401 y una cancelación no dicen nada', () => {
    expect(clasificarErrorDecision(api(401))).toBeNull();
    expect(clasificarErrorDecision(cancelacion())).toBeNull();
  });
});
