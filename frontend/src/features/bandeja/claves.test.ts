import { describe, expect, it } from 'vitest';
import { clavesBandeja } from './claves';

describe('claves de la bandeja', () => {
  it('son estables: los mismos argumentos dan la misma clave', () => {
    expect(clavesBandeja.lista(1, ['sugerencia'], 2, 20)).toEqual(
      clavesBandeja.lista(1, ['sugerencia'], 2, 20),
    );
    expect(clavesBandeja.resumen(3)).toEqual(clavesBandeja.resumen(3));
  });

  it('todas(e) es prefijo de la lista y del resumen de esa época', () => {
    const prefijo = clavesBandeja.todas(4);
    expect(clavesBandeja.lista(4, ['sin_match'], 1, 20).slice(0, 2)).toEqual(
      prefijo,
    );
    expect(clavesBandeja.resumen(4).slice(0, 2)).toEqual(prefijo);
  });

  it('otra época, página, límite o estado cambia la clave', () => {
    const base = clavesBandeja.lista(1, ['sugerencia'], 1, 20);
    expect(clavesBandeja.lista(2, ['sugerencia'], 1, 20)).not.toEqual(base);
    expect(clavesBandeja.lista(1, ['sugerencia'], 2, 20)).not.toEqual(base);
    expect(clavesBandeja.lista(1, ['sugerencia'], 1, 50)).not.toEqual(base);
    expect(clavesBandeja.lista(1, ['sin_match'], 1, 20)).not.toEqual(base);
    expect(clavesBandeja.resumen(2)).not.toEqual(clavesBandeja.resumen(1));
  });

  it('la lista y el resumen de una época no comparten clave', () => {
    expect(clavesBandeja.lista(1, ['sugerencia'], 1, 20)).not.toEqual(
      clavesBandeja.resumen(1),
    );
  });
});
