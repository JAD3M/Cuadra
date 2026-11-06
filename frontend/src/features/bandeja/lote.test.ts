import { describe, expect, it } from 'vitest';
import {
  estaBloqueada,
  marcables,
  marcadasIniciales,
  propuestaDeLote,
  type FilaParaLote,
} from './lote';

const fila = (id: string, extra: Partial<FilaParaLote> = {}): FilaParaLote => ({
  estado: 'sugerencia',
  requiereRevision: false,
  regla: 'referencia_monto_exacto',
  motivoBloqueo: null,
  mejorPropuesta: { conciliacionId: id },
  ...extra,
});

describe('propuestaDeLote', () => {
  it('una sugerencia con propuesta aporta su id', () => {
    expect(propuestaDeLote(fila('a'))).toBe('a');
  });

  it('sin match, conciliado, con revisión o sin propuesta no entran', () => {
    expect(propuestaDeLote(fila('a', { estado: 'sin_match' }))).toBeNull();
    expect(propuestaDeLote(fila('a', { estado: 'conciliado' }))).toBeNull();
    expect(propuestaDeLote(fila('a', { requiereRevision: true }))).toBeNull();
    expect(propuestaDeLote(fila('a', { mejorPropuesta: null }))).toBeNull();
    expect(propuestaDeLote(fila('a', { mejorPropuesta: {} }))).toBeNull();
  });
});

describe('marcadasIniciales (FR-18: solo la regla 1)', () => {
  it('marca la regla 1 y deja desmarcadas las reglas 2 y 3, el grupo y la IA', () => {
    const filas = [
      fila('r1'),
      fila('r2', { regla: 'referencia_monto_diferente' }),
      fila('r3', { regla: 'monto_unico' }),
      fila('grupo', { regla: 'suma_grupo' }),
      fila('ia', { regla: 'llm_sugerencia' }),
      fila('otra', { regla: null }),
    ];
    expect([...marcadasIniciales(filas)]).toEqual(['r1']);
  });

  it('una bloqueada por separación de funciones nunca viene marcada', () => {
    const filas = [
      fila('libre'),
      fila('bloqueada', { motivoBloqueo: 'separacion_de_funciones' }),
    ];
    expect([...marcadasIniciales(filas)]).toEqual(['libre']);
  });

  it('lo que no entra al lote no se marca aunque tenga la regla 1', () => {
    const filas = [
      fila('x', { estado: 'conciliado' }),
      fila('y', { requiereRevision: true }),
    ];
    expect(marcadasIniciales(filas).size).toBe(0);
  });

  it('una lista vacía no marca nada', () => {
    expect(marcadasIniciales([]).size).toBe(0);
  });
});

describe('marcables y estaBloqueada', () => {
  it('marcables incluye todas las reglas pero no las bloqueadas', () => {
    const filas = [
      fila('r1'),
      fila('r2', { regla: 'referencia_monto_diferente' }),
      fila('bloq', { motivoBloqueo: 'separacion_de_funciones' }),
      fila('sm', { estado: 'sin_match' }),
    ];
    expect(marcables(filas)).toEqual(['r1', 'r2']);
  });

  it('estaBloqueada solo con un motivo', () => {
    expect(estaBloqueada(fila('a'))).toBe(false);
    expect(
      estaBloqueada(fila('a', { motivoBloqueo: 'separacion_de_funciones' })),
    ).toBe(true);
  });
});
