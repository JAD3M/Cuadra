import { describe, expect, it } from 'vitest';
import { paginaMaxima, ventanaDePaginas } from './paginas';

const E = null;

describe('ventanaDePaginas', () => {
  it('una sola página: solo la 1', () => {
    expect(ventanaDePaginas(1, 1)).toEqual([1]);
  });

  it('cinco páginas caben completas', () => {
    expect(ventanaDePaginas(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('siete páginas todavía caben completas', () => {
    expect(ventanaDePaginas(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('12 páginas al inicio: elipsis antes de la última', () => {
    expect(ventanaDePaginas(1, 12)).toEqual([1, 2, 3, 4, 5, E, 12]);
    expect(ventanaDePaginas(4, 12)).toEqual([1, 2, 3, 4, 5, E, 12]);
  });

  it('12 páginas en medio: elipsis a ambos lados', () => {
    expect(ventanaDePaginas(6, 12)).toEqual([1, E, 5, 6, 7, E, 12]);
  });

  it('12 páginas al final: elipsis después de la primera', () => {
    expect(ventanaDePaginas(12, 12)).toEqual([1, E, 8, 9, 10, 11, 12]);
    expect(ventanaDePaginas(9, 12)).toEqual([1, E, 8, 9, 10, 11, 12]);
  });

  it('nunca repite una página y siempre incluye la actual, la 1 y la última', () => {
    for (const total of [1, 2, 6, 7, 8, 9, 12, 100]) {
      for (let actual = 1; actual <= total; actual++) {
        const numeros = ventanaDePaginas(actual, total).filter(
          (p): p is number => p !== null,
        );
        expect(new Set(numeros).size).toBe(numeros.length);
        expect(numeros).toContain(actual);
        expect(numeros[0]).toBe(1);
        expect(numeros.at(-1)).toBe(total);
        expect([...numeros].sort((a, b) => a - b)).toEqual(numeros);
      }
    }
  });

  it('acota los controles: 100 páginas en la página 50 son siete', () => {
    expect(ventanaDePaginas(50, 100)).toEqual([1, E, 49, 50, 51, E, 100]);
    for (let actual = 1; actual <= 100; actual++) {
      expect(ventanaDePaginas(actual, 100)).toHaveLength(7);
    }
  });
});

describe('paginaMaxima', () => {
  it.each([
    [0, 20, 1],
    [1, 20, 1],
    [20, 20, 1],
    [21, 20, 2],
    [39, 20, 2],
    [40, 20, 2],
    [41, 20, 3],
    [999999, 20, 50000],
  ])('total %i con límite %i da %i', (total, limite, esperada) => {
    expect(paginaMaxima(total, limite)).toBe(esperada);
  });
});
