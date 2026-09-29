// src/bancos/formato-canonico.ts
import { CsvError, parse } from 'csv-parse/sync';
import { dinero, esDecimal } from '../common/dinero';

/**
 * CU-09: el formato canónico de estado de cuenta de Cuadra. Los formatos de
 * cada banco (CU-10) se traducirán a este. Documentado en CUADRA.md, tabla
 * `movimientos`.
 */

export const ENCABEZADOS = ['fecha', 'descripcion', 'referencia', 'monto'];

/** Dígitos que caben en `movimientos.monto`, NUMERIC(18,4). */
const MAX_ENTEROS = 14;
const MAX_DECIMALES = 4;
const MAX_REFERENCIA = 128;

/** El archivo entero no sirve: 400 en el POST, antes de guardar nada. */
export class EstadoDeCuentaRechazado extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'EstadoDeCuentaRechazado';
  }
}

export interface FilaDelArchivo {
  /** Línea física donde empieza la fila; el encabezado es la 1. */
  linea: number;
  campos: string[];
}

export interface MovimientoLeido {
  /** AAAA-MM-DD, tal cual: la columna es `date`, sin hora ni zona. */
  fecha: string;
  descripcion: string;
  referencia: string | null;
  /** Texto decimal con signo: positivo es abono, negativo es cargo. */
  monto: string;
}

/**
 * Validación del archivo completo, en la petición: UTF-8 válido, sin bytes
 * nulos, CSV bien formado (comillas cerradas), encabezados exactos y al menos
 * una fila. Las filas se validan una por una en el worker; aquí solo se
 * cuentan.
 */
export function validarEstadoDeCuenta(buffer: Buffer): {
  texto: string;
  filas: number;
} {
  let texto: string;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new EstadoDeCuentaRechazado(
      'El archivo no está en UTF-8. Guárdalo como "CSV UTF-8" y vuelve a subirlo.',
    );
  }
  // `text` de Postgres no admite el byte 0, y un CSV con NUL es binario.
  if (texto.includes('\0')) {
    throw new EstadoDeCuentaRechazado(
      'El archivo trae bytes nulos: no es un CSV de texto',
    );
  }

  const filas = leerFilas(texto);
  const [encabezado, ...datos] = filas;
  if (
    !encabezado ||
    encabezado.campos.length !== ENCABEZADOS.length ||
    encabezado.campos.some((campo, i) => campo !== ENCABEZADOS[i])
  ) {
    throw new EstadoDeCuentaRechazado(
      `Encabezados inválidos: se esperan exactamente "${ENCABEZADOS.join(',')}"` +
        (encabezado ? `, llegó "${encabezado.campos.join(',')}"` : ''),
    );
  }
  if (datos.length === 0) {
    throw new EstadoDeCuentaRechazado('El archivo no trae movimientos');
  }
  return { texto, filas: datos.length };
}

/**
 * Todas las filas con su línea física. csv-parse, no split por comas: las
 * descripciones traen comas entre comillas, y una comilla puede abarcar
 * varias líneas. Un CSV mal formado (comillas sin cerrar) es error del
 * archivo completo.
 */
export function leerFilas(texto: string): FilaDelArchivo[] {
  let registros: Array<{
    record: string[];
    info: { lines: number; raw?: string };
  }>;
  try {
    // Con `info: true` csv-parse devuelve {record, info}, pero sus tipos no
    // lo reflejan.
    // CRLF → LF antes de parsear: con CRLF dentro de un campo entre
    // comillas, csv-parse 7 cuenta cada salto doble y los números de línea
    // salen corridos. Normalizar no mueve ninguna línea física (un CRLF o un
    // CR suelto es un salto en cualquier editor), y el archivo guardado en
    // carga_archivos queda tal cual.
    registros = parse(texto.replace(/\r\n?/g, '\n'), {
      bom: true,
      // Columnas de más o de menos no tiran el archivo: son error de esa
      // fila, y lo reporta leerMovimiento.
      relax_column_count: true,
      skip_empty_lines: true,
      info: true,
      raw: true,
    }) as unknown as typeof registros;
  } catch (error) {
    if (error instanceof CsvError) {
      throw new EstadoDeCuentaRechazado(`CSV mal formado: ${error.message}`);
    }
    throw error;
  }
  return registros.map(({ record, info }) => ({
    linea: lineaDeInicio(info.lines, info.raw ?? ''),
    campos: record,
  }));
}

/**
 * `info.lines` es la línea donde termina el registro, y `raw` trae delante
 * las líneas vacías que se saltó. Inicio = fin − saltos de línea dentro del
 * registro (una descripción entre comillas puede abarcar varias).
 */
function lineaDeInicio(lineaFinal: number, crudo: string): number {
  // Ya normalizado: solo hay \n.
  const registro = crudo.replace(/^\n+/, '').replace(/\n$/, '');
  const internos = registro.split('\n').length - 1;
  return lineaFinal - internos;
}

/**
 * Una fila de datos, o el motivo por el que no entra. Todo lo que la base
 * rechazaría se atrapa aquí: así, un error de base en el worker siempre es
 * de infraestructura (CU-06) y nunca de una fila.
 */
export function leerMovimiento(
  campos: string[],
): MovimientoLeido | { motivo: string } {
  if (campos.length !== ENCABEZADOS.length) {
    return {
      motivo: `La fila tiene ${campos.length} columnas; se esperan ${ENCABEZADOS.length}`,
    };
  }
  const [fecha, descripcion, referencia, monto] = campos;

  if (!esFecha(fecha)) {
    return { motivo: `Fecha inválida: "${fecha}"; se espera AAAA-MM-DD` };
  }
  if (descripcion.trim() === '') {
    return { motivo: 'La descripción está vacía' };
  }
  // Postgres cuenta caracteres (code points), no unidades UTF-16.
  const largoReferencia = [...referencia].length;
  if (largoReferencia > MAX_REFERENCIA) {
    return {
      motivo: `La referencia tiene ${largoReferencia} caracteres; el máximo es ${MAX_REFERENCIA}`,
    };
  }

  const motivoMonto = validarMonto(monto);
  if (motivoMonto) return { motivo: motivoMonto };

  return {
    fecha,
    descripcion,
    referencia: referencia === '' ? null : referencia,
    monto,
  };
}

function validarMonto(monto: string): string | null {
  // Signo opcional, punto decimal, sin separador de miles: lo que acepta
  // dinero.ts. Nunca pasa por Number.
  if (!esDecimal(monto)) {
    return `Monto no numérico: "${monto}"; se espera algo como -1234.50`;
  }
  const [enteros, decimales = ''] = monto.replace(/^-/, '').split('.');
  if (decimales.length > MAX_DECIMALES) {
    return `El monto ${monto} tiene más de ${MAX_DECIMALES} decimales`;
  }
  if (enteros.replace(/^0+(?=\d)/, '').length > MAX_ENTEROS) {
    return `El monto ${monto} pasa de ${MAX_ENTEROS} dígitos enteros`;
  }
  if (dinero(monto).isZero()) {
    return 'El monto es 0: un movimiento sin monto no es movimiento';
  }
  return null;
}

/** AAAA-MM-DD de un día que existe, en un año que Postgres acepta. */
function esFecha(texto: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!partes) return false;
  const [anio, mes, dia] = partes.slice(1).map((p) => parseInt(p, 10));
  if (anio < 1 || mes < 1 || mes > 12 || dia < 1) return false;
  // Día 0 del mes siguiente = último día de este. Solo calendario, no dinero.
  return dia <= new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}
