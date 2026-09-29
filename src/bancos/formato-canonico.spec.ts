import {
  EstadoDeCuentaRechazado,
  leerFilas,
  leerMovimiento,
  validarEstadoDeCuenta,
} from './formato-canonico';

/** CU-09: el formato canónico, sin base ni HTTP. */

const H = 'fecha,descripcion,referencia,monto';

function motivo(campos: string[]): string {
  const leido = leerMovimiento(campos);
  if (!('motivo' in leido)) throw new Error('Se esperaba un motivo');
  return leido.motivo;
}

function rechazo(texto: string | Buffer): string {
  try {
    validarEstadoDeCuenta(Buffer.isBuffer(texto) ? texto : Buffer.from(texto));
  } catch (error) {
    if (error instanceof EstadoDeCuentaRechazado) return error.message;
    throw error;
  }
  throw new Error('Se esperaba un rechazo');
}

describe('formato canónico de estado de cuenta (CU-09)', () => {
  describe('archivo completo', () => {
    it('cuenta las filas de datos, sin el encabezado ni líneas vacías', () => {
      expect(
        validarEstadoDeCuenta(
          Buffer.from(`${H}\n2026-09-01,A,,1\n\n2026-09-02,B,,2\n`),
        ).filas,
      ).toBe(2);
    });

    it('tolera el BOM de UTF-8', () => {
      const conBom = Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(`${H}\n2026-09-01,A,,1\n`),
      ]);
      expect(validarEstadoDeCuenta(conBom).filas).toBe(1);
    });

    it('rechaza lo que no es UTF-8', () => {
      expect(
        rechazo(Buffer.from(`${H}\n2026-09-01,Depósito,,1\n`, 'latin1')),
      ).toMatch(/UTF-8/);
    });

    it('rechaza encabezados que no son los exactos, aunque solo cambie el orden', () => {
      expect(
        rechazo('fecha,descripcion,monto,referencia\n2026-09-01,A,1,\n'),
      ).toMatch(/Encabezados inválidos/);
      expect(rechazo('Fecha,descripcion,referencia,monto\n')).toMatch(
        /Encabezados inválidos/,
      );
    });

    it('rechaza un CSV con comillas sin cerrar', () => {
      expect(rechazo(`${H}\n2026-09-01,"sin cerrar,,1\n`)).toMatch(
        /CSV mal formado/,
      );
    });

    it('rechaza un archivo sin movimientos', () => {
      expect(rechazo(`${H}\n`)).toMatch(/no trae movimientos/);
    });

    it('rechaza bytes nulos', () => {
      expect(rechazo(`${H}\n2026-09-01,A\0,,1\n`)).toMatch(/bytes nulos/);
    });
  });

  describe('línea física de cada fila (encabezado = 1)', () => {
    it('cuenta líneas vacías y descripciones de varias líneas', () => {
      const texto = [
        H,
        '2026-09-01,uno,,1', // 2
        '', // 3
        '2026-09-02,"dos', // 4
        'en dos líneas",,2', // 5
        '2026-09-03,tres,,3', // 6
      ].join('\n');
      expect(leerFilas(texto).map((f) => f.linea)).toEqual([1, 2, 4, 6]);
    });

    it('igual con fin de línea CRLF', () => {
      const texto = `${H}\r\n2026-09-01,"a\r\nb",,1\r\n2026-09-02,c,,2\r\n`;
      expect(leerFilas(texto).map((f) => f.linea)).toEqual([1, 2, 4]);
    });
  });

  describe('fila', () => {
    it('acepta y conserva el monto como texto', () => {
      expect(
        leerMovimiento(['2026-09-01', 'PAGO, CON COMA', '', '-1234.5678']),
      ).toEqual({
        fecha: '2026-09-01',
        descripcion: 'PAGO, CON COMA',
        referencia: null,
        monto: '-1234.5678',
      });
    });

    it.each([
      [['2026-09-01', 'A', '1'], /3 columnas; se esperan 4/],
      [['2026-09-01', 'A', '', '1', 'extra'], /5 columnas/],
      [['01/09/2026', 'A', '', '1'], /Fecha inválida/],
      [['2026-02-29', 'A', '', '1'], /Fecha inválida/], // 2026 no es bisiesto
      [['2026-13-01', 'A', '', '1'], /Fecha inválida/],
      [['0000-01-01', 'A', '', '1'], /Fecha inválida/],
      [['2026-09-01', '   ', '', '1'], /descripción está vacía/],
      [
        ['2026-09-01', 'A', 'R'.repeat(129), '1'],
        /129 caracteres; el máximo es 128/,
      ],
      [['2026-09-01', 'A', '', 'abc'], /Monto no numérico/],
      [['2026-09-01', 'A', '', '1,234.00'], /Monto no numérico/],
      [['2026-09-01', 'A', '', '1e3'], /Monto no numérico/],
      [['2026-09-01', 'A', '', ''], /Monto no numérico/],
      [['2026-09-01', 'A', '', '0.00'], /El monto es 0/],
      [['2026-09-01', 'A', '', '-0'], /El monto es 0/],
      [['2026-09-01', 'A', '', '1.23456'], /más de 4 decimales/],
      [['2026-09-01', 'A', '', '123456789012345'], /14 dígitos enteros/],
    ])('%j → %s', (campos, esperado) => {
      expect(motivo(campos)).toMatch(esperado);
    });

    it('2028-02-29 sí existe', () => {
      expect(leerMovimiento(['2028-02-29', 'A', '', '1'])).not.toHaveProperty(
        'motivo',
      );
    });

    it('referencia de 128 caracteres, con acentos, entra', () => {
      expect(
        leerMovimiento(['2026-09-01', 'A', 'é'.repeat(128), '1']),
      ).not.toHaveProperty('motivo');
    });
  });
});
