import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  EstadoDeCuentaRechazado,
  leerFilas,
  leerMovimiento,
  MENSAJE_MONEDA_NO_MXN,
  type MovimientoLeido,
  posicionMoneda,
  validarEstadoDeCuenta,
} from './lector-estado-cuenta';
import { cargarPerfiles, esquemaPerfil, type PerfilBancario } from './perfil';
import { DIRECTORIO_PERFILES } from './perfiles-bancarios';

/** CU-09 y CU-10: el lector por perfil, sin base ni HTTP. */

const PERFILES = new Map(
  cargarPerfiles(DIRECTORIO_PERFILES).map((p) => [p.id, p]),
);

function perfil(id: string): PerfilBancario {
  const encontrado = PERFILES.get(id);
  if (!encontrado) throw new Error(`Falta el perfil ${id}`);
  return encontrado;
}

const CUADRA = perfil('cuadra');
const NORTE = perfil('banco-norte');
const SUR = perfil('banco-sur');

const H = 'fecha,descripcion,referencia,monto';
const HM = `${H},moneda`;

function motivo(campos: string[], p = CUADRA): string {
  const leido = leerMovimiento(campos, p);
  if (!('motivo' in leido)) throw new Error('Se esperaba un motivo');
  return leido.motivo;
}

function movimiento(campos: string[], p: PerfilBancario): MovimientoLeido {
  const leido = leerMovimiento(campos, p);
  if ('motivo' in leido) throw new Error(`Motivo inesperado: ${leido.motivo}`);
  return leido;
}

function codigoDe(accion: () => unknown): string | undefined {
  try {
    accion();
  } catch (error) {
    if (error instanceof EstadoDeCuentaRechazado) return error.codigo;
    throw error;
  }
  throw new Error('Se esperaba un rechazo');
}

function rechazo(texto: string | Buffer, p = CUADRA): string {
  try {
    validarEstadoDeCuenta(
      Buffer.isBuffer(texto) ? texto : Buffer.from(texto),
      p,
    );
  } catch (error) {
    if (error instanceof EstadoDeCuentaRechazado) return error.message;
    throw error;
  }
  throw new Error('Se esperaba un rechazo');
}

describe('perfil cuadra: el formato canónico de CU-09', () => {
  describe('archivo completo', () => {
    it('cuenta las filas de datos, sin el encabezado ni líneas vacías', () => {
      expect(
        validarEstadoDeCuenta(
          Buffer.from(`${HM}\n2026-09-01,A,,1,MXN\n\n2026-09-02,B,,2,MXN\n`),
          CUADRA,
        ).filas,
      ).toBe(2);
    });

    it('tolera el BOM de UTF-8', () => {
      const conBom = Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(`${HM}\n2026-09-01,A,,1,MXN\n`),
      ]);
      expect(validarEstadoDeCuenta(conBom, CUADRA).filas).toBe(1);
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

    it('rechaza el archivo con bytes nulos y dice la primera línea que los trae', () => {
      expect(rechazo(`${H}\n2026-09-01,A,,1\n2026-09-02,B\0,,2\n`)).toMatch(
        /^Línea 3: el archivo trae bytes nulos/,
      );
    });

    it('la línea del byte nulo cuenta CRLF como un salto', () => {
      expect(
        rechazo(`${H}\r\n2026-09-01,A,,1\r\n2026-09-02,B,\0,2\r\n`),
      ).toMatch(/^Línea 3:/);
    });
  });

  describe('moneda obligatoria (historia 3.1)', () => {
    const codigo = (texto: string) =>
      codigoDe(() => validarEstadoDeCuenta(Buffer.from(texto), CUADRA));

    it('con la columna y todo MXN (sin importar mayúsculas ni espacios): entra', () => {
      const texto = `${HM}\n2026-09-01,A,,1,MXN\n2026-09-02,B,,2, mxn \n`;

      expect(validarEstadoDeCuenta(Buffer.from(texto), CUADRA).filas).toBe(2);
    });

    it('la columna puede ir en cualquier lugar del encabezado', () => {
      const texto =
        'fecha,moneda,descripcion,referencia,monto\n2026-09-01,MXN,A,,1\n';

      expect(validarEstadoDeCuenta(Buffer.from(texto), CUADRA).filas).toBe(1);
    });

    it('sin la columna en el encabezado: rechaza el archivo con moneda_faltante', () => {
      const texto = `${H}\n2026-09-01,A,,1\n`;

      expect(codigo(texto)).toBe('moneda_faltante');
      expect(rechazo(texto)).toMatch(/moneda/);
    });

    it('una celda vacía ya no cuenta como MXN: rechaza con moneda_faltante', () => {
      const texto = `${HM}\n2026-09-01,A,,1,MXN\n2026-09-03,C,,3,\n`;

      expect(codigo(texto)).toBe('moneda_faltante');
    });

    it('una fila con la columna ausente (corta) también se rechaza', () => {
      expect(codigo(`${HM}\n2026-09-01,A,,1\n`)).toBe('moneda_faltante');
    });

    it.each(['USD', 'usd', 'EUR', 'MXP'])(
      'una fila en %s rechaza el archivo completo con moneda_no_mxn',
      (moneda) => {
        const texto = `${HM}\n2026-09-01,A,,1,MXN\n2026-09-02,B,,2,${moneda}\n`;

        expect(rechazo(texto)).toBe(MENSAJE_MONEDA_NO_MXN);
        expect(codigo(texto)).toBe('moneda_no_mxn');
      },
    );

    it('el motivo es el texto acordado', () => {
      expect(MENSAJE_MONEDA_NO_MXN).toBe(
        'El estado de cuenta no está en MXN. Cuadra solo procesa estados de cuenta en pesos mexicanos.',
      );
    });

    it('un archivo de banco con perfil moneda MXN se lee como siempre', () => {
      expect(NORTE.moneda).toBe('MXN');
      expect(SUR.moneda).toBe('MXN');
      const norte = readFileSync(
        join(__dirname, 'fixtures', 'norte-valido.csv'),
      );

      expect(validarEstadoDeCuenta(norte, NORTE).filas).toBeGreaterThan(0);
    });

    it('un perfil con moneda distinta de MXN rechaza todo archivo con moneda_no_mxn', () => {
      const usd: PerfilBancario = { ...NORTE, moneda: 'USD' };
      const norte = readFileSync(
        join(__dirname, 'fixtures', 'norte-valido.csv'),
      );

      expect(() => validarEstadoDeCuenta(norte, usd)).toThrow(
        MENSAJE_MONEDA_NO_MXN,
      );
      expect(codigoDe(() => validarEstadoDeCuenta(norte, usd))).toBe(
        'moneda_no_mxn',
      );
    });

    it('posicionMoneda: el índice de la columna, o -1 si no viene', () => {
      expect(posicionMoneda(HM.split(','), CUADRA)).toBe(4);
      // Sin la columna en el archivo (ya rechazado en el POST), no hay índice.
      expect(posicionMoneda(H.split(','), CUADRA)).toBe(-1);
      // Un perfil sin la columna declarada no la reconoce.
      expect(posicionMoneda(HM.split(','), NORTE)).toBe(-1);
    });

    it('la fila se lee sin la columna moneda', () => {
      const leido = leerMovimiento(
        ['2026-09-01', 'A', '', '1', 'MXN'],
        CUADRA,
        4,
      );

      expect(leido).toMatchObject({ fecha: '2026-09-01', monto: '1' });
    });

    it('una fila con columnas de más con moneda cuenta las esperadas con ella', () => {
      expect(leerMovimiento(['2026-09-01', 'A', '', '1'], CUADRA, 4)).toEqual({
        motivo: 'La fila tiene 4 columnas; se esperan 5',
      });
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
      expect(leerFilas(texto, CUADRA).map((f) => f.linea)).toEqual([
        1, 2, 4, 6,
      ]);
    });

    it('igual con fin de línea CRLF', () => {
      const texto = `${H}\r\n2026-09-01,"a\r\nb",,1\r\n2026-09-02,c,,2\r\n`;
      expect(leerFilas(texto, CUADRA).map((f) => f.linea)).toEqual([1, 2, 4]);
    });
  });

  describe('fila', () => {
    it('acepta y conserva el monto como texto', () => {
      expect(
        movimiento(['2026-09-01', 'PAGO, CON COMA', '', '-1234.5678'], CUADRA),
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
      [['01/09/2026', 'A', '', '1'], /Fecha inválida.*se espera AAAA-MM-DD/],
      [['2026-02-29', 'A', '', '1'], /Fecha inválida/], // 2026 no es bisiesto
      [['2026-13-01', 'A', '', '1'], /Fecha inválida/],
      [['0000-01-01', 'A', '', '1'], /Fecha inválida/],
      [['2026-09-01', '   ', '', '1'], /descripcion está vacío/],
      [
        ['2026-09-01', 'A', 'R'.repeat(129), '1'],
        /129 caracteres; el máximo es 128/,
      ],
      [['2026-09-01', 'A', '', 'abc'], /monto no numérico/],
      [['2026-09-01', 'A', '', '1,234.00'], /monto no numérico/],
      [['2026-09-01', 'A', '', '1e3'], /monto no numérico/],
      [['2026-09-01', 'A', '', ''], /monto no numérico/],
      [['2026-09-01', 'A', '', '0.00'], /El monto es 0/],
      [['2026-09-01', 'A', '', '-0'], /El monto es 0/],
      [['2026-09-01', 'A', '', '1.23456'], /más de 4 decimales/],
      [['2026-09-01', 'A', '', '123456789012345'], /14 dígitos enteros/],
    ])('%j → %s', (campos, esperado) => {
      expect(motivo(campos)).toMatch(esperado);
    });

    it('2028-02-29 sí existe', () => {
      expect(movimiento(['2028-02-29', 'A', '', '1'], CUADRA).fecha).toBe(
        '2028-02-29',
      );
    });

    it('referencia de 128 caracteres, con acentos, entra', () => {
      expect(
        movimiento(['2026-09-01', 'A', 'é'.repeat(128), '1'], CUADRA)
          .referencia,
      ).toHaveLength(128);
    });
  });
});

describe('perfiles de banco (CU-10)', () => {
  describe('banco-norte: cargo y abono, DD/MM/AAAA, miles con coma', () => {
    // Fecha, Concepto, Referencia, Cargo, Abono, Saldo (ignorado)
    const fila = (cargo: string, abono: string, fecha = '15/09/2026') => [
      fecha,
      'CONCEPTO',
      'R1',
      cargo,
      abono,
      '99,999.99',
    ];

    it('abono es positivo y cargo negativo, con los miles quitados', () => {
      expect(movimiento(fila('', '1,234.56'), NORTE)).toEqual({
        fecha: '2026-09-15',
        descripcion: 'CONCEPTO',
        referencia: 'R1',
        monto: '1234.56',
      });
      expect(movimiento(fila('1,234.56', ''), NORTE).monto).toBe('-1234.56');
      expect(movimiento(fila('12', ''), NORTE).monto).toBe('-12');
    });

    it.each([
      [fila('10.00', '20.00'), /trae Cargo y Abono; debe traer solo uno/],
      [fila('', ''), /no trae Cargo ni Abono/],
      [fila('  ', ' '), /no trae Cargo ni Abono/],
      [fila('-10.00', ''), /Cargo no numérico.*1,234\.50/], // sin signo
      [fila('', '1,23.45'), /Abono no numérico/], // miles mal agrupados
      [fila('', '1.234,56'), /Abono no numérico/], // separadores del otro perfil
      [fila('', '0.00'), /El monto es 0/],
      [fila('', '1', '31/09/2026'), /Fecha inválida.*DD\/MM\/AAAA/],
      [fila('', '1', '2026-09-15'), /Fecha inválida/],
    ])('%j → %s', (campos, esperado) => {
      expect(motivo(campos, NORTE)).toMatch(esperado);
    });
  });

  describe('banco-sur: windows-1252, punto y coma, preámbulo, 1.234,56', () => {
    it('importe con signo, miles con punto y decimal con coma', () => {
      expect(movimiento(['05-09-2026', 'Depósito', '1.234,56'], SUR)).toEqual({
        fecha: '2026-09-05',
        descripcion: 'Depósito',
        referencia: null,
        monto: '1234.56',
      });
      expect(movimiento(['05-09-2026', 'Comisión', '-12,5'], SUR).monto).toBe(
        '-12.5',
      );
    });

    it('las líneas cuentan el preámbulo: el encabezado es la línea 4', () => {
      const texto = [
        'BANCO DEL SUR', // 1
        'Cuenta: ****9876; "sin cerrar', // 2: el preámbulo no se parsea
        '', // 3
        'Fecha operación;Descripción;Importe', // 4
        '05-09-2026;Depósito;1.234,56', // 5
        '06-09-2026;Retiro;-100,00', // 6
      ].join('\r\n');
      expect(leerFilas(texto, SUR).map((f) => f.linea)).toEqual([4, 5, 6]);
    });

    it('decodifica windows-1252: los acentos llegan bien', () => {
      const archivo = Buffer.from(
        'BANCO\r\nCUENTA\r\n\r\nFecha operación;Descripción;Importe\r\n05-09-2026;Depósito en efectivo;1,00\r\n',
        'latin1',
      );
      const { texto } = validarEstadoDeCuenta(archivo, SUR);
      const [, fila] = leerFilas(texto, SUR);
      expect(movimiento(fila.campos, SUR).descripcion).toBe(
        'Depósito en efectivo',
      );
    });

    describe('un UTF-8 subido como windows-1252', () => {
      const sur = readFileSync(
        join(__dirname, 'fixtures', 'sur-valido.csv'),
      ).toString('latin1');

      it('se rechaza en vez de leerse con acentos rotos', () => {
        expect(rechazo(Buffer.from(sur, 'utf8'), SUR)).toBe(
          'El archivo parece estar en UTF-8; el perfil banco-sur espera windows-1252',
        );
      });

      it('el windows-1252 real, con acentos, sigue entrando', () => {
        expect(
          validarEstadoDeCuenta(Buffer.from(sur, 'latin1'), SUR).filas,
        ).toBe(3);
      });

      /**
       * banco-sur con encabezados ASCII. Con los de banco-sur, un UTF-8 ya
       * falla en el encabezado ("operaciÃ³n" ≠ "operación"), aunque con un
       * motivo confuso. Con encabezados ASCII nada lo frenaba y los acentos
       * del cuerpo entraban rotos: ese es el riesgo real.
       */
      const ascii: PerfilBancario = {
        ...SUR,
        encabezados: ['Fecha', 'Descripcion', 'Importe'],
        columnas: {
          fecha: 'Fecha',
          concepto: 'Descripcion',
          monto: 'Importe',
        },
      };

      it('con encabezados ASCII, el UTF-8 también se rechaza en vez de entrar como "DepÃ³sito"', () => {
        const archivo = Buffer.from(
          'BANCO\r\nCUENTA\r\n\r\nFecha;Descripcion;Importe\r\n05-09-2026;Depósito;1,00\r\n',
          'utf8',
        );
        expect(rechazo(archivo, ascii)).toMatch(/parece estar en UTF-8/);
      });

      it('un windows-1252 solo ASCII sigue entrando: ahí las dos codificaciones leen igual', () => {
        const archivo = Buffer.from(
          'BANCO\r\nCUENTA\r\n\r\nFecha;Descripcion;Importe\r\n05-09-2026;Deposito;1,00\r\n',
          'latin1',
        );
        expect(archivo.every((byte) => byte < 0x80)).toBe(true);
        expect(validarEstadoDeCuenta(archivo, ascii).filas).toBe(1);
      });
    });

    it('si el archivo termina antes del encabezado, lo dice', () => {
      expect(rechazo('BANCO\nCUENTA\n', SUR)).toMatch(
        /Encabezados inválidos para el perfil "banco-sur".*línea 4/,
      );
    });
  });

  describe('esquema del perfil: solo datos válidos', () => {
    const base = (): Record<string, unknown> =>
      JSON.parse(
        readFileSync(join(DIRECTORIO_PERFILES, 'banco-norte.json'), 'utf8'),
      ) as Record<string, unknown>;

    it('solo columnaMoneda (sin moneda) es válido', () => {
      const perfilConColumna = base();
      delete perfilConColumna.moneda;
      perfilConColumna.columnaMoneda = 'moneda';

      expect(esquemaPerfil.safeParse(perfilConColumna).success).toBe(true);
    });

    it('los perfiles del repo son válidos', () => {
      expect([...PERFILES.keys()]).toEqual([
        'banco-norte',
        'banco-sur',
        'cuadra',
      ]);
    });

    it.each<[string, (p: Record<string, unknown>) => void, RegExp]>([
      [
        'sin columnaMoneda ni moneda',
        (p) => delete p.moneda,
        /exactamente una de "columnaMoneda"/,
      ],
      [
        'columnaMoneda y moneda a la vez',
        (p) => (p.columnaMoneda = 'moneda'),
        /exactamente una de "columnaMoneda"/,
      ],
      ['moneda en minúsculas', (p) => (p.moneda = 'mxn'), /moneda/],
      ['moneda de cuatro letras', (p) => (p.moneda = 'MXNN'), /moneda/],
      [
        'columnaMoneda también en encabezados',
        (p) => {
          delete p.moneda;
          p.columnaMoneda = 'Saldo';
        },
        /no puede estar también en "encabezados"/,
      ],
      [
        'monto y cargo/abono a la vez',
        (p) => ((p.columnas as Record<string, string>).monto = 'Cargo'),
        /no ambos/,
      ],
      [
        'cargo sin abono',
        (p) => delete (p.columnas as Record<string, string>).abono,
        /no ambos/,
      ],
      [
        'separadores de miles y decimal iguales',
        (p) => (p.separadorDecimal = ','),
        /igual al decimal/,
      ],
      [
        'columna que no está en encabezados',
        (p) => ((p.columnas as Record<string, string>).fecha = 'Fecha valor'),
        /"Fecha valor" no está en "encabezados"/,
      ],
      ['llave desconocida', (p) => (p.separadorMil = ','), /separadorMil/],
      [
        'codificación no soportada',
        (p) => (p.codificacion = 'utf-16'),
        /codificacion/,
      ],
      ['separador fuera del enum', (p) => (p.separador = '|'), /separador/],
      [
        'preámbulo negativo',
        (p) => (p.lineasPreambulo = -1),
        /lineasPreambulo/,
      ],
      [
        'encabezados repetidos',
        (p) => (p.encabezados = ['Fecha', 'Fecha']),
        /repetidos/,
      ],
      [
        'una "función" en vez de dato',
        (p) => (p.formatoFecha = '(s) => s.split("/")'),
        /formatoFecha/,
      ],
    ])('%s', (_caso, romper, esperado) => {
      const perfilRoto = base();
      romper(perfilRoto);
      const resultado = esquemaPerfil.safeParse(perfilRoto);
      expect(resultado.success).toBe(false);
      const texto = (resultado.error?.issues ?? [])
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('\n');
      expect(texto).toMatch(esperado);
    });
  });

  describe('cargar perfiles de un directorio', () => {
    let directorio: string;

    beforeEach(() => {
      directorio = mkdtempSync(join(tmpdir(), 'cuadra-perfiles-'));
    });

    afterEach(() => {
      rmSync(directorio, { recursive: true, force: true });
    });

    it('un JSON inválido impide arrancar, con el archivo y el campo', () => {
      writeFileSync(
        join(directorio, 'roto.json'),
        JSON.stringify({ id: 'roto', nombre: 'Roto' }),
      );
      expect(() => cargarPerfiles(directorio)).toThrow(
        /Perfil de banco roto\.json inválido:[\s\S]*codificacion/,
      );
    });

    it('un archivo que no es JSON impide arrancar', () => {
      writeFileSync(join(directorio, 'mal.json'), '{ id: sin comillas }');
      expect(() => cargarPerfiles(directorio)).toThrow(
        /mal\.json: JSON inválido/,
      );
    });

    it('el id tiene que ser el nombre del archivo', () => {
      const norte = readFileSync(
        join(DIRECTORIO_PERFILES, 'banco-norte.json'),
        'utf8',
      );
      writeFileSync(join(directorio, 'otro-nombre.json'), norte);
      expect(() => cargarPerfiles(directorio)).toThrow(
        /id "banco-norte" debe ser igual al nombre del archivo/,
      );
    });

    // El criterio de CU-10: agregar un banco es configuración, no código.
    it('un tercer banco, solo con un JSON nuevo, se lee sin tocar código', () => {
      const tercero = {
        id: 'banco-tercero',
        nombre: 'Banco Tercero (sintético)',
        codificacion: 'utf-8',
        separador: '\t',
        lineasPreambulo: 1,
        encabezados: ['Día', 'Detalle', 'Folio', 'Retiro', 'Depósito'],
        columnas: {
          fecha: 'Día',
          concepto: 'Detalle',
          referencia: 'Folio',
          cargo: 'Retiro',
          abono: 'Depósito',
        },
        moneda: 'MXN',
        formatoFecha: 'DD-MM-AAAA',
        separadorMiles: null,
        separadorDecimal: ',',
      };
      writeFileSync(
        join(directorio, 'banco-tercero.json'),
        JSON.stringify(tercero),
      );

      const [perfilNuevo] = cargarPerfiles(directorio);
      const archivo = Buffer.from(
        'Estado de cuenta\nDía\tDetalle\tFolio\tRetiro\tDepósito\n07-09-2026\tPago de nómina\tN-1\t25000,50\t\n',
      );
      const { texto, filas } = validarEstadoDeCuenta(archivo, perfilNuevo);
      const [, fila] = leerFilas(texto, perfilNuevo);

      expect(filas).toBe(1);
      expect(fila.linea).toBe(3);
      expect(movimiento(fila.campos, perfilNuevo)).toEqual({
        fecha: '2026-09-07',
        descripcion: 'Pago de nómina',
        referencia: 'N-1',
        monto: '-25000.50',
      });
    });
  });
});
