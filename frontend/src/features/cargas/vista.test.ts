import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import { TIPO_CFDI, TIPO_ESTADO_CUENTA } from '@/shared/dominio';
import {
  derivarPanel,
  estadoActualizacion,
  mensajeYaExistia,
  puedeSubir,
  vistaHistorial,
} from './vista';

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

describe('derivarPanel', () => {
  const panel = (tipo: typeof TIPO_CFDI | typeof TIPO_ESTADO_CUENTA) => ({
    tipo,
    epoca: 3,
    soloAviso: false,
  });

  it('sin panel no hay nada', () => {
    expect(
      derivarPanel({ panel: null, datos: { estado: 'procesada' }, epoca: 3 }),
    ).toBe('ninguno');
  });

  it('un panel sin datos todavía no hay nada que mostrar', () => {
    expect(
      derivarPanel({ panel: panel(TIPO_CFDI), datos: null, epoca: 3 }),
    ).toBe('ninguno');
  });

  it.each(['pendiente', 'procesando'] as const)(
    'un estado activo (%s): en curso, sea cual sea el tipo',
    (estado) => {
      for (const tipo of [TIPO_CFDI, TIPO_ESTADO_CUENTA]) {
        expect(
          derivarPanel({ panel: panel(tipo), datos: { estado }, epoca: 3 }),
        ).toBe('en_curso');
      }
    },
  );

  it.each(['procesada', 'con_errores'] as const)(
    'concluida (%s): por archivo para CFDI, por fila para estado de cuenta',
    (estado) => {
      expect(
        derivarPanel({ panel: panel(TIPO_CFDI), datos: { estado }, epoca: 3 }),
      ).toBe('por_archivo');
      expect(
        derivarPanel({
          panel: panel(TIPO_ESTADO_CUENTA),
          datos: { estado },
          epoca: 3,
        }),
      ).toBe('por_fila');
    },
  );

  it('fallida: sin proceso, sin lista de archivos, en los dos tipos', () => {
    for (const tipo of [TIPO_CFDI, TIPO_ESTADO_CUENTA]) {
      expect(
        derivarPanel({
          panel: panel(tipo),
          datos: { estado: 'fallida' },
          epoca: 3,
        }),
      ).toBe('sin_proceso');
    }
  });

  it.each(['procesada', 'con_errores'] as const)(
    'un yaExistia ya terminado (%s): solo el aviso, sin resultados',
    (estado) => {
      for (const tipo of [TIPO_CFDI, TIPO_ESTADO_CUENTA]) {
        expect(
          derivarPanel({
            panel: { ...panel(tipo), soloAviso: true },
            datos: { estado },
            epoca: 3,
          }),
        ).toBe('solo_aviso');
      }
    },
  );

  it('un yaExistia fallido sigue mostrando la falla, y uno activo el proceso', () => {
    const p = { ...panel(TIPO_CFDI), soloAviso: true };
    expect(
      derivarPanel({ panel: p, datos: { estado: 'fallida' }, epoca: 3 }),
    ).toBe('sin_proceso');
    expect(
      derivarPanel({ panel: p, datos: { estado: 'pendiente' }, epoca: 3 }),
    ).toBe('en_curso');
  });

  it('un panel de otra época no se muestra', () => {
    expect(
      derivarPanel({
        panel: panel(TIPO_CFDI),
        datos: { estado: 'procesada' },
        epoca: 4,
      }),
    ).toBe('ninguno');
    expect(
      derivarPanel({
        panel: panel(TIPO_CFDI),
        datos: { estado: 'procesada' },
        epoca: null,
      }),
    ).toBe('ninguno');
  });
});

describe('mensajeYaExistia (K7)', () => {
  it.each(['procesada', 'con_errores'] as const)(
    '%s: ya se había cargado y no se duplicó nada (dos frases)',
    (estado) => {
      expect(mensajeYaExistia(estado)).toEqual([
        'Este archivo ya se había cargado.',
        'No se duplicó nada.',
      ]);
    },
  );

  it.each(['pendiente', 'procesando', 'fallida'] as const)(
    '%s: se volvió a poner en la cola (una frase)',
    (estado) => {
      expect(mensajeYaExistia(estado)).toEqual([
        'Este archivo ya se había cargado y se volvió a poner en la cola.',
      ]);
    },
  );
});

describe('estadoActualizacion (G13, K5)', () => {
  it('con la tabla visible y algo activo: se actualiza sola', () => {
    expect(
      estadoActualizacion({ vista: 'tabla', activo: true, capada: false }),
    ).toBe('actualizando');
  });

  it('con el tope vencido y algo activo: detenida', () => {
    expect(
      estadoActualizacion({ vista: 'tabla', activo: true, capada: true }),
    ).toBe('detenida');
  });

  it('sin nada activo no hay aviso, aunque el tope haya vencido', () => {
    expect(
      estadoActualizacion({ vista: 'tabla', activo: false, capada: false }),
    ).toBeNull();
    expect(
      estadoActualizacion({ vista: 'tabla', activo: false, capada: true }),
    ).toBeNull();
  });

  it.each(['cargando', 'vacio', 'fallo', 'sin_permiso', null] as const)(
    'con la vista %s no hay aviso (el mockup solo lo pone con la tabla)',
    (vista) => {
      expect(estadoActualizacion({ vista, activo: true, capada: false })).toBe(
        null,
      );
      expect(estadoActualizacion({ vista, activo: true, capada: true })).toBe(
        null,
      );
    },
  );
});
