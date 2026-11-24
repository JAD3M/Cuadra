import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError } from '@/shared/api';
import { clasificarErrorMarca } from './errores';

function api(status: number) {
  return new ApiError(status, 'Error', ['x']);
}

describe('clasificarErrorMarca', () => {
  it.each([
    [403, 'sin_permiso'],
    [404, 'no_encontrado'],
    [409, 'reabierta'],
    [400, 'generico'],
    [422, 'generico'],
    [500, 'conexion'],
    [503, 'conexion'],
  ])('un %i es %s', (status, clase) => {
    expect(clasificarErrorMarca(api(status))).toBe(clase);
  });

  it('un cuerpo ilegible o un fallo de red es de conexión', () => {
    expect(clasificarErrorMarca(new ContratoError())).toBe('conexion');
    expect(clasificarErrorMarca(new TypeError('fetch'))).toBe('conexion');
  });

  it('una cancelación no es un fallo', () => {
    expect(
      clasificarErrorMarca(new DOMException('x', 'AbortError')),
    ).toBeNull();
  });
});
