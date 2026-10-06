import { describe, expect, it } from 'vitest';
import {
  ETIQUETAS_ACCION_BITACORA,
  ETIQUETAS_ORIGEN_CONCILIACION,
} from './etiquetas';
import {
  ACCION_CONFIRMAR,
  ACCION_CREAR,
  ACCION_RECHAZAR,
  ACCIONES_RESOLUCION,
} from './acciones';
import { MOTIVO_MAXIMO } from './resolucion';
import { ACCIONES_BITACORA, ORIGENES_CONCILIACION } from './tipos';

describe('MOTIVO_MAXIMO', () => {
  it('espeja el límite del motivo de rechazo del backend', () => {
    expect(MOTIVO_MAXIMO).toBe(500);
  });
});

describe('ETIQUETAS_ACCION_BITACORA', () => {
  it('etiqueta cada acción del espejo y nada más', () => {
    expect(Object.keys(ETIQUETAS_ACCION_BITACORA).sort()).toEqual(
      [...ACCIONES_BITACORA].sort(),
    );
    for (const accion of ACCIONES_BITACORA) {
      expect(ETIQUETAS_ACCION_BITACORA[accion]).not.toBe('');
    }
  });
});

describe('ETIQUETAS_ACCION_BITACORA (textos del historial de la maqueta)', () => {
  it('usa los textos aprobados para los eventos de una conciliación', () => {
    expect(ETIQUETAS_ACCION_BITACORA.crear).toBe('El motor propuso el CFDI');
    expect(ETIQUETAS_ACCION_BITACORA.confirmar).toBe('Confirmada');
    expect(ETIQUETAS_ACCION_BITACORA.rechazar).toBe('Rechazada');
  });
});

describe('ETIQUETAS_ORIGEN_CONCILIACION', () => {
  it('etiqueta cada origen del espejo y nada más', () => {
    expect(Object.keys(ETIQUETAS_ORIGEN_CONCILIACION).sort()).toEqual(
      [...ORIGENES_CONCILIACION].sort(),
    );
  });

  it('usa los textos del mockup aprobado', () => {
    expect(ETIQUETAS_ORIGEN_CONCILIACION).toEqual({
      regla: 'origen: regla',
      llm: 'origen: IA',
      manual: 'origen: manual',
    });
  });
});

describe('acciones de la resolución', () => {
  it('son acciones del espejo de la bitácora', () => {
    for (const accion of [ACCION_CREAR, ...ACCIONES_RESOLUCION]) {
      expect(ACCIONES_BITACORA).toContain(accion);
    }
  });

  it('la resolución solo confirma o rechaza, en ese orden', () => {
    expect(ACCIONES_RESOLUCION).toEqual([ACCION_CONFIRMAR, ACCION_RECHAZAR]);
    expect([ACCION_CONFIRMAR, ACCION_RECHAZAR, ACCION_CREAR]).toEqual([
      'confirmar',
      'rechazar',
      'crear',
    ]);
  });
});
