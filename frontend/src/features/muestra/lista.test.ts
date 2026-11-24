import { describe, expect, it } from 'vitest';
import type { CasoMuestra } from '@/shared/api/contratos';
import { casoInicial, cumpleFiltro, numeroDe, vecino } from './lista';

function caso(id: string, extra: Partial<CasoMuestra> = {}): CasoMuestra {
  return {
    decisionId: id,
    movimientoId: `m-${id}`,
    fecha: '2026-09-12',
    descripcion: id,
    referencia: null,
    monto: '1.0000',
    moneda: 'MXN',
    banco: null,
    regla: null,
    motivo: null,
    cfdis: [],
    confirmadaPor: null,
    confirmadaPorMi: false,
    confirmadaAt: null,
    marca: 'pendiente',
    marcadaPor: null,
    marcadaAt: null,
    marcas: [],
    reabierta: false,
    puedeMarcar: true,
    ...extra,
  };
}

const CASOS = [
  caso('a', { marca: 'conforme' }),
  caso('b', { marca: 'desacuerdo' }),
  caso('c', { reabierta: true }),
  caso('d'),
  caso('e'),
];

describe('lista de la muestra', () => {
  it('«Pendientes» no incluye marcados ni reabiertos; «En desacuerdo» solo los marcados así', () => {
    expect(CASOS.filter((c) => cumpleFiltro(c, 'todos')).length).toBe(5);
    expect(
      CASOS.filter((c) => cumpleFiltro(c, 'pendientes')).map(
        (c) => c.decisionId,
      ),
    ).toEqual(['d', 'e']);
    expect(
      CASOS.filter((c) => cumpleFiltro(c, 'desacuerdo')).map(
        (c) => c.decisionId,
      ),
    ).toEqual(['b']);
  });

  it('el caso inicial es el primero pendiente; sin pendientes, el primero', () => {
    expect(casoInicial(CASOS)).toBe('d');
    expect(casoInicial([caso('x', { marca: 'conforme' })])).toBe('x');
    expect(casoInicial([])).toBeNull();
  });

  it('numeroDe es la posición 1-based en toda la muestra', () => {
    expect(numeroDe(CASOS, 'd')).toBe(4);
    expect(numeroDe(CASOS, 'zz')).toBeNull();
  });

  it('vecino salta a lo que cumple el filtro y se detiene en los extremos', () => {
    expect(vecino(CASOS, 'a', 'todos', 1)).toBe('b');
    expect(vecino(CASOS, 'a', 'pendientes', 1)).toBe('d');
    expect(vecino(CASOS, 'e', 'pendientes', 1)).toBeNull();
    expect(vecino(CASOS, 'e', 'pendientes', -1)).toBe('d');
    expect(vecino(CASOS, 'a', 'todos', -1)).toBeNull();
    expect(vecino(CASOS, 'c', 'desacuerdo', -1)).toBe('b');
    expect(vecino(CASOS, 'c', 'desacuerdo', 1)).toBeNull();
  });
});
