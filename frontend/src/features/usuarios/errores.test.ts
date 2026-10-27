import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/shared/api';
import {
  clasificarFalloAccionPendiente,
  clasificarFalloRoles,
  clasificarFalloInvitar,
} from './errores';

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

describe('clasificarFalloAccionPendiente (2.4)', () => {
  it.each([
    [403, 'permiso'],
    [404, 'no_pendiente'],
    [429, 'limite'],
    [503, 'envio'],
    [500, 'otro'],
    [400, 'otro'],
  ])('el %i es «%s» y no lleva texto del servidor', (estado, clase) => {
    expect(clasificarFalloAccionPendiente(apiError(estado))).toEqual({ clase });
  });

  it('un 409 lleva el mensaje que manda el servidor', () => {
    expect(
      clasificarFalloAccionPendiente(
        new ApiError(409, 'Conflict', [
          'Esta invitación ya fue aceptada y no se puede reenviar.',
        ]),
      ),
    ).toEqual({
      clase: 'no_pendiente',
      mensaje: 'Esta invitación ya fue aceptada y no se puede reenviar.',
    });
  });

  it('un 409 sin mensaje cae al texto de respaldo (sin `mensaje`)', () => {
    expect(
      clasificarFalloAccionPendiente(new ApiError(409, 'Conflict', [])),
    ).toEqual({ clase: 'no_pendiente' });
  });

  it('un 401 y una cancelación no muestran nada; la red es de conexión', () => {
    expect(clasificarFalloAccionPendiente(apiError(401))).toBeNull();
    expect(
      clasificarFalloAccionPendiente(new DOMException('x', 'AbortError')),
    ).toBeNull();
    expect(clasificarFalloAccionPendiente(new NetworkError())).toEqual({
      clase: 'conexion',
    });
  });
});

describe('clasificarFalloRoles (2.6)', () => {
  it.each([
    [403, 'permiso'],
    [404, 'no_encontrada'],
    [429, 'limite'],
    [400, 'otro'],
    [500, 'otro'],
  ])('el %i es «%s»', (estado, clase) => {
    expect(clasificarFalloRoles(apiError(estado))).toBe(clase);
  });

  it('un 409 es el último administrador, sin depender del texto', () => {
    expect(clasificarFalloRoles(new ApiError(409, 'Conflict', []))).toBe(
      'ultimo_admin',
    );
  });

  it('un 401 y una cancelación no muestran nada; la red es de conexión', () => {
    expect(clasificarFalloRoles(apiError(401))).toBeNull();
    expect(
      clasificarFalloRoles(new DOMException('x', 'AbortError')),
    ).toBeNull();
    expect(clasificarFalloRoles(new NetworkError())).toBe('conexion');
    expect(clasificarFalloRoles(new Error('x'))).toBe('otro');
  });
});
