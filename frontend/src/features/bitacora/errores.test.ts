import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import { clasificarErrorBitacora } from './errores';

const api = (status: number, mensajes: string[] = []) =>
  new ApiError(status, 'Error', mensajes);

describe('clasificarErrorBitacora (BIT-10)', () => {
  it.each([400, 404, 422])('%i es otro', (status) => {
    expect(clasificarErrorBitacora(api(status))).toBe('otro');
  });

  it('401 no muestra mensaje: lo atiende la capa de sesión', () => {
    expect(clasificarErrorBitacora(api(401))).toBeNull();
  });

  it('403 es sin_permiso', () => {
    expect(clasificarErrorBitacora(api(403))).toBe('sin_permiso');
  });

  it.each([500, 502, 503])('%i es conexion', (status) => {
    expect(clasificarErrorBitacora(api(status))).toBe('conexion');
  });

  it('un fallo de red es conexion', () => {
    expect(clasificarErrorBitacora(new NetworkError())).toBe('conexion');
  });

  it('una respuesta 2xx fuera de contrato es otro', () => {
    expect(clasificarErrorBitacora(new ContratoError())).toBe('otro');
  });

  it('una cancelación no muestra mensaje', () => {
    expect(
      clasificarErrorBitacora(new DOMException('cancelado', 'AbortError')),
    ).toBeNull();
  });

  it('cualquier otro error es otro', () => {
    expect(clasificarErrorBitacora(new Error('boom'))).toBe('otro');
    expect(clasificarErrorBitacora('texto')).toBe('otro');
  });

  it('la clase no lleva texto del servidor y los mensajes nunca se leen', () => {
    const error = api(500, ['boom']);
    Object.defineProperty(error, 'mensajes', {
      get() {
        throw new Error('mensajes no debe leerse');
      },
    });
    const clase = clasificarErrorBitacora(error);
    expect(clase).toBe('conexion');
    expect(JSON.stringify(clase)).not.toContain('boom');
  });
});
