import { describe, expect, it } from 'vitest';
import type { EstadoCarga } from '@/shared/dominio';
import { calcularIntervalo, hayActivas, terminoAlgunaCarga } from './polling';

const fila = (id: string, estado: EstadoCarga) => ({ id, estado });

describe('hayActivas', () => {
  it('es verdadero con una fila pendiente o procesando', () => {
    expect(hayActivas([fila('a', 'procesada'), fila('b', 'pendiente')])).toBe(
      true,
    );
    expect(hayActivas([fila('a', 'procesando')])).toBe(true);
  });

  it('es falso con todas terminadas, con la lista vacía y sin datos', () => {
    expect(
      hayActivas([
        fila('a', 'procesada'),
        fila('b', 'con_errores'),
        fila('c', 'fallida'),
      ]),
    ).toBe(false);
    expect(hayActivas([])).toBe(false);
    expect(hayActivas(undefined)).toBe(false);
  });
});

describe('calcularIntervalo', () => {
  const filas = [fila('a', 'procesando')];

  it('con filas activas devuelve el intervalo', () => {
    expect(calcularIntervalo(filas, false, 3000)).toBe(3000);
  });

  it('con todas terminadas, vacío o sin datos devuelve false', () => {
    expect(calcularIntervalo([fila('a', 'procesada')], false, 3000)).toBe(
      false,
    );
    expect(calcularIntervalo([], false, 3000)).toBe(false);
    expect(calcularIntervalo(undefined, false, 3000)).toBe(false);
  });

  it('capada devuelve false aunque haya filas activas', () => {
    expect(calcularIntervalo(filas, true, 3000)).toBe(false);
  });
});

describe('terminoAlgunaCarga', () => {
  it('detecta una carga que pasó de activa a terminada', () => {
    expect(
      terminoAlgunaCarga(
        [fila('a', 'procesando'), fila('b', 'pendiente')],
        [fila('a', 'procesada'), fila('b', 'pendiente')],
      ),
    ).toBe(true);
  });

  it('no avisa si sigue activa, si ya estaba terminada o si es nueva', () => {
    expect(
      terminoAlgunaCarga([fila('a', 'pendiente')], [fila('a', 'procesando')]),
    ).toBe(false);
    expect(
      terminoAlgunaCarga([fila('a', 'procesada')], [fila('a', 'procesada')]),
    ).toBe(false);
    expect(terminoAlgunaCarga([], [fila('a', 'procesada')])).toBe(false);
  });

  it('sin lectura previa no hay transición que detectar', () => {
    expect(terminoAlgunaCarga(undefined, [fila('a', 'procesada')])).toBe(false);
  });

  it('una carga que sale de la lista no cuenta como terminada', () => {
    expect(terminoAlgunaCarga([fila('a', 'procesando')], [])).toBe(false);
  });
});
