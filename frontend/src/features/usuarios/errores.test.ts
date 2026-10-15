import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/shared/api';
import { clasificarFalloInvitar } from './errores';

function apiError(statusCode: number) {
  return new ApiError(statusCode, 'texto del servidor', ['detalle']);
}

describe('clasificarFalloInvitar', () => {
  it.each([
    [400, 'correo'],
    [403, 'permiso'],
    [429, 'limite'],
    [503, 'envio'],
    [500, 'otro'],
    [404, 'otro'],
  ])('el %i es «%s»', (estado, clase) => {
    expect(clasificarFalloInvitar(apiError(estado))).toBe(clase);
  });

  it('un 401 y una cancelación no muestran nada', () => {
    expect(clasificarFalloInvitar(apiError(401))).toBeNull();
    expect(
      clasificarFalloInvitar(new DOMException('abortado', 'AbortError')),
    ).toBeNull();
  });

  it('un fallo de red es de conexión', () => {
    expect(clasificarFalloInvitar(new NetworkError())).toBe('conexion');
  });

  it('cualquier otra cosa cae en «otro»', () => {
    expect(clasificarFalloInvitar(new Error('x'))).toBe('otro');
  });
});
