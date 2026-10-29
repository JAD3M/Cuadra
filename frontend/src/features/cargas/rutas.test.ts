import { describe, expect, it } from 'vitest';
import { rutaVistaPrevia } from './rutas';

describe('rutaVistaPrevia', () => {
  it('arma /cargas/:id/vista-previa', () => {
    expect(rutaVistaPrevia('abc')).toBe('/cargas/abc/vista-previa');
  });

  it('codifica el id para que no rompa la ruta', () => {
    expect(rutaVistaPrevia('a b/c')).toBe('/cargas/a%20b%2Fc/vista-previa');
  });
});
