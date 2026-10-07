import { describe, expect, it } from 'vitest';
import type { AccionBitacora } from '@/shared/dominio';
import { detalleEvento, segmentosDeDetalle } from './detalle';

// Formas reales de `datos`, copiadas de lo que escribe el backend:
// crear regla  src/conciliacion/conciliacion.service.ts:203-211
// crear llm    src/sugerencias/persistencia-sugerencias.ts:148-158
// confirmar    src/resolucion/resolucion.service.ts:142-171
// rechazar     src/resolucion/resolucion.service.ts:290-305 (manual)
//              src/resolucion/resolucion.service.ts:173-191 (hermana)
// actualizar   src/companies/tolerancia.service.ts:57-65
// acceso_denegado src/bitacora/accesos-denegados.ts:45-53

const CFDI = '0192a3f4-0000-7000-8000-000000000001';
const MOV = '0192a3f4-0000-7000-8000-000000000002';

const crearRegla = (diferenciaMonto: unknown = '0.5000') => ({
  despues: { estado: 'propuesta' },
  origen: 'regla',
  regla: 'monto_exacto',
  score: '0.9500',
  diferenciaMonto,
  cfdiId: CFDI,
  movimientoId: MOV,
});

const crearLlm = (extra: Record<string, unknown> = {}) => ({
  despues: { estado: 'propuesta' },
  origen: 'llm',
  regla: 'llm_sugerencia',
  modelo: 'modelo-x',
  inputHash: 'abc',
  confianza: '0.8100',
  cfdiId: CFDI,
  movimientoId: MOV,
  ...extra,
});

const confirmar = (diferenciaMonto: unknown = '0.0000') => ({
  antes: { estado: 'propuesta' },
  despues: {
    estado: 'confirmada',
    confirmadaPorId: CFDI,
    confirmadaAt: '2026-09-18T22:02:00.000Z',
  },
  cfdi: { id: CFDI, antes: 'abierta', despues: 'conciliada' },
  movimiento: { id: MOV, antes: 'abierto', despues: 'conciliado' },
  diferenciaMonto,
  regla: 'monto_exacto',
  score: '0.9500',
});

const rechazarManual = (
  motivo: unknown = 'el CFDI corresponde a otra obra',
) => ({
  antes: { estado: 'propuesta', motivo: null },
  despues: { estado: 'rechazada', motivo },
  cfdiId: CFDI,
  movimientoId: MOV,
  diferenciaMonto: '0.5000',
});

const rechazarHermana = () => ({
  antes: { estado: 'propuesta' },
  despues: { estado: 'rechazada', motivo: 'otra propuesta fue confirmada' },
  cfdiId: CFDI,
  movimientoId: MOV,
  causa: { conciliacionId: CFDI },
});

const actualizar = (
  antes: unknown = '0.0050',
  despues: unknown = '0.5000',
) => ({
  campo: 'tolerancia_monto',
  antes,
  despues,
});

const denegado = (o: Record<string, unknown> = {}) => ({
  metodo: 'PUT',
  ruta: '/empresa/tolerancia',
  motivo: 'rol_insuficiente',
  rolesRequeridos: ['admin'],
  rolesDelUsuario: ['revisor'],
  ...o,
});

describe('detalleEvento: las siete filas de la maqueta', () => {
  it.each<[string, AccionBitacora, unknown, string]>([
    [
      'crear regla',
      'crear',
      crearRegla('0.5000'),
      'propuesta · origen regla · diferencia $0.50',
    ],
    ['crear llm sin diferencia', 'crear', crearLlm(), 'propuesta · origen llm'],
    [
      'confirmar',
      'confirmar',
      confirmar('0.0000'),
      'propuesta → confirmada · diferencia $0.00',
    ],
    [
      'rechazar manual',
      'rechazar',
      rechazarManual(),
      'propuesta → rechazada · motivo: el CFDI corresponde a otra obra',
    ],
    [
      'actualizar tolerancia',
      'actualizar',
      actualizar('0.0050', '0.5000'),
      'tolerancia_monto: $0.005 → $0.50',
    ],
    [
      'acceso denegado por rol',
      'acceso_denegado',
      denegado(),
      'PUT /empresa/tolerancia · rol insuficiente: requiere admin, tiene revisor',
    ],
    ['eliminar', 'eliminar', { cualquier: 'cosa' }, '—'],
  ])('%s', (_nombre, accion, datos, esperado) => {
    expect(detalleEvento({ accion, datos })).toBe(esperado);
  });
});

describe('detalleEvento: decisiones D17 a D21', () => {
  it('D19: un crear de llm con diferenciaMonto la muestra', () => {
    expect(
      detalleEvento({
        accion: 'crear',
        datos: crearLlm({ diferenciaMonto: '1.2000' }),
      }),
    ).toBe('propuesta · origen llm · diferencia $1.20');
  });

  it('D20: un rechazo causado por una hermana no lleva motivo', () => {
    expect(
      detalleEvento({ accion: 'rechazar', datos: rechazarHermana() }),
    ).toBe('propuesta → rechazada');
  });

  it('un rechazo manual sin motivo omite el segmento', () => {
    expect(
      detalleEvento({ accion: 'rechazar', datos: rechazarManual('') }),
    ).toBe('propuesta → rechazada');
    expect(
      detalleEvento({ accion: 'rechazar', datos: rechazarManual(null) }),
    ).toBe('propuesta → rechazada');
  });

  it('D21: actualizar de otro campo muestra —', () => {
    expect(
      detalleEvento({
        accion: 'actualizar',
        datos: { ...actualizar(), campo: 'otro_campo' },
      }),
    ).toBe('—');
  });

  it('D17: sin membresía muestra método, ruta y el motivo', () => {
    expect(
      detalleEvento({
        accion: 'acceso_denegado',
        datos: denegado({
          motivo: 'sin_membresia',
          rolesRequeridos: ['admin', 'contador', 'revisor'],
          rolesDelUsuario: [],
        }),
      }),
    ).toBe('PUT /empresa/tolerancia · sin membresía en la empresa');
    expect(
      detalleEvento({
        accion: 'acceso_denegado',
        datos: denegado({
          metodo: 'GET',
          ruta: '/bitacora',
          motivo: 'sin_membresia',
          rolesDelUsuario: [],
        }),
      }),
    ).toBe('GET /bitacora · sin membresía en la empresa');
  });

  it('D18: varios roles requeridos se unen con " o "', () => {
    expect(
      detalleEvento({
        accion: 'acceso_denegado',
        datos: denegado({
          rolesRequeridos: ['admin', 'contador'],
          rolesDelUsuario: ['revisor'],
        }),
      }),
    ).toBe(
      'PUT /empresa/tolerancia · rol insuficiente: requiere admin o contador, tiene revisor',
    );
  });

  it('D18: varios roles del usuario se unen con " y "', () => {
    expect(
      detalleEvento({
        accion: 'acceso_denegado',
        datos: denegado({
          rolesRequeridos: ['admin'],
          rolesDelUsuario: ['contador', 'revisor'],
        }),
      }),
    ).toBe(
      'PUT /empresa/tolerancia · rol insuficiente: requiere admin, tiene contador y revisor',
    );
  });

  it('la denegación por segregación de funciones (el usuario SÍ tiene el rol) muestra —', () => {
    // El backend la guarda como rol_insuficiente aunque haya traslape entre lo
    // requerido y lo que tiene: afirmar "requiere admin o contador, tiene
    // contador" sería falso.
    expect(
      detalleEvento({
        accion: 'acceso_denegado',
        datos: denegado({
          rolesRequeridos: ['admin', 'contador'],
          rolesDelUsuario: ['contador'],
        }),
      }),
    ).toBe('—');
    expect(
      detalleEvento({
        accion: 'acceso_denegado',
        datos: denegado({
          rolesRequeridos: ['admin', 'contador'],
          rolesDelUsuario: ['contador', 'revisor'],
        }),
      }),
    ).toBe('—');
  });

  it('rol insuficiente con listas de roles vacías o mal formadas muestra —', () => {
    for (const o of [
      { rolesDelUsuario: [] },
      { rolesRequeridos: [] },
      { rolesRequeridos: 'admin' },
      { rolesDelUsuario: [1] },
      { rolesDelUsuario: [''] },
    ]) {
      expect(
        detalleEvento({ accion: 'acceso_denegado', datos: denegado(o) }),
      ).toBe('—');
    }
  });

  it('acceso denegado con motivo desconocido o sin método/ruta muestra —', () => {
    expect(
      detalleEvento({
        accion: 'acceso_denegado',
        datos: denegado({ motivo: 'otro' }),
      }),
    ).toBe('—');
    expect(
      detalleEvento({
        accion: 'acceso_denegado',
        datos: denegado({ metodo: undefined }),
      }),
    ).toBe('—');
    expect(
      detalleEvento({
        accion: 'acceso_denegado',
        datos: denegado({ ruta: 7 }),
      }),
    ).toBe('—');
  });
});

describe('detalleEvento: dinero sin pasar por flotantes', () => {
  it('una diferencia negativa lleva el signo antes del símbolo', () => {
    expect(
      detalleEvento({ accion: 'confirmar', datos: confirmar('-60.0000') }),
    ).toBe('propuesta → confirmada · diferencia -$60.00');
    expect(
      detalleEvento({ accion: 'crear', datos: crearRegla('-60.0000') }),
    ).toBe('propuesta · origen regla · diferencia -$60.00');
  });

  it('el signo nunca queda después del símbolo', () => {
    const texto = detalleEvento({
      accion: 'confirmar',
      datos: confirmar('-60.0000'),
    });
    expect(texto).not.toContain('$-');
  });

  it.each([
    ['0.1000', '$0.10'],
    ['99999999999999.9999', '$99999999999999.9999'],
    ['0.0050', '$0.005'],
    ['1.2340', '$1.234'],
    ['0.12345', '$0.12345'],
    ['12345678901234.5678', '$12345678901234.5678'],
    ['0.0001', '$0.0001'],
    ['100', '$100.00'],
    ['0.0000', '$0.00'],
  ])('diferenciaMonto %s se ve %s sin redondear', (entrada, esperado) => {
    expect(
      detalleEvento({ accion: 'confirmar', datos: confirmar(entrada) }),
    ).toBe(`propuesta → confirmada · diferencia ${esperado}`);
  });

  it('actualizar muestra antes y después exactos', () => {
    expect(
      detalleEvento({
        accion: 'actualizar',
        datos: actualizar('1.2340', '12345678901234.5678'),
      }),
    ).toBe('tolerancia_monto: $1.234 → $12345678901234.5678');
  });

  it('un monto que no es un decimal en cadena omite el segmento', () => {
    for (const malo of ['abc', '', '1e3', '1,000.00', 5, null, {}, ['1']]) {
      expect(
        detalleEvento({ accion: 'confirmar', datos: confirmar(malo) }),
      ).toBe('propuesta → confirmada');
      expect(detalleEvento({ accion: 'crear', datos: crearRegla(malo) })).toBe(
        'propuesta · origen regla',
      );
    }
  });

  it('un actualizar con un monto que no es decimal en cadena muestra —', () => {
    for (const malo of ['abc', '', 5, null]) {
      expect(
        detalleEvento({ accion: 'actualizar', datos: actualizar(malo) }),
      ).toBe('—');
      expect(
        detalleEvento({
          accion: 'actualizar',
          datos: actualizar('0.5000', malo),
        }),
      ).toBe('—');
    }
  });
});

describe('detalleEvento: datos ausentes o mal formados', () => {
  const ACCIONES: AccionBitacora[] = [
    'crear',
    'actualizar',
    'eliminar',
    'cargar',
    'confirmar',
    'rechazar',
    'acceso_denegado',
  ];

  it.each<[string, unknown]>([
    ['null', null],
    ['undefined', undefined],
    ['objeto vacío', {}],
    ['arreglo', ['a']],
    ['arreglo vacío', []],
    ['texto', 'texto'],
    ['número', 42],
    ['booleano', true],
  ])('datos %s da — en las siete acciones y no lanza', (_n, datos) => {
    for (const accion of ACCIONES) {
      expect(detalleEvento({ accion, datos })).toBe('—');
    }
  });

  it('claves de las que depende la acción con el tipo equivocado dan —', () => {
    expect(
      detalleEvento({
        accion: 'confirmar',
        datos: { antes: 'propuesta', despues: { estado: 'confirmada' } },
      }),
    ).toBe('—');
    expect(
      detalleEvento({
        accion: 'confirmar',
        datos: { antes: { estado: 1 }, despues: { estado: 'confirmada' } },
      }),
    ).toBe('—');
    expect(
      detalleEvento({ accion: 'crear', datos: { despues: { estado: '' } } }),
    ).toBe('—');
    expect(
      detalleEvento({
        accion: 'actualizar',
        datos: { campo: 'tolerancia_monto', antes: 5, despues: '1.00' },
      }),
    ).toBe('—');
  });

  it('eliminar y cargar dan — aunque traigan datos completos', () => {
    expect(detalleEvento({ accion: 'eliminar', datos: confirmar() })).toBe('—');
    expect(detalleEvento({ accion: 'cargar', datos: crearRegla() })).toBe('—');
  });

  it('un crear sin origen conserva el estado y la diferencia', () => {
    expect(
      detalleEvento({
        accion: 'crear',
        datos: { despues: { estado: 'propuesta' }, diferenciaMonto: '0.5000' },
      }),
    ).toBe('propuesta · diferencia $0.50');
  });
});

describe('detalleEvento: texto del usuario', () => {
  it('el motivo con HTML sale tal cual, como texto', () => {
    const motivo = '<img src=x onerror=alert(1)>';
    expect(
      detalleEvento({ accion: 'rechazar', datos: rechazarManual(motivo) }),
    ).toBe(`propuesta → rechazada · motivo: ${motivo}`);
  });
});

describe('segmentosDeDetalle', () => {
  it('aísla cada monto en su propio segmento', () => {
    expect(
      segmentosDeDetalle('propuesta · origen regla · diferencia $0.50'),
    ).toEqual([
      { texto: 'propuesta · origen regla · diferencia ', monto: false },
      { texto: '$0.50', monto: true },
    ]);
  });

  it('separa varios montos y conserva el texto entre ellos', () => {
    expect(segmentosDeDetalle('tolerancia_monto: $0.005 → $0.50')).toEqual([
      { texto: 'tolerancia_monto: ', monto: false },
      { texto: '$0.005', monto: true },
      { texto: ' → ', monto: false },
      { texto: '$0.50', monto: true },
    ]);
  });

  it('un monto negativo queda entero, con su signo', () => {
    expect(
      segmentosDeDetalle('propuesta → confirmada · diferencia -$60.00'),
    ).toEqual([
      { texto: 'propuesta → confirmada · diferencia ', monto: false },
      { texto: '-$60.00', monto: true },
    ]);
  });

  it('un monto al inicio y un texto sin montos', () => {
    expect(segmentosDeDetalle('$1.234 al inicio')).toEqual([
      { texto: '$1.234', monto: true },
      { texto: ' al inicio', monto: false },
    ]);
    expect(segmentosDeDetalle('—')).toEqual([{ texto: '—', monto: false }]);
  });

  it('un texto vacío no da segmentos', () => {
    expect(segmentosDeDetalle('')).toEqual([]);
  });

  it('volver a unir los segmentos reconstruye el texto', () => {
    const texto = detalleEvento({
      accion: 'actualizar',
      datos: actualizar('1.2340', '12345678901234.5678'),
    });
    const segmentos = segmentosDeDetalle(texto);
    expect(segmentos.filter((s) => s.monto).map((s) => s.texto)).toEqual([
      '$1.234',
      '$12345678901234.5678',
    ]);
    expect(segmentos.map((s) => s.texto).join('')).toBe(texto);
  });
});
