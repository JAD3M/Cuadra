import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import { puedeSubir, vistaHistorial } from './vista';

const CON_DATOS = { datos: [{ id: 'a' }] };
const SIN_DATOS = { datos: [] };

function apiError(statusCode: number) {
  return new ApiError(statusCode, 'Error', []);
}

describe('vistaHistorial', () => {
  it('sin datos y pendiente: cargando', () => {
    expect(
      vistaHistorial({ data: undefined, error: null, isPending: true }),
    ).toBe('cargando');
  });

  it('con una lista vacía: vacio', () => {
    expect(
      vistaHistorial({ data: SIN_DATOS, error: null, isPending: false }),
    ).toBe('vacio');
  });

  it('con filas: tabla', () => {
    expect(
      vistaHistorial({ data: CON_DATOS, error: null, isPending: false }),
    ).toBe('tabla');
  });

  it.each([
    ['red', new NetworkError()],
    ['5xx', apiError(500)],
    ['contrato', new ContratoError()],
  ])('sin datos y con fallo de %s: fallo', (_nombre, error) => {
    expect(vistaHistorial({ data: undefined, error, isPending: false })).toBe(
      'fallo',
    );
  });

  it('sin datos y con 403: sin_permiso', () => {
    expect(
      vistaHistorial({
        data: undefined,
        error: apiError(403),
        isPending: false,
      }),
    ).toBe('sin_permiso');
  });

  it('un 401 no muestra nada: lo atiende la capa de sesión', () => {
    expect(
      vistaHistorial({
        data: undefined,
        error: apiError(401),
        isPending: false,
      }),
    ).toBeNull();
  });

  it('una cancelación no muestra nada', () => {
    expect(
      vistaHistorial({
        data: undefined,
        error: new DOMException('cancelada', 'AbortError'),
        isPending: false,
      }),
    ).toBeNull();
  });

  it('un sondeo que falla con datos en pantalla sigue siendo tabla', () => {
    expect(
      vistaHistorial({
        data: CON_DATOS,
        error: new NetworkError(),
        isPending: false,
      }),
    ).toBe('tabla');
    expect(
      vistaHistorial({
        data: CON_DATOS,
        error: apiError(403),
        isPending: false,
      }),
    ).toBe('tabla');
  });

  it('un fallo con la lista vacía ya cargada sigue siendo vacio', () => {
    expect(
      vistaHistorial({
        data: SIN_DATOS,
        error: apiError(500),
        isPending: false,
      }),
    ).toBe('vacio');
  });

  it('sin datos, sin error y sin pendiente no hay nada que decir', () => {
    expect(
      vistaHistorial({ data: undefined, error: null, isPending: false }),
    ).toBeNull();
  });
});

describe('puedeSubir', () => {
  it.each([
    [['admin'], true],
    [['contador'], true],
    [['admin', 'contador'], true],
    [['revisor', 'contador'], true],
    [['revisor'], false],
    [[], false],
  ])('roles %j: %s', (roles, esperado) => {
    expect(puedeSubir(roles)).toBe(esperado);
  });
});
