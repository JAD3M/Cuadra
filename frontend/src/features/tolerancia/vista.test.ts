import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import type { CambioTolerancia } from '@/shared/api/contratos';
import {
  derivarFormulario,
  filasDeCambios,
  puedeEditar,
  vistaCambios,
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

const cambio = (parcial: Partial<CambioTolerancia> = {}): CambioTolerancia => ({
  id: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-09-02T17:40:00.000Z',
  usuario: { nombre: 'Ana Mendoza' },
  datos: { campo: 'tolerancia_monto', antes: '0.0050', despues: '0.5000' },
  ...parcial,
});

describe('filasDeCambios (TOL-10.3-10.6)', () => {
  it('muestra antes y despues exactos, sin redondear (TOL-10.3)', () => {
    const [fila] = filasDeCambios([cambio()], 'UTC');
    expect(fila?.antes).toBe('$0.005');
    expect(fila?.despues).toBe('$0.50');
  });

  it('conserva cuatro decimales y recorta ceros hasta dos (TOL-10.6)', () => {
    const [fila] = filasDeCambios(
      [
        cambio({
          datos: {
            campo: 'tolerancia_monto',
            antes: '1.2340',
            despues: '0.0001',
          },
        }),
      ],
      'UTC',
    );
    expect(fila?.antes).toBe('$1.234');
    expect(fila?.despues).toBe('$0.0001');
  });

  it('el autor es el nombre del usuario; sin usuario, una raya (TOL-10.4)', () => {
    const filas = filasDeCambios([cambio(), cambio({ usuario: null })], 'UTC');
    expect(filas.map((f) => f.quien)).toEqual(['Ana Mendoza', '—']);
  });

  it('la fecha es YYYY-MM-DD HH:mm del instante en la zona dada (TOL-10.3)', () => {
    const [fila] = filasDeCambios([cambio()], 'UTC');
    expect(fila?.fecha).toBe('2026-09-02 17:40');
    const [otra] = filasDeCambios([cambio()], 'America/Mexico_City');
    expect(otra?.fecha).toBe('2026-09-02 11:40');
  });

  it('solo la primera fila es la reciente y el orden del servidor se respeta', () => {
    const filas = filasDeCambios(
      [
        cambio({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
        cambio({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
        cambio({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
      ],
      'UTC',
    );
    expect(filas.map((f) => f.id)).toEqual([
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    ]);
    expect(filas.map((f) => f.reciente)).toEqual([true, false, false]);
  });

  it('sin cambios no hay filas', () => {
    expect(filasDeCambios([], 'UTC')).toEqual([]);
  });
});

describe('vistaCambios (TOL-10)', () => {
  const sinDatos = { data: undefined, error: null } as const;

  it('sin datos ni error, cargando', () => {
    expect(vistaCambios(sinDatos)).toEqual({ tipo: 'cargando' });
  });

  it('una lista vacia tras filtrar es el estado vacio (TOL-10.8)', () => {
    expect(vistaCambios({ data: [], error: null })).toEqual({ tipo: 'vacio' });
  });

  it('con cambios es la lista con sus filas', () => {
    const estado = vistaCambios({ data: [cambio()], error: null }, 'UTC');
    expect(estado).toEqual({
      tipo: 'lista',
      filas: filasDeCambios([cambio()], 'UTC'),
    });
  });

  it('con datos, un fallo de segundo plano no esconde la lista', () => {
    const estado = vistaCambios(
      { data: [cambio()], error: new NetworkError() },
      'UTC',
    );
    expect(estado.tipo).toBe('lista');
  });

  it('un fallo de red sin datos es conexion (TOL-10.9)', () => {
    expect(vistaCambios({ ...sinDatos, error: new NetworkError() })).toEqual({
      tipo: 'error',
      clase: 'conexion',
    });
  });

  it('un 403 sin datos es sin permiso', () => {
    expect(
      vistaCambios({ ...sinDatos, error: new ApiError(403, 'Forbidden', []) }),
    ).toEqual({ tipo: 'error', clase: 'sin_permiso' });
  });

  it.each([400, 404, 500])('un %i sin datos es el generico', (status) => {
    expect(
      vistaCambios({ ...sinDatos, error: new ApiError(status, 'Error', []) }),
    ).toEqual({ tipo: 'error', clase: 'otro' });
  });

  it('un sobre fuera de contrato es el generico', () => {
    expect(vistaCambios({ ...sinDatos, error: new ContratoError() })).toEqual({
      tipo: 'error',
      clase: 'otro',
    });
  });

  it('un 401 no dice nada: la tarjeta sigue cargando', () => {
    expect(
      vistaCambios({
        ...sinDatos,
        error: new ApiError(401, 'Unauthorized', []),
      }),
    ).toEqual({ tipo: 'cargando' });
  });
});
