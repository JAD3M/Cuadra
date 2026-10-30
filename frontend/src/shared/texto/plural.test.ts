import { describe, expect, it } from 'vitest';
import { plural } from './plural';

describe('plural', () => {
  it.each([
    [0, '0 dudosos'],
    [1, '1 dudoso'],
    [2, '2 dudosos'],
    [1204, '1204 dudosos'],
  ])('%i -> %s', (n, esperado) => {
    expect(plural(n, 'dudoso', 'dudosos')).toBe(esperado);
  });
});
