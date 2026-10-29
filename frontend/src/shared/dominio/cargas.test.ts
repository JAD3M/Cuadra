import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ESTADOS_CARGA,
  ETIQUETAS_ESTADO_CARGA,
  ETIQUETAS_TIPO_CARGA,
  FASE_CARGA,
  TIPOS_CARGA,
  TIPO_CFDI,
  TIPO_ESTADO_CUENTA,
  esActiva,
  esConcluida,
  type EstadoCarga,
  type TipoCarga,
} from '@/shared/dominio';

describe('FASE_CARGA, esActiva y esConcluida', () => {
  it('cubre exactamente los seis estados del backend', () => {
    expect(Object.keys(FASE_CARGA)).toEqual([...ESTADOS_CARGA]);
  });

  it('pendiente y procesando son activas; el resto, concluidas (incluida la espera de vista previa)', () => {
    expect(ESTADOS_CARGA.filter(esActiva)).toEqual(['pendiente', 'procesando']);
    expect(ESTADOS_CARGA.filter(esConcluida)).toEqual([
      'procesada',
      'con_errores',
      'fallida',
      'pendiente_vista_previa',
    ]);
  });

  it('ningún estado es a la vez activo y concluido', () => {
    for (const estado of ESTADOS_CARGA) {
      expect(esActiva(estado)).not.toBe(esConcluida(estado));
    }
  });

  it('el mapa de fases es exhaustivo en compilación', () => {
    expectTypeOf(FASE_CARGA).toEqualTypeOf<
      Readonly<Record<EstadoCarga, 'activa' | 'concluida'>>
    >();
  });
});

describe('etiquetas de carga', () => {
  it('estado: una etiqueta por estado, en el orden del backend', () => {
    expect(ESTADOS_CARGA.map((e) => ETIQUETAS_ESTADO_CARGA[e])).toEqual([
      'Pendiente',
      'Procesando',
      'Procesada',
      'Con filas rechazadas',
      'Fallida',
      'Pendiente de vista previa',
    ]);
  });

  it('tipo: una etiqueta por tipo del espejo', () => {
    expect(Object.keys(ETIQUETAS_TIPO_CARGA)).toEqual([...TIPOS_CARGA]);
    for (const tipo of TIPOS_CARGA) {
      expect(ETIQUETAS_TIPO_CARGA[tipo]).not.toBe('');
    }
  });

  it('los mapas son Record exhaustivos sobre el espejo', () => {
    expectTypeOf(ETIQUETAS_ESTADO_CARGA).toEqualTypeOf<
      Record<EstadoCarga, string>
    >();
    expectTypeOf(ETIQUETAS_TIPO_CARGA).toEqualTypeOf<
      Record<TipoCarga, string>
    >();
  });

  it('los tipos con nombre son valores del espejo', () => {
    expect(TIPOS_CARGA).toContain(TIPO_CFDI);
    expect(TIPOS_CARGA).toContain(TIPO_ESTADO_CUENTA);
  });
});
