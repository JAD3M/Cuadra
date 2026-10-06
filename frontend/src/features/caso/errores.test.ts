import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import { clasificarErrorAccion, clasificarErrorLectura } from './errores';

const api = (status: number, mensajes: string[] = ['texto del servidor']) =>
  new ApiError(status, 'Error', mensajes);

describe('clasificarErrorLectura', () => {
  it('ignora una cancelación', () => {
    const abort = new DOMException('cancelado', 'AbortError');
    expect(clasificarErrorLectura(abort)).toBeNull();
  });

  it('404 y 400 son no_encontrado', () => {
    expect(clasificarErrorLectura(api(404))).toBe('no_encontrado');
    expect(clasificarErrorLectura(api(400))).toBe('no_encontrado');
  });

  it('403 es sin_permiso', () => {
    expect(clasificarErrorLectura(api(403))).toBe('sin_permiso');
  });

  it('401 no muestra nada: lo atiende la capa de sesión', () => {
    expect(clasificarErrorLectura(api(401))).toBeNull();
  });

  it('un fallo de contrato es contrato', () => {
    expect(clasificarErrorLectura(new ContratoError())).toBe('contrato');
  });

  it('red, 5xx y cualquier otro fallo son conexion', () => {
    expect(clasificarErrorLectura(new NetworkError())).toBe('conexion');
    expect(clasificarErrorLectura(api(500))).toBe('conexion');
    expect(clasificarErrorLectura(api(503))).toBe('conexion');
    expect(clasificarErrorLectura(api(418))).toBe('conexion');
    expect(clasificarErrorLectura(new Error('raro'))).toBe('conexion');
  });
});

describe('clasificarErrorAccion', () => {
  it('400 es motivo_largo', () => {
    expect(clasificarErrorAccion(api(400), 'rechazar')).toBe('motivo_largo');
  });

  it('403 depende de la acción: confirmar es segregación', () => {
    expect(clasificarErrorAccion(api(403), 'confirmar')).toBe('segregacion');
    expect(clasificarErrorAccion(api(403), 'rechazar')).toBe('sin_permiso');
  });

  it('404, 409 y el orden del servidor 404/409/403 no se mezclan', () => {
    expect(clasificarErrorAccion(api(404), 'confirmar')).toBe('no_encontrado');
    expect(clasificarErrorAccion(api(409), 'confirmar')).toBe('conflicto');
    expect(clasificarErrorAccion(api(403), 'confirmar')).toBe('segregacion');
    const clases = new Set([
      clasificarErrorAccion(api(404), 'confirmar'),
      clasificarErrorAccion(api(409), 'confirmar'),
      clasificarErrorAccion(api(403), 'confirmar'),
    ]);
    expect(clases.size).toBe(3);
  });

  it('red y 5xx son conexion', () => {
    expect(clasificarErrorAccion(new NetworkError(), 'confirmar')).toBe(
      'conexion',
    );
    expect(clasificarErrorAccion(api(500), 'rechazar')).toBe('conexion');
    expect(clasificarErrorAccion(api(502), 'confirmar')).toBe('conexion');
  });

  it('un fallo de contrato es contrato', () => {
    expect(clasificarErrorAccion(new ContratoError(), 'confirmar')).toBe(
      'contrato',
    );
  });

  it('cualquier otro 4xx es generico', () => {
    expect(clasificarErrorAccion(api(422), 'confirmar')).toBe('generico');
    expect(clasificarErrorAccion(api(418), 'rechazar')).toBe('generico');
  });

  it('nunca devuelve texto del servidor', () => {
    const clase = clasificarErrorAccion(
      api(409, ['acceso_denegado interno']),
      'confirmar',
    );
    expect(clase).not.toMatch(/acceso_denegado|interno/);
  });
});
