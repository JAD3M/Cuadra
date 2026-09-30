/**
 * CU-18. Generador pseudoaleatorio con semilla (mulberry32). Es la única
 * fuente de "azar" del generador de la demo: misma semilla, mismos datos, en
 * cualquier máquina y cualquier día. Nada de Date.now ni Math.random aquí.
 */
export const SEMILLA_DEMO = 20260930;

export interface Prng {
  /** Decimal en [0, 1). */
  siguiente(): number;
  /** Entero en [minimo, maximo], ambos incluidos. */
  entero(minimo: number, maximo: number): number;
}

export function crearPrng(semilla: number): Prng {
  let estado = semilla >>> 0;
  const siguiente = (): number => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    siguiente,
    entero: (minimo, maximo) =>
      minimo + Math.floor(siguiente() * (maximo - minimo + 1)),
  };
}
