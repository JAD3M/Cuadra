import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import { clasificarErrorGuardado } from './errores';

const api = (status: number, mensajes: string[] = []) =>
  new ApiError(status, 'Error', mensajes);

describe('clasificarErrorGuardado (TOL-7.10)', () => {
  it('400 es rechazo y la clase no lleva texto del servidor', () => {
    const clase = clasificarErrorGuardado(
      api(400, ['toleranciaMonto must not be greater than 100']),
    );
    expect(clase).toBe('rechazo');
    expect(JSON.stringify(clase)).not.toContain('toleranciaMonto');
  });

  it('400 con varios mensajes sigue siendo rechazo', () => {
    expect(clasificarErrorGuardado(api(400, ['uno', 'dos']))).toBe('rechazo');
  });

  it('no lee los mensajes del servidor (mensajes nunca se toca)', () => {
    const error = api(400, ['toleranciaMonto debe ser un decimal']);
    Object.defineProperty(error, 'mensajes', {
      get() {
        throw new Error('mensajes no debe leerse');
      },
    });
    expect(clasificarErrorGuardado(error)).toBe('rechazo');
  });

  it('401 no muestra mensaje: lo atiende la capa de sesión', () => {
    expect(clasificarErrorGuardado(api(401))).toBeNull();
  });

  it('403 es sin_permiso', () => {
    expect(clasificarErrorGuardado(api(403))).toBe('sin_permiso');
  });

  it.each([404, 409, 413, 422, 500, 502, 503])('%i es otro', (status) => {
    expect(clasificarErrorGuardado(api(status))).toBe('otro');
  });

  it('un fallo de red es conexion', () => {
    expect(clasificarErrorGuardado(new NetworkError())).toBe('conexion');
  });

  it('una respuesta 2xx fuera de contrato es otro', () => {
    expect(clasificarErrorGuardado(new ContratoError())).toBe('otro');
  });

  it('una cancelación no muestra mensaje', () => {
    expect(
      clasificarErrorGuardado(new DOMException('cancelado', 'AbortError')),
    ).toBeNull();
  });

  it('cualquier otro error es otro', () => {
    expect(clasificarErrorGuardado(new Error('boom'))).toBe('otro');
    expect(clasificarErrorGuardado('texto')).toBe('otro');
  });
});
