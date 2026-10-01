import { describe, expect, it } from 'vitest';
import { iniciales } from './iniciales';

describe('iniciales', () => {
  it.each([
    ['Ferretería del Bajío', 'FB'],
    ['Abarrotes del Norte SA de CV', 'AN'],
    ['Casa de la Y de los Montes', 'CM'],
    ['  Luis   Reyes  ', 'LR'],
    ['Cuadra', 'C'],
    ['ferretería bajío', 'FB'],
    ['Uno Dos Tres', 'UD'],
    ['', ''],
    ['   ', ''],
    ['de la', ''],
  ])('%j -> %j', (entrada, esperado) => {
    expect(iniciales(entrada)).toBe(esperado);
  });
});
