import { describe, expect, it } from 'vitest';
import {
  alternarEstado,
  leerFiltros,
  paginaMaxima,
  serializar,
  type FiltrosBandeja,
} from './filtrosUrl';

const leer = (consulta: string) => leerFiltros(new URLSearchParams(consulta));
const POR_DEFECTO: FiltrosBandeja = {
  estados: ['sugerencia', 'sin_match'],
  pagina: 1,
};

describe('leerFiltros', () => {
  it('sin parámetros da los valores por defecto', () => {
    expect(leer('')).toEqual(POR_DEFECTO);
  });

  it('ordena los estados en el orden canónico', () => {
    expect(leer('estado=sin_match&estado=sugerencia').estados).toEqual([
      'sugerencia',
      'sin_match',
    ]);
    expect(leer('estado=sin_match&estado=conciliado').estados).toEqual([
      'conciliado',
      'sin_match',
    ]);
  });

  it('quita duplicados', () => {
    expect(leer('estado=sin_match&estado=sin_match').estados).toEqual([
      'sin_match',
    ]);
  });

  it('descarta los inválidos y conserva los válidos', () => {
    expect(leer('estado=zzz&estado=conciliado&estado=').estados).toEqual([
      'conciliado',
    ]);
    expect(leer('estado=SIN_MATCH').estados).toEqual(POR_DEFECTO.estados);
  });

  it('si todos son inválidos vuelve a los de por defecto', () => {
    expect(leer('estado=zzz&estado=otro').estados).toEqual([
      'sugerencia',
      'sin_match',
    ]);
  });

  it('el arreglo devuelto es una copia: no comparte el de por defecto', () => {
    const uno = leer('');
    uno.estados.push('conciliado');
    expect(leer('').estados).toEqual(['sugerencia', 'sin_match']);
  });

  it.each([
    ['pagina=2', 2],
    ['pagina=999999', 999999],
    ['pagina=0', 1],
    ['pagina=-1', 1],
    ['pagina=1.5', 1],
    ['pagina=abc', 1],
    ['pagina=', 1],
    ['pagina=9999999', 1],
    ['pagina=01', 1],
    ['pagina=%202', 1],
    ['pagina=1e3', 1],
  ])('%s da la página %i', (consulta, esperada) => {
    expect(leer(consulta).pagina).toBe(esperada);
  });

  it('con varias páginas usa la primera', () => {
    expect(leer('pagina=3&pagina=5').pagina).toBe(3);
  });

  it('ignora las claves desconocidas, incluido limite', () => {
    expect(leer('limite=500&x=1&estado=conciliado')).toEqual({
      estados: ['conciliado'],
      pagina: 1,
    });
  });
});

describe('serializar', () => {
  it('omite los valores por defecto', () => {
    expect(serializar(POR_DEFECTO)).toBe('');
  });

  it('el conjunto por defecto en cualquier orden también es vacío', () => {
    expect(
      serializar({ estados: ['sin_match', 'sugerencia'], pagina: 1 }),
    ).toBe('');
  });

  it('escribe estados no por defecto en orden canónico', () => {
    expect(
      serializar({ estados: ['sin_match', 'conciliado'], pagina: 1 }),
    ).toBe('estado=conciliado&estado=sin_match');
    expect(
      serializar({
        estados: ['sin_match', 'sugerencia', 'conciliado'],
        pagina: 1,
      }),
    ).toBe('estado=conciliado&estado=sugerencia&estado=sin_match');
  });

  it('escribe la página solo si pasa de 1', () => {
    expect(serializar({ ...POR_DEFECTO, pagina: 2 })).toBe('pagina=2');
    expect(serializar({ estados: ['conciliado'], pagina: 3 })).toBe(
      'estado=conciliado&pagina=3',
    );
  });

  it('una página inválida en el objeto no llega a la URL', () => {
    expect(serializar({ ...POR_DEFECTO, pagina: 0 })).toBe('');
    expect(serializar({ ...POR_DEFECTO, pagina: -4 })).toBe('');
    expect(serializar({ ...POR_DEFECTO, pagina: Number.NaN })).toBe('');
  });

  it('sin estados no escribe ninguno (cae en el valor por defecto)', () => {
    expect(serializar({ estados: [], pagina: 1 })).toBe('');
  });

  it('ida y vuelta: leer(serializar(f)) devuelve f', () => {
    const casos: FiltrosBandeja[] = [
      POR_DEFECTO,
      { estados: ['conciliado'], pagina: 1 },
      { estados: ['conciliado', 'sin_match'], pagina: 7 },
      { estados: ['conciliado', 'sugerencia', 'sin_match'], pagina: 999999 },
      { estados: ['sugerencia', 'sin_match'], pagina: 2 },
    ];
    for (const f of casos) {
      expect(leer(serializar(f))).toEqual(f);
    }
  });

  it('normaliza una URL arbitraria a su forma canónica y es idempotente', () => {
    const sucia = 'x=1&estado=sin_match&estado=zzz&estado=sugerencia&pagina=01';
    const canonica = serializar(leer(sucia));
    expect(canonica).toBe('');
    expect(serializar(leer(canonica))).toBe(canonica);
    const otra = serializar(
      leer('limite=500&estado=sin_match&pagina=2&pagina=3'),
    );
    expect(otra).toBe('estado=sin_match&pagina=2');
    expect(serializar(leer(otra))).toBe(otra);
  });
});

describe('alternarEstado', () => {
  it('apaga un estado activo y vuelve a la página 1', () => {
    expect(alternarEstado({ ...POR_DEFECTO, pagina: 4 }, 'sin_match')).toEqual({
      estados: ['sugerencia'],
      pagina: 1,
    });
  });

  it('enciende un estado inactivo y lo deja en orden canónico', () => {
    expect(
      alternarEstado({ estados: ['sin_match'], pagina: 3 }, 'conciliado'),
    ).toEqual({ estados: ['conciliado', 'sin_match'], pagina: 1 });
    expect(alternarEstado(POR_DEFECTO, 'conciliado')).toEqual({
      estados: ['conciliado', 'sugerencia', 'sin_match'],
      pagina: 1,
    });
  });

  it('devuelve null para el último estado activo', () => {
    expect(
      alternarEstado({ estados: ['conciliado'], pagina: 2 }, 'conciliado'),
    ).toBeNull();
  });

  it('con el último estado activo sí deja encender otro', () => {
    expect(
      alternarEstado({ estados: ['conciliado'], pagina: 2 }, 'sin_match'),
    ).toEqual({ estados: ['conciliado', 'sin_match'], pagina: 1 });
  });

  it('no modifica el objeto recibido', () => {
    const original: FiltrosBandeja = {
      estados: ['sugerencia', 'sin_match'],
      pagina: 2,
    };
    alternarEstado(original, 'sin_match');
    expect(original).toEqual({
      estados: ['sugerencia', 'sin_match'],
      pagina: 2,
    });
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
