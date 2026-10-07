import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import {
  derivarFormulario,
  puedeEditar,
  vistaValor,
  type EntradaFormulario,
} from './vista';

describe('puedeEditar (TOL-8)', () => {
  it.each([
    [['admin'], true],
    [['contador', 'admin'], true],
    [['admin', 'revisor'], true],
    [['contador'], false],
    [['revisor'], false],
    [['contador', 'revisor'], false],
    [[], false],
  ])('roles %j -> %s', (roles, esperado) => {
    expect(puedeEditar(roles)).toBe(esperado);
  });

  it('el rol no se compara por mayúsculas: Admin no es admin', () => {
    expect(puedeEditar(['Admin'])).toBe(false);
  });
});

const entrada = (
  parcial: Partial<EntradaFormulario> = {},
): EntradaFormulario => ({
  borrador: null,
  actual: '0.5000',
  guardando: false,
  ...parcial,
});

describe('derivarFormulario: campo sin tocar (AS-3)', () => {
  it('muestra el valor vigente formateado, sin error y sin poder guardar', () => {
    expect(derivarFormulario(entrada())).toEqual({
      texto: '0.50',
      ayuda: 'normal',
      invalido: null,
      puedeGuardar: false,
      valorAGuardar: null,
    });
  });

  it('formatea sin redondear: 0.0050 -> 0.005', () => {
    expect(derivarFormulario(entrada({ actual: '0.0050' })).texto).toBe(
      '0.005',
    );
  });

  it('la ayuda de «es el valor actual» NO sale antes de escribir', () => {
    expect(derivarFormulario(entrada()).ayuda).toBe('normal');
  });

  it('un valor vigente que el formateador no reconoce se muestra tal cual (defensivo)', () => {
    expect(derivarFormulario(entrada({ actual: 'abc' })).texto).toBe('abc');
  });
});

describe('derivarFormulario: borrador inválido', () => {
  it.each([
    ['', 'vacio'],
    ['   ', 'vacio'],
    ['0,5', 'formato'],
    ['abc', 'formato'],
    ['100.5', 'rango'],
    ['-1', 'rango'],
    ['0.12345', 'decimales'],
    ['100.00001', 'decimales'],
  ])('%j -> %s, sin guardar y con el texto tal cual', (borrador, motivo) => {
    expect(derivarFormulario(entrada({ borrador }))).toEqual({
      texto: borrador,
      ayuda: 'normal',
      invalido: motivo,
      puedeGuardar: false,
      valorAGuardar: null,
    });
  });

  it('inválido gana al mismo valor: 0.50000 con 0.5000 es decimales, no igual (TOL-5.2)', () => {
    const r = derivarFormulario(
      entrada({ actual: '0.0050', borrador: '0.00500' }),
    );
    expect(r.invalido).toBe('decimales');
    expect(r.ayuda).toBe('normal');
    expect(r.puedeGuardar).toBe(false);
  });
});

describe('derivarFormulario: valor válido', () => {
  it.each([
    ['0.5', '0.5000'],
    ['0.50', '0.5000'],
    ['0.5000', '0.5000'],
    ['0.005', '0.0050'],
    ['1', '1.0000'],
  ])(
    '%s con vigente %s es el mismo valor: no se guarda',
    (borrador, actual) => {
      expect(derivarFormulario(entrada({ borrador, actual }))).toEqual({
        texto: borrador,
        ayuda: 'mismo_valor',
        invalido: null,
        puedeGuardar: false,
        valorAGuardar: null,
      });
    },
  );

  it('un valor distinto se puede guardar y lleva el texto recortado', () => {
    expect(derivarFormulario(entrada({ borrador: ' 0.75 ' }))).toEqual({
      texto: ' 0.75 ',
      ayuda: 'normal',
      invalido: null,
      puedeGuardar: true,
      valorAGuardar: '0.75',
    });
  });

  it('el valor a guardar conserva los dígitos como se escribieron', () => {
    expect(derivarFormulario(entrada({ borrador: '007' })).valorAGuardar).toBe(
      '007',
    );
  });

  it('mientras guarda no se puede guardar otra vez', () => {
    const r = derivarFormulario(entrada({ borrador: '0.75', guardando: true }));
    expect(r.puedeGuardar).toBe(false);
    expect(r.invalido).toBeNull();
  });

  it('prioridad: inválido > mismo valor > ayuda normal (AS-2)', () => {
    const inv = derivarFormulario(entrada({ borrador: 'x' }));
    const igual = derivarFormulario(entrada({ borrador: '0.5' }));
    const normal = derivarFormulario(entrada({ borrador: '0.51' }));
    expect([inv.invalido, inv.ayuda]).toEqual(['formato', 'normal']);
    expect([igual.invalido, igual.ayuda]).toEqual([null, 'mismo_valor']);
    expect([normal.invalido, normal.ayuda]).toEqual([null, 'normal']);
  });
});

describe('vistaValor (TOL-2)', () => {
  const sinDatos = { data: undefined, error: null } as const;

  it('sin datos ni error está cargando', () => {
    expect(vistaValor(sinDatos)).toEqual({ tipo: 'cargando' });
  });

  it('con datos está listo y lleva la cadena del servidor', () => {
    expect(
      vistaValor({ data: { toleranciaMonto: '0.5000' }, error: null }),
    ).toEqual({ tipo: 'listo', valor: '0.5000' });
  });

  it('un fallo de segundo plano con datos a la vista sigue listo', () => {
    expect(
      vistaValor({
        data: { toleranciaMonto: '0.5000' },
        error: new NetworkError(),
      }),
    ).toEqual({ tipo: 'listo', valor: '0.5000' });
  });

  it('un fallo de red sin datos es conexión (TOL-2.2)', () => {
    expect(vistaValor({ ...sinDatos, error: new NetworkError() })).toEqual({
      tipo: 'error',
      clase: 'conexion',
    });
  });

  it('un 403 sin datos es sin permiso (TOL-2.3)', () => {
    expect(
      vistaValor({ ...sinDatos, error: new ApiError(403, 'Forbidden', []) }),
    ).toEqual({ tipo: 'error', clase: 'sin_permiso' });
  });

  it.each([400, 404, 500, 503])(
    'un %i sin datos es el genérico, no conexión (TOL-2.4)',
    (status) => {
      expect(
        vistaValor({ ...sinDatos, error: new ApiError(status, 'Error', []) }),
      ).toEqual({ tipo: 'error', clase: 'otro' });
    },
  );

  it('una respuesta fuera de contrato es el genérico (TOL-1.6)', () => {
    expect(vistaValor({ ...sinDatos, error: new ContratoError() })).toEqual({
      tipo: 'error',
      clase: 'otro',
    });
  });

  it('un 401 no dice nada: la capa de sesión lo atiende y la tarjeta sigue cargando', () => {
    expect(
      vistaValor({ ...sinDatos, error: new ApiError(401, 'Unauthorized', []) }),
    ).toEqual({ tipo: 'cargando' });
  });
});
