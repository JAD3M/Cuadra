import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import { mensajeDeError } from '@/shared/api/mensajes';
import { clasificarErrorLectura, clasificarErrorSubida } from './errores';

const api = (status: number, mensajes: string[] = []) =>
  new ApiError(status, 'Error', mensajes);
const cancelacion = () => new DOMException('cancelado', 'AbortError');

describe('clasificarErrorSubida', () => {
  it('400 con motivo en texto: rechazo con el motivo exacto', () => {
    expect(
      clasificarErrorSubida(api(400, ['Solo se aceptan archivos .xml'])),
    ).toEqual({ clase: 'rechazo', detalle: 'Solo se aceptan archivos .xml' });
  });

  it('400 con varios mensajes: se unen con un espacio (M8)', () => {
    expect(
      clasificarErrorSubida(
        api(400, ['banco es muy largo', 'cuenta inválida']),
      ),
    ).toEqual({
      clase: 'rechazo',
      detalle: 'banco es muy largo cuenta inválida',
    });
  });

  it('400 sin motivo o con motivo vacío: detalle null', () => {
    expect(clasificarErrorSubida(api(400))).toEqual({
      clase: 'rechazo',
      detalle: null,
    });
    expect(clasificarErrorSubida(api(400, ['  ']))).toEqual({
      clase: 'rechazo',
      detalle: null,
    });
  });

  it('413 es demasiado_grande por el código, con cuerpo JSON o con HTML de proxy', () => {
    expect(clasificarErrorSubida(api(413, ['Payload too large']))).toEqual({
      clase: 'demasiado_grande',
    });
    // El HTML de un proxy llega como ApiError sin mensajes.
    expect(clasificarErrorSubida(api(413))).toEqual({
      clase: 'demasiado_grande',
    });
  });

  it('403 es sin_permiso', () => {
    expect(clasificarErrorSubida(api(403))).toEqual({ clase: 'sin_permiso' });
  });

  it('un fallo de red es conexion', () => {
    expect(clasificarErrorSubida(new NetworkError())).toEqual({
      clase: 'conexion',
    });
  });

  it('500, un fallo de contrato y cualquier otro código son otro', () => {
    expect(clasificarErrorSubida(api(500))).toEqual({ clase: 'otro' });
    expect(clasificarErrorSubida(new ContratoError())).toEqual({
      clase: 'otro',
    });
    expect(clasificarErrorSubida(api(409))).toEqual({ clase: 'otro' });
    expect(clasificarErrorSubida(new Error('raro'))).toEqual({ clase: 'otro' });
  });

  it('una cancelación y un 401 no muestran nada', () => {
    expect(clasificarErrorSubida(cancelacion())).toBeNull();
    expect(clasificarErrorSubida(api(401))).toBeNull();
  });
});

describe('clasificarErrorLectura', () => {
  it('403 es sin_permiso', () => {
    expect(clasificarErrorLectura(api(403))).toBe('sin_permiso');
  });

  it('401 y la cancelación no muestran nada', () => {
    expect(clasificarErrorLectura(api(401))).toBeNull();
    expect(clasificarErrorLectura(cancelacion())).toBeNull();
  });

  it('red, 5xx, contrato y el resto son conexion', () => {
    expect(clasificarErrorLectura(new NetworkError())).toBe('conexion');
    expect(clasificarErrorLectura(api(500))).toBe('conexion');
    expect(clasificarErrorLectura(new ContratoError())).toBe('conexion');
    expect(clasificarErrorLectura(api(404))).toBe('conexion');
    expect(clasificarErrorLectura(new Error('raro'))).toBe('conexion');
  });
});

describe('API-20.5: mensajeDeError no cambia', () => {
  it('un 400 fuera de la subida sigue siendo la copia fija, sin texto del servidor', () => {
    const mensaje = mensajeDeError(api(400, ['texto del servidor']));
    expect(mensaje).toEqual({
      titulo: 'No se pudo completar la solicitud.',
      tipo: 'otro',
    });
    expect(JSON.stringify(mensaje)).not.toContain('texto del servidor');
  });
});
