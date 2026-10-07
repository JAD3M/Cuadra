import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import { clasificarErrorBitacora } from './errores';

describe('clasificarErrorBitacora', () => {
  it.each<[string, unknown, string | null]>([
    ['403', new ApiError(403, 'Forbidden', ['rol']), 'sin_permiso'],
    ['500', new ApiError(500, 'Error', []), 'conexion'],
    ['503', new ApiError(503, 'Error', []), 'conexion'],
    ['400', new ApiError(400, 'Bad Request', ['desde mal']), 'otro'],
    ['404', new ApiError(404, 'Not Found', []), 'otro'],
    ['red', new NetworkError(), 'conexion'],
    ['contrato', new ContratoError(), 'conexion'],
    ['inesperado', new Error('x'), 'otro'],
    ['cancelación', new DOMException('x', 'AbortError'), null],
  ])('%s', (_n, error, clase) => {
    expect(clasificarErrorBitacora(error)).toBe(clase);
  });
});
