import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from './errores';
import { mensajeDeError, type ContextoMensaje } from './mensajes';

const CONEXION = {
  titulo: 'No se pudo conectar con el servidor.',
  detalle: 'Inténtalo de nuevo.',
  tipo: 'conexion',
};
const CREDENCIALES = {
  titulo: 'Correo o contraseña incorrectos',
  detalle: 'Revisa tus datos e inténtalo de nuevo.',
  tipo: 'credenciales',
};
const SIN_EMPRESAS = {
  titulo: 'Tu usuario no tiene empresas asignadas.',
  detalle: 'Contacta a un administrador.',
  tipo: 'sin_empresas',
};
const SIN_ACCESO = {
  titulo: 'Ya no tienes acceso a esta empresa.',
  detalle: 'Elige otra de la lista.',
  tipo: 'sin_acceso',
};
const SIN_PERMISO = {
  titulo: 'No tienes permiso para esta acción.',
  tipo: 'sin_permiso',
};
const OTRO = {
  titulo: 'No se pudo completar la solicitud.',
  tipo: 'otro',
};

const api = (codigo: number, mensaje = 'texto del servidor') =>
  new ApiError(codigo, 'Error', [mensaje]);

describe('mensajeDeError', () => {
  const tabla: [string, unknown, ContextoMensaje, unknown][] = [
    ['login + 401', api(401), 'login', CREDENCIALES],
    ['login + 400', api(400), 'login', CREDENCIALES],
    ['login + 403', api(403), 'login', SIN_EMPRESAS],
    ['seleccion + 403', api(403), 'seleccion', SIN_ACCESO],
    ['general + 403', api(403), 'general', SIN_PERMISO],
    ['sin contexto + 403', api(403), undefined as never, SIN_PERMISO],
    ['general + 404', api(404), 'general', OTRO],
    ['general + 409', api(409), 'general', OTRO],
    ['general + 422', api(422), 'general', OTRO],
    ['seleccion + 401', api(401), 'seleccion', OTRO],
    ['general + 401', api(401), 'general', OTRO],
    ['login + 500', api(500), 'login', CONEXION],
    ['seleccion + 502', api(502), 'seleccion', CONEXION],
    ['general + 503', api(503), 'general', CONEXION],
    ['login + red', new NetworkError(), 'login', CONEXION],
    ['seleccion + red', new NetworkError(), 'seleccion', CONEXION],
    ['general + red', new NetworkError(), 'general', CONEXION],
    ['login + contrato', new ContratoError(), 'login', CONEXION],
    [
      'general + cuerpo no JSON',
      new ContratoError(undefined),
      'general',
      CONEXION,
    ],
    ['error inesperado', new Error('boom'), 'general', OTRO],
    ['valor no error', 'cadena', 'general', OTRO],
  ];

  it.each(tabla)('%s', (_nombre, error, contexto, esperado) => {
    expect(mensajeDeError(error, contexto)).toEqual(esperado);
  });

  it('una cancelación devuelve null en cualquier contexto', () => {
    const cancelacion = new DOMException('cancelado', 'AbortError');
    for (const contexto of ['login', 'seleccion', 'general'] as const) {
      expect(mensajeDeError(cancelacion, contexto)).toBeNull();
    }
  });

  it('cada tipo de fallo da un mensaje distinto', () => {
    const titulos = [
      mensajeDeError(api(401), 'login'),
      mensajeDeError(api(403), 'general'),
      mensajeDeError(new NetworkError(), 'general'),
      mensajeDeError(api(404), 'general'),
    ].map((m) => m?.titulo);
    expect(new Set(titulos).size).toBe(titulos.length);
  });

  it('el texto del servidor nunca aparece', () => {
    const casos: [unknown, ContextoMensaje][] = [
      [api(403, 'x-secret'), 'general'],
      [api(403, 'x-secret'), 'login'],
      [api(403, 'x-secret'), 'seleccion'],
      [api(401, 'x-secret'), 'login'],
      [api(404, 'x-secret'), 'general'],
      [api(500, 'x-secret'), 'general'],
    ];
    for (const [error, contexto] of casos) {
      expect(JSON.stringify(mensajeDeError(error, contexto))).not.toContain(
        'x-secret',
      );
    }
  });

  it('no incluye tokens, Bearer ni la causa del error', () => {
    const error = new NetworkError({
      cause: new Error('Authorization: Bearer abc.def.ghi'),
    });
    const texto = JSON.stringify(mensajeDeError(error, 'general'));
    expect(texto).not.toContain('Bearer');
    expect(texto).not.toContain('abc.def.ghi');
    const conToken = JSON.stringify(
      mensajeDeError(api(401, 'Bearer abc.def.ghi'), 'login'),
    );
    expect(conToken).not.toContain('Bearer');
    expect(conToken).not.toContain('abc.def.ghi');
  });
});
