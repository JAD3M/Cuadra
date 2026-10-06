import { describe, expect, it, vi } from 'vitest';
import { clienteDePruebas } from '@/test/montarBandeja';
import { invalidarTrasResolver } from './invalidar';

describe('invalidarTrasResolver', () => {
  it('invalida exactamente el prefijo del caso y el de la bandeja de la época', async () => {
    const cliente = clienteDePruebas();
    const espia = vi
      .spyOn(cliente, 'invalidateQueries')
      .mockResolvedValue(undefined);
    await invalidarTrasResolver(cliente, 7);
    const claves = espia.mock.calls.map(([filtro]) => filtro?.queryKey);
    expect(claves).toEqual([
      ['caso', 7],
      ['bandeja', 7],
    ]);
  });

  it('espera al caso pero no a la bandeja', async () => {
    const cliente = clienteDePruebas();
    const resueltas: string[] = [];
    vi.spyOn(cliente, 'invalidateQueries').mockImplementation(
      async (filtro) => {
        const prefijo = String(filtro?.queryKey?.[0]);
        if (prefijo === 'bandeja') {
          await new Promise(() => undefined); // nunca termina
        }
        resueltas.push(prefijo);
      },
    );
    await invalidarTrasResolver(cliente, 1);
    expect(resueltas).toEqual(['caso']);
  });

  it('no toca las consultas de otra época', async () => {
    const cliente = clienteDePruebas();
    cliente.setQueryData(['caso', 1, 'detalle', 'x'], { a: 1 });
    cliente.setQueryData(['caso', 2, 'detalle', 'x'], { a: 2 });
    cliente.setQueryData(['bandeja', 2, 'resumen'], { a: 3 });
    await invalidarTrasResolver(cliente, 1);
    expect(
      cliente.getQueryState(['caso', 1, 'detalle', 'x'])?.isInvalidated,
    ).toBe(true);
    expect(
      cliente.getQueryState(['caso', 2, 'detalle', 'x'])?.isInvalidated,
    ).toBe(false);
    expect(
      cliente.getQueryState(['bandeja', 2, 'resumen'])?.isInvalidated,
    ).toBe(false);
  });
});
