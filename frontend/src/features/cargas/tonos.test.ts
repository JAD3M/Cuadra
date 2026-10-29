import { describe, expect, it } from 'vitest';
import { ESTADOS_CARGA, type EstadoCarga } from '@/shared/dominio';
import { AVANCE_ESTADO_CARGA, TONO_ESTADO_CARGA } from './tonos';

describe('tonos de las cargas', () => {
  it('hay un tono de chip por cada estado, y solo uno', () => {
    expect(Object.keys(TONO_ESTADO_CARGA).sort()).toEqual(
      [...ESTADOS_CARGA].sort(),
    );
  });

  it('hay un avance por cada estado, y solo uno', () => {
    expect(Object.keys(AVANCE_ESTADO_CARGA).sort()).toEqual(
      [...ESTADOS_CARGA].sort(),
    );
  });

  it.each<[EstadoCarga, string]>([
    ['pendiente', 'neutral'],
    ['procesando', 'sugerencia'],
    ['procesada', 'conciliado'],
    ['con_errores', 'sin_match'],
    ['fallida', 'peligro'],
    ['pendiente_vista_previa', 'neutral'],
    ['rechazada', 'neutral'],
  ])('el chip de %s usa el tono %s', (estado, tono) => {
    expect(TONO_ESTADO_CARGA[estado]).toBe(tono);
  });

  it.each<[EstadoCarga, string]>([
    ['pendiente', 'vacia'],
    ['procesando', 'indeterminada'],
    ['procesada', 'verde'],
    ['con_errores', 'naranja'],
    ['fallida', 'roja'],
    ['pendiente_vista_previa', 'vacia'],
    ['rechazada', 'vacia'],
  ])('el avance de %s es %s', (estado, avance) => {
    expect(AVANCE_ESTADO_CARGA[estado]).toBe(avance);
  });
});
