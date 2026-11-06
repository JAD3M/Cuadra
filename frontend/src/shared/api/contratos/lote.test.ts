import { describe, expect, it } from 'vitest';
import { RAZONES_OMISION_LOTE } from '@/shared/dominio/tipos';
import { respuestaLote } from './lote';

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const LOTE = '00000000-0000-4000-8000-0000000000aa';

describe('respuestaLote (5.3)', () => {
  it('acepta un lote con confirmadas y omitidas', () => {
    const r = respuestaLote.parse({
      loteId: LOTE,
      confirmadas: [A],
      omitidas: [{ id: B, razon: 'ya_resuelta' }],
    });
    expect(r.loteId).toBe(LOTE);
    expect(r.omitidas[0]?.razon).toBe('ya_resuelta');
  });

  it('loteId puede ser null cuando no se confirmó ninguna', () => {
    expect(
      respuestaLote.safeParse({
        loteId: null,
        confirmadas: [],
        omitidas: [{ id: A, razon: 'no_existe' }],
      }).success,
    ).toBe(true);
  });

  it.each(RAZONES_OMISION_LOTE)('acepta la razón %s', (razon) => {
    expect(
      respuestaLote.safeParse({
        loteId: null,
        confirmadas: [],
        omitidas: [{ id: A, razon }],
      }).success,
    ).toBe(true);
  });

  it('rechaza una razón desconocida, un id que no es guid y claves faltantes', () => {
    const base = { loteId: null, confirmadas: [], omitidas: [] };
    expect(
      respuestaLote.safeParse({
        ...base,
        omitidas: [{ id: A, razon: 'inventada' }],
      }).success,
    ).toBe(false);
    expect(
      respuestaLote.safeParse({ ...base, confirmadas: ['../admin'] }).success,
    ).toBe(false);
    for (const clave of ['loteId', 'confirmadas', 'omitidas']) {
      const sin: Record<string, unknown> = { ...base };
      delete sin[clave];
      expect(respuestaLote.safeParse(sin).success).toBe(false);
    }
  });
});
