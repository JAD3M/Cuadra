// src/bancos/lector-estado-cuenta.ts
import { CsvError, parse } from 'csv-parse/sync';
import { dinero, esDecimal } from '../common/dinero';
import type { PerfilBancario } from './perfil';

/**
 * CU-09 y CU-10: de un estado de cuenta, según el perfil de su banco, a
 * movimientos normalizados (fecha, concepto, referencia, monto con signo).
 * El formato canónico de Cuadra es un perfil más (`perfiles/cuadra.json`),
 * así que todos los bancos pasan por el mismo camino: validación del archivo
 * en el POST, cola, y filas en el worker.
 */

/** Dígitos que caben en `movimientos.monto`, NUMERIC(18,4). */
const MAX_ENTEROS = 14;
const MAX_DECIMALES = 4;
const MAX_REFERENCIA = 128;

/** El archivo entero no sirve: 400 en el POST, antes de guardar nada. */
export class EstadoDeCuentaRechazado extends Error {
  constructor(
    mensaje: string,
    /** Código estable, solo en los rechazos que el cliente distingue. */
    readonly codigo?: string,
  ) {
    super(mensaje);
    this.name = 'EstadoDeCuentaRechazado';
  }
}

/** Historia 3.1. El archivo trae una moneda distinta de MXN: no se procesa. */
export const MENSAJE_MONEDA_NO_MXN =
  'El estado de cuenta no está en MXN. Cuadra solo procesa estados de cuenta en pesos mexicanos.';

/** Historia 3.1. El perfil exige moneda y el archivo no la trae (o la trae vacía). */
export const MENSAJE_MONEDA_FALTANTE =
  'El estado de cuenta no declara su moneda. Agrega la columna "moneda" con MXN en todas las filas.';

/** Código estable del rechazo anterior, para que el cliente no lea el texto. */
export const CODIGO_MONEDA_NO_MXN = 'moneda_no_mxn';
/** Código estable de `MENSAJE_MONEDA_FALTANTE`. */
export const CODIGO_MONEDA_FALTANTE = 'moneda_faltante';
/** PDF sin capa de texto (escaneado o solo imágenes). */
export const CODIGO_PDF_SIN_TEXTO = 'pdf_sin_texto';
/** Mensaje compartido por el adaptador y por el guard de la subida. */
export const MENSAJE_PDF_ILEGIBLE =
  'No pudimos leer el PDF. Descárgalo de nuevo desde el portal del banco y vuelve a subirlo.';
/** Bytes que no son un PDF legible (corrupto, truncado, protegido). */
export const CODIGO_PDF_ILEGIBLE = 'pdf_ilegible';

/** Historia 3.3. Los saldos del PDF no cuadran con la suma de sus movimientos. */
export const CODIGO_SALDOS_NO_CUADRAN = 'saldos_no_cuadran';
export const MENSAJE_SALDOS_NO_CUADRAN =
  'Los saldos del estado de cuenta no cuadran con sus movimientos, así que no se guardó nada. Revisa que el PDF esté completo, descárgalo de nuevo desde el portal del banco y vuelve a subirlo.';
/** Historia 3.3. Cuadra, pero el lector no pudo leer alguna línea. */
export const CODIGO_LINEAS_NO_LEIDAS = 'lineas_no_leidas';
export const MENSAJE_LINEAS_NO_LEIDAS =
  'No pudimos leer algunas líneas del estado de cuenta, así que no se guardó nada. Revisa las líneas indicadas y, si el PDF es el original del banco, avísanos para ajustar la lectura.';

/** Historia 3.3. Cuadra y no hay líneas sin leer, pero no se leyó ningún movimiento. */
export const CODIGO_SIN_MOVIMIENTOS = 'sin_movimientos';
export const MENSAJE_SIN_MOVIMIENTOS =
  'No pudimos leer ningún movimiento del estado de cuenta, así que no se guardó el archivo. Revisa que el PDF sea el original del banco y que incluya el detalle de movimientos.';

export interface FilaDelArchivo {
  /** Línea física del archivo original donde empieza la fila (preámbulo incluido). */
  linea: number;
  campos: string[];
}

export interface MovimientoLeido {
  /** AAAA-MM-DD: la columna es `date`, sin hora ni zona. */
  fecha: string;
  descripcion: string;
  referencia: string | null;
  /** Texto decimal canónico con signo: positivo es abono, negativo es cargo. */
  monto: string;
}

/**
 * Validación del archivo completo, en la petición: la codificación del
 * perfil, sin bytes nulos, CSV bien formado, encabezados exactos del perfil
 * y al menos una fila. Las filas se validan una por una en el worker; aquí
 * solo se cuentan. `texto` es lo que se guarda: ya decodificado, así que el
 * worker no vuelve a pensar en la codificación.
 */
export function validarEstadoDeCuenta(
  buffer: Buffer,
  perfil: PerfilBancario,
): { texto: string; filas: number } {
  // Perfil con moneda fija: si no es MXN, ningún archivo suyo se procesa.
  if (perfil.moneda !== undefined && perfil.moneda !== 'MXN') {
    throw new EstadoDeCuentaRechazado(
      MENSAJE_MONEDA_NO_MXN,
      CODIGO_MONEDA_NO_MXN,
    );
  }
  let texto: string;
  try {
    // UTF-8 con `fatal`: un byte inválido lanza en vez de volverse U+FFFD.
    // windows-1252 asigna algo a cada byte y nunca lanza.
    texto = new TextDecoder(perfil.codificacion, { fatal: true }).decode(
      buffer,
    );
  } catch {
    throw new EstadoDeCuentaRechazado(
      `El archivo no está en ${perfil.codificacion.toUpperCase()}, como espera el perfil "${perfil.id}". ` +
        'Guárdalo con esa codificación y vuelve a subirlo.',
    );
  }
  // windows-1252 decodifica cualquier byte, así que un UTF-8 subido con ese
  // perfil saldría con acentos rotos ("DepÃ³sito") sin error. Si todo es
  // ASCII, las dos codificaciones leen igual y no hay nada que decidir. Si
  // hay bytes altos y aun así es UTF-8 válido, casi seguro es UTF-8: un
  // windows-1252 real con acentos casi nunca lo es (una "é" suelta, 0xE9,
  // sin bytes de continuación detrás, ya es UTF-8 inválido).
  if (
    perfil.codificacion === 'windows-1252' &&
    buffer.some((byte) => byte >= 0x80) &&
    esUtf8Valido(buffer)
  ) {
    throw new EstadoDeCuentaRechazado(
      `El archivo parece estar en UTF-8; el perfil ${perfil.id} espera windows-1252`,
    );
  }
  // Un \0 en un CSV de banco es archivo corrupto, no una fila malformada: se
  // rechaza el archivo completo. Además `text` de Postgres no lo admite, y el
  // contenido se guarda tal cual. La línea es para que el contador lo
  // encuentre.
  const nulo = texto.indexOf('\0');
  if (nulo !== -1) {
    throw new EstadoDeCuentaRechazado(
      `Línea ${lineaDeCaracter(texto, nulo)}: el archivo trae bytes nulos; parece corrupto`,
    );
  }

  const [encabezado, ...datos] = leerFilas(texto, perfil);
  const iMoneda = encabezado ? posicionMoneda(encabezado.campos, perfil) : -1;
  if (
    !encabezado ||
    !mismosEncabezados(sinColumna(encabezado.campos, iMoneda), perfil)
  ) {
    const esperado = perfil.encabezados.join(perfil.separador);
    throw new EstadoDeCuentaRechazado(
      `Encabezados inválidos para el perfil "${perfil.id}": se esperan exactamente "${esperado}"` +
        (encabezado
          ? ` en la línea ${encabezado.linea}, llegó "${encabezado.campos.join(perfil.separador)}"`
          : ` en la línea ${perfil.lineasPreambulo + 1}, y el archivo termina antes`),
    );
  }
  if (datos.length === 0) {
    throw new EstadoDeCuentaRechazado('El archivo no trae movimientos');
  }
  if (perfil.columnaMoneda !== undefined) {
    // La columna es obligatoria: sin ella, o con una celda vacía o ausente,
    // no se asume MXN.
    const monedas = datos.map(({ campos }) => campos[iMoneda]?.trim() ?? '');
    if (iMoneda < 0 || monedas.some((moneda) => moneda === '')) {
      throw new EstadoDeCuentaRechazado(
        MENSAJE_MONEDA_FALTANTE,
        CODIGO_MONEDA_FALTANTE,
      );
    }
    if (monedas.some((moneda) => moneda.toUpperCase() !== 'MXN')) {
      throw new EstadoDeCuentaRechazado(
        MENSAJE_MONEDA_NO_MXN,
        CODIGO_MONEDA_NO_MXN,
      );
    }
  }
  return { texto, filas: datos.length };
}

/**
 * Historia 3.1: dónde está la columna `moneda` en el encabezado del archivo, o
 * -1 si el perfil no la declara (moneda fija) o el archivo no la trae.
 */
export function posicionMoneda(
  encabezado: string[],
  perfil: PerfilBancario,
): number {
  return perfil.columnaMoneda === undefined
    ? -1
    : encabezado.indexOf(perfil.columnaMoneda);
}

function sinColumna(campos: string[], indice: number): string[] {
  return indice < 0 ? campos : campos.filter((_, i) => i !== indice);
}

function esUtf8Valido(buffer: Buffer): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function mismosEncabezados(campos: string[], perfil: PerfilBancario): boolean {
  return (
    campos.length === perfil.encabezados.length &&
    campos.every((campo, i) => campo === perfil.encabezados[i])
  );
}

/** Línea física (desde 1) del carácter en `posicion`; CRLF o CR cuentan uno. */
function lineaDeCaracter(texto: string, posicion: number): number {
  const antes = texto.slice(0, posicion).match(/\r\n|\r|\n/g);
  return (antes?.length ?? 0) + 1;
}

/**
 * El encabezado y las filas, con su línea física en el archivo original. El
 * preámbulo se corta antes de parsear: son líneas libres (datos de la
 * cuenta) que pueden traer comillas o separadores sueltos. csv-parse, no
 * split por separador: los conceptos traen el separador entre comillas, y
 * una comilla puede abarcar varias líneas. Un CSV mal formado (comillas sin
 * cerrar) es error del archivo completo.
 */
export function leerFilas(
  texto: string,
  perfil: PerfilBancario,
): FilaDelArchivo[] {
  // CRLF → LF antes de parsear: con CRLF dentro de un campo entre comillas,
  // csv-parse 7 cuenta cada salto doble y los números de línea salen
  // corridos. Normalizar no mueve ninguna línea física (un CRLF o un CR
  // suelto es un salto en cualquier editor), y el archivo guardado en
  // carga_archivos queda tal cual.
  const normalizado = texto.replace(/\r\n?/g, '\n');
  const { cuerpo, lineasCortadas } = sinPreambulo(
    normalizado,
    perfil.lineasPreambulo,
  );

  let registros: Array<{
    record: string[];
    info: { lines: number; raw?: string };
  }>;
  try {
    // Con `info: true` csv-parse devuelve {record, info}, pero sus tipos no
    // lo reflejan.
    registros = parse(cuerpo, {
      bom: true,
      delimiter: perfil.separador,
      // Columnas de más o de menos no tiran el archivo: son error de esa
      // fila, y lo reporta leerMovimiento.
      relax_column_count: true,
      skip_empty_lines: true,
      info: true,
      raw: true,
    }) as unknown as typeof registros;
  } catch (error) {
    if (error instanceof CsvError) {
      throw new EstadoDeCuentaRechazado(
        `CSV mal formado (después de ${lineasCortadas} líneas de preámbulo): ${error.message}`,
      );
    }
    throw error;
  }
  return registros.map(({ record, info }) => ({
    linea: lineasCortadas + lineaDeInicio(info.lines, info.raw ?? ''),
    campos: record,
  }));
}

/** Corta las primeras `n` líneas físicas. Si hay menos, no queda cuerpo. */
function sinPreambulo(
  texto: string,
  n: number,
): { cuerpo: string; lineasCortadas: number } {
  let desde = 0;
  for (let i = 0; i < n; i++) {
    const salto = texto.indexOf('\n', desde);
    if (salto === -1) return { cuerpo: '', lineasCortadas: n };
    desde = salto + 1;
  }
  return { cuerpo: texto.slice(desde), lineasCortadas: n };
}

/**
 * `info.lines` es la línea donde termina el registro, y `raw` trae delante
 * las líneas vacías que se saltó. Inicio = fin − saltos de línea dentro del
 * registro (un concepto entre comillas puede abarcar varias).
 */
function lineaDeInicio(lineaFinal: number, crudo: string): number {
  // Ya normalizado: solo hay \n.
  const registro = crudo.replace(/^\n+/, '').replace(/\n$/, '');
  const internos = registro.split('\n').length - 1;
  return lineaFinal - internos;
}

/**
 * Una fila de datos normalizada, o el motivo por el que no entra. Todo lo
 * que la base rechazaría se atrapa aquí: así, un error de base en el worker
 * siempre es de infraestructura (CU-06) y nunca de una fila.
 */
export function leerMovimiento(
  camposDelArchivo: string[],
  perfil: PerfilBancario,
  /** `posicionMoneda` del encabezado del archivo; -1 si no trae moneda. */
  indiceMoneda = -1,
): MovimientoLeido | { motivo: string } {
  const { encabezados, columnas } = perfil;
  const esperadas = encabezados.length + (indiceMoneda >= 0 ? 1 : 0);
  if (camposDelArchivo.length !== esperadas) {
    return {
      motivo: `La fila tiene ${camposDelArchivo.length} columnas; se esperan ${esperadas}`,
    };
  }
  const campos = sinColumna(camposDelArchivo, indiceMoneda);
  const valor = (encabezado: string) => campos[encabezados.indexOf(encabezado)];

  const fechaOriginal = valor(columnas.fecha);
  const fecha = normalizarFecha(fechaOriginal, perfil.formatoFecha);
  if (!fecha) {
    return {
      motivo: `Fecha inválida: "${fechaOriginal}"; se espera ${perfil.formatoFecha}`,
    };
  }

  const descripcion = valor(columnas.concepto);
  if (descripcion.trim() === '') {
    return { motivo: `${columnas.concepto} está vacío` };
  }

  const referencia =
    columnas.referencia === undefined ? '' : valor(columnas.referencia);
  // Postgres cuenta caracteres (code points), no unidades UTF-16.
  const largoReferencia = [...referencia].length;
  if (largoReferencia > MAX_REFERENCIA) {
    return {
      motivo: `La referencia tiene ${largoReferencia} caracteres; el máximo es ${MAX_REFERENCIA}`,
    };
  }

  const monto =
    columnas.monto !== undefined
      ? montoConSigno(valor(columnas.monto), columnas.monto, perfil)
      : montoDeCargoYAbono(
          valor(columnas.cargo as string),
          valor(columnas.abono as string),
          perfil,
        );
  if ('motivo' in monto) return monto;

  return {
    fecha,
    descripcion,
    referencia: referencia === '' ? null : referencia,
    monto: monto.canonico,
  };
}

type Monto = { canonico: string } | { motivo: string };

function montoConSigno(
  texto: string,
  columna: string,
  perfil: PerfilBancario,
): Monto {
  const canonico = normalizarNumero(texto, perfil, true);
  if (canonico === null) return noNumerico(columna, texto, perfil, true);
  return validarMonto(canonico, texto);
}

/**
 * monto = abono − cargo. Exactamente uno de los dos: con ambos o con
 * ninguno no se sabe qué pasó, y adivinar es un falso positivo en potencia.
 * Van sin signo: la columna ya dice la dirección.
 */
function montoDeCargoYAbono(
  cargo: string,
  abono: string,
  perfil: PerfilBancario,
): Monto {
  const { cargo: colCargo, abono: colAbono } = perfil.columnas as {
    cargo: string;
    abono: string;
  };
  const hayCargo = cargo.trim() !== '';
  const hayAbono = abono.trim() !== '';
  if (hayCargo && hayAbono) {
    return {
      motivo: `La fila trae ${colCargo} y ${colAbono}; debe traer solo uno`,
    };
  }
  if (!hayCargo && !hayAbono) {
    return { motivo: `La fila no trae ${colCargo} ni ${colAbono}` };
  }
  const [texto, columna] = hayCargo ? [cargo, colCargo] : [abono, colAbono];
  const canonico = normalizarNumero(texto, perfil, false);
  if (canonico === null) return noNumerico(columna, texto, perfil, false);
  // abono − cargo con uno de los dos vacío: el abono tal cual, o el cargo
  // en negativo. El cargo ya es un decimal canónico sin signo, así que
  // anteponer el '-' es exacto y conserva el texto (dinero.ts quitaría los
  // ceros finales: 25000.50 → 25000.5).
  const conSigno = hayCargo ? `-${canonico}` : canonico;
  return validarMonto(conSigno, texto);
}

function noNumerico(
  columna: string,
  texto: string,
  perfil: PerfilBancario,
  conSigno: boolean,
): Monto {
  const miles = perfil.separadorMiles ?? '';
  const ejemplo = `${conSigno ? '-' : ''}1${miles}234${perfil.separadorDecimal}50`;
  return {
    motivo: `${columna} no numérico: "${texto}"; se espera algo como ${ejemplo}`,
  };
}

/**
 * Del número como lo escribe el banco al decimal canónico (`-1234.56`), o
 * null si no tiene la forma del perfil. Los miles, si los hay, van cada tres
 * dígitos: "1,23.4" no es un número. La expresión se arma aquí con los
 * separadores del perfil, que solo pueden ser los de su enum.
 */
function normalizarNumero(
  texto: string,
  perfil: PerfilBancario,
  admiteSigno: boolean,
): string | null {
  const escapar = (s: string) => s.replace(/[.\\]/g, '\\$&');
  const decimal = escapar(perfil.separadorDecimal);
  const enteros = perfil.separadorMiles
    ? `\\d{1,3}(?:${escapar(perfil.separadorMiles)}\\d{3})+|\\d+`
    : '\\d+';
  const forma = new RegExp(
    `^(${admiteSigno ? '-?' : ''})(${enteros})(?:${decimal}(\\d+))?$`,
  );
  const partes = forma.exec(texto);
  if (!partes) return null;
  const [, signo, entera, decimales] = partes;
  const canonico = `${signo}${perfil.separadorMiles ? entera.split(perfil.separadorMiles).join('') : entera}${decimales === undefined ? '' : `.${decimales}`}`;
  // Doble seguro: lo que sale tiene que ser lo que acepta dinero.ts.
  return esDecimal(canonico) ? canonico : null;
}

/** Reglas de `movimientos.monto`, sobre el valor ya canónico. */
function validarMonto(canonico: string, original: string): Monto {
  const [enteros, decimales = ''] = canonico.replace(/^-/, '').split('.');
  if (decimales.length > MAX_DECIMALES) {
    return {
      motivo: `El monto ${original} tiene más de ${MAX_DECIMALES} decimales`,
    };
  }
  if (enteros.replace(/^0+(?=\d)/, '').length > MAX_ENTEROS) {
    return {
      motivo: `El monto ${original} pasa de ${MAX_ENTEROS} dígitos enteros`,
    };
  }
  if (dinero(canonico).isZero()) {
    return {
      motivo: 'El monto es 0: un movimiento sin monto no es movimiento',
    };
  }
  return { canonico };
}

/** A AAAA-MM-DD, si es un día que existe en un año que Postgres acepta. */
function normalizarFecha(
  texto: string,
  formato: PerfilBancario['formatoFecha'],
): string | null {
  const forma = {
    'AAAA-MM-DD': /^(?<a>\d{4})-(?<m>\d{2})-(?<d>\d{2})$/,
    'DD/MM/AAAA': /^(?<d>\d{2})\/(?<m>\d{2})\/(?<a>\d{4})$/,
    'DD-MM-AAAA': /^(?<d>\d{2})-(?<m>\d{2})-(?<a>\d{4})$/,
  }[formato];
  const partes = forma.exec(texto)?.groups;
  if (!partes) return null;
  const [anio, mes, dia] = [partes.a, partes.m, partes.d].map((p) =>
    parseInt(p, 10),
  );
  if (anio < 1 || mes < 1 || mes > 12 || dia < 1) return null;
  // Día 0 del mes siguiente = último día de este. Solo calendario, no dinero.
  if (dia > new Date(Date.UTC(anio, mes, 0)).getUTCDate()) return null;
  return `${partes.a}-${partes.m}-${partes.d}`;
}
