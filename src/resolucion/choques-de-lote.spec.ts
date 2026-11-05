import { idsQueChocan } from './choques-de-lote';

const p = (id: string, movimientoId: string, ...cfdiIds: string[]) => ({
  id,
  movimientoId,
  cfdiIds,
});

describe('idsQueChocan (5.3)', () => {
  it('sin choques devuelve vacío', () => {
    expect(
      idsQueChocan([
        p('a', 'm1', 'c1'),
        p('b', 'm2', 'c2'),
        p('c', 'm3', 'c3'),
      ]),
    ).toEqual(new Set());
  });

  it('el mismo movimiento hace chocar a las dos', () => {
    expect(
      idsQueChocan([
        p('a', 'm1', 'c1'),
        p('b', 'm1', 'c2'),
        p('c', 'm3', 'c3'),
      ]),
    ).toEqual(new Set(['a', 'b']));
  });

  it('la misma factura hace chocar a las dos, también dentro de un grupo', () => {
    expect(
      idsQueChocan([
        p('a', 'm1', 'c1'),
        p('g', 'm2', 'c1', 'c9'),
        p('z', 'm3', 'c3'),
      ]),
    ).toEqual(new Set(['a', 'g']));
  });

  it('tres que se encadenan chocan las tres si comparten llaves distintas', () => {
    expect(
      idsQueChocan([
        p('a', 'm1', 'c1'),
        p('b', 'm1', 'c2'),
        p('c', 'm9', 'c2'),
      ]),
    ).toEqual(new Set(['a', 'b', 'c']));
  });

  it('una factura repetida en una misma propuesta no choca consigo misma', () => {
    expect(idsQueChocan([p('a', 'm1', 'c1', 'c1')])).toEqual(new Set());
  });

  it('una lista vacía no choca', () => {
    expect(idsQueChocan([])).toEqual(new Set());
  });
});
