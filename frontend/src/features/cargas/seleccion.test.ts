import { describe, expect, it } from 'vitest';
import {
  REGLAS_CFDI,
  REGLAS_ESTADO_CUENTA,
  evaluarSeleccion,
  type ArchivoEvaluado,
} from './seleccion';

const MB = 1024 * 1024;

/** Un archivo de mentira: la validación solo mira `name` y `size`. */
const archivo = (name: string, size = 1024, type = '') => ({
  name,
  size,
  type,
});

const motivos = (r: readonly ArchivoEvaluado<{ name: string }>[]) =>
  r.map((e) => e.motivo);

describe('evaluarSeleccion de CFDI', () => {
  it('acepta la extensión sin distinguir mayúsculas, con MIME vacío o text/plain (5.1)', () => {
    const r = evaluarSeleccion(
      [
        archivo('A.XML', 10, ''),
        archivo('b.Xml', 10, 'text/plain'),
        archivo('c.xml', 10, 'application/pdf'),
      ],
      REGLAS_CFDI,
    );
    expect(motivos(r)).toEqual([null, null, null]);
  });

  it('nunca lee el tipo MIME del archivo', () => {
    const espiado = {
      name: 'a.xml',
      size: 1,
      get type(): string {
        throw new Error('se leyó file.type');
      },
    };
    expect(() => evaluarSeleccion([espiado], REGLAS_CFDI)).not.toThrow();
  });

  it('rechaza lo que no termina en .xml (5.2)', () => {
    const r = evaluarSeleccion(
      [archivo('factura.pdf'), archivo('x.xml.txt'), archivo('carpeta', 0)],
      REGLAS_CFDI,
    );
    expect(motivos(r)).toEqual(['extension', 'extension', 'extension']);
  });

  it('2 MB exactos pasan y 2 MB más un byte no (5.3)', () => {
    const r = evaluarSeleccion(
      [archivo('a.xml', 2 * MB), archivo('b.xml', 2 * MB + 1)],
      REGLAS_CFDI,
    );
    expect(motivos(r)).toEqual([null, 'tamano']);
  });

  it('el archivo 501 sobra y los 500 primeros pasan (5.4)', () => {
    const lote = Array.from({ length: 501 }, (_, i) => archivo(`f${i}.xml`));
    const r = evaluarSeleccion(lote, REGLAS_CFDI);
    expect(r.filter((e) => e.motivo === null)).toHaveLength(500);
    expect(r[500]?.motivo).toBe('cantidad');
    expect(r[499]?.motivo).toBeNull();
  });

  it('500 archivos exactos pasan', () => {
    const lote = Array.from({ length: 500 }, (_, i) => archivo(`f${i}.xml`));
    expect(
      evaluarSeleccion(lote, REGLAS_CFDI).every((e) => e.motivo === null),
    ).toBe(true);
  });

  it('el archivo que hace pasar de 50 MB sobra, sin crear archivos reales (5.5)', () => {
    // 25 archivos de 2 MB son 50 MB exactos: el 26 los rebasa.
    const lote = Array.from({ length: 26 }, (_, i) =>
      archivo(`f${i}.xml`, 2 * MB),
    );
    const r = evaluarSeleccion(lote, REGLAS_CFDI);
    expect(r.filter((e) => e.motivo === null)).toHaveLength(25);
    expect(r[25]?.motivo).toBe('total');
  });

  it('los rechazados no consumen cantidad ni bytes', () => {
    const lote = [
      ...Array.from({ length: 30 }, (_, i) => archivo(`g${i}.pdf`, 2 * MB)),
      ...Array.from({ length: 25 }, (_, i) => archivo(`f${i}.xml`, 2 * MB)),
      archivo('grande.xml', 2 * MB + 1),
    ];
    const r = evaluarSeleccion(lote, REGLAS_CFDI);
    expect(r.filter((e) => e.motivo === null)).toHaveLength(25);
    expect(r[55]?.motivo).toBe('tamano');
    expect(r.slice(0, 30).every((e) => e.motivo === 'extension')).toBe(true);
  });

  it('conserva el orden y devuelve el mismo objeto de cada archivo', () => {
    const a = archivo('a.xml');
    const b = archivo('b.pdf');
    const r = evaluarSeleccion([a, b], REGLAS_CFDI);
    expect(r.map((e) => e.archivo)).toEqual([a, b]);
    expect(r[0]?.archivo).toBe(a);
  });

  it('una selección vacía da una lista vacía', () => {
    expect(evaluarSeleccion([], REGLAS_CFDI)).toEqual([]);
  });
});

describe('evaluarSeleccion de estado de cuenta', () => {
  it('acepta movs.CSV y rechaza movs.xlsx (5.8)', () => {
    const r = evaluarSeleccion(
      [archivo('movs.CSV'), archivo('movs.xlsx')],
      REGLAS_ESTADO_CUENTA,
    );
    expect(motivos(r)).toEqual([null, 'extension']);
  });

  it('10 MB exactos pasan y 10 MB más un byte no (M4)', () => {
    const r = evaluarSeleccion(
      [archivo('a.csv', 10 * MB), archivo('b.csv', 10 * MB + 1)],
      REGLAS_ESTADO_CUENTA,
    );
    expect(motivos(r)).toEqual([null, 'tamano']);
  });

  it('no impone tope de cantidad ni de total', () => {
    const lote = Array.from({ length: 600 }, (_, i) =>
      archivo(`m${i}.csv`, 9 * MB),
    );
    expect(
      evaluarSeleccion(lote, REGLAS_ESTADO_CUENTA).every(
        (e) => e.motivo === null,
      ),
    ).toBe(true);
  });
});

describe('reglas preestablecidas', () => {
  it('salen de los límites espejados del backend', () => {
    expect(REGLAS_CFDI).toEqual({
      extension: '.xml',
      maxArchivos: 500,
      maxBytesPorArchivo: 2 * MB,
      maxBytesTotal: 50 * MB,
    });
    expect(REGLAS_ESTADO_CUENTA).toEqual({
      extension: '.csv',
      maxBytesPorArchivo: 10 * MB,
    });
  });
});
