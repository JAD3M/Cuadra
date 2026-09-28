// src/cfdi/lector-cfdi.ts
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  aTexto,
  CERO,
  dinero,
  type Dinero,
  esDecimal,
  redondear,
  sumar,
} from '../common/dinero';
import { TIPOS_COMPROBANTE } from '../common/entities/tipos';
import {
  type CfdiLeido,
  CfdiRechazado,
  type ImpuestosCfdi,
} from './cfdi-leido';

/**
 * CU-05: de XML de CFDI 4.0 a los campos que usa la tabla `cfdi`. Solo lee y
 * valida; no persiste ni encola (CU-06, CU-08).
 */

/** Nodos que pueden repetirse: siempre como arreglo, aunque venga uno solo. */
const REPETIBLES = new Set([
  'Comprobante.Conceptos.Concepto',
  'Comprobante.Conceptos.Concepto.Impuestos.Traslados.Traslado',
  'Comprobante.Conceptos.Concepto.Impuestos.Retenciones.Retencion',
  'Comprobante.Impuestos.Traslados.Traslado',
  'Comprobante.Impuestos.Retenciones.Retencion',
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // cfdi:, tfd:, implocal: fuera. La versión se valida aparte.
  removeNSPrefix: true,
  // Todo se queda como texto: un monto que pasa por number ya perdió precisión.
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (_nombre, ruta) => REPETIBLES.has(String(ruta)),
});

/**
 * Decimales por moneda (c_Moneda del SAT) para redondear las sumas antes de
 * comparar. Una moneda fuera de la lista se rechaza: adivinar sus decimales
 * es adivinar si el total cuadra. XXX es la de los CFDI de pago.
 */
const DECIMALES_MONEDA: Readonly<Record<string, number>> = {
  MXN: 2,
  USD: 2,
  EUR: 2,
  CAD: 2,
  GBP: 2,
  JPY: 0,
  XXX: 0,
};

/**
 * Patrón de RFC del SAT: 3 letras (moral) o 4 (física), fecha AAMMDD válida
 * en forma, y homoclave de 3. Incluye Ñ y &, que sí existen en RFCs reales.
 */
const RFC =
  /^[A-ZÑ&]{3,4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z\d]{2}[A\d]$/;

const UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

/** `Fecha` del CFDI: sin zona ni milisegundos, por definición del Anexo 20. */
const FECHA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

type Nodo = Record<string, unknown>;

export function leerCfdi(xml: string): CfdiLeido {
  // Un CFDI nunca trae DOCTYPE. Rechazarlo cierra la expansión de entidades
  // (billion laughs) sin depender de los límites del parser.
  if (/<!DOCTYPE/i.test(xml)) {
    throw new CfdiRechazado('xml_mal_formado', 'El XML no puede traer DOCTYPE');
  }
  const validacion = XMLValidator.validate(xml);
  if (validacion !== true) {
    throw new CfdiRechazado(
      'xml_mal_formado',
      `XML mal formado: ${validacion.err.msg} (línea ${validacion.err.line})`,
    );
  }

  const arbol = parser.parse(xml) as Nodo;
  const comprobante = hijo(arbol, 'Comprobante');
  if (!comprobante) {
    throw new CfdiRechazado('no_es_cfdi', 'No hay nodo Comprobante');
  }

  const version = atributo(comprobante, 'Version');
  if (version !== '4.0') {
    throw new CfdiRechazado(
      'version',
      `Versión de CFDI no soportada: ${version ?? '(sin Version)'}; se espera 4.0`,
    );
  }

  const rfcEmisor = rfc(comprobante, 'Emisor', 'rfc_emisor');
  const rfcReceptor = rfc(comprobante, 'Receptor', 'rfc_receptor');

  const uuid = atributo(
    hijo(hijo(comprobante, 'Complemento'), 'TimbreFiscalDigital'),
    'UUID',
  );
  if (!uuid || !UUID.test(uuid)) {
    throw new CfdiRechazado(
      'uuid_ausente',
      uuid
        ? `UUID del timbre con formato inválido: ${uuid}`
        : 'Falta el UUID del TimbreFiscalDigital: el CFDI no está timbrado',
    );
  }

  const fechaEmision = requerido(comprobante, 'Fecha');
  if (!FECHA.test(fechaEmision)) {
    throw new CfdiRechazado(
      'campo_invalido',
      `Fecha con formato inválido: ${fechaEmision}; se espera AAAA-MM-DDThh:mm:ss`,
    );
  }

  const tipoComprobante = requerido(comprobante, 'TipoDeComprobante');
  if (!esTipoComprobante(tipoComprobante)) {
    throw new CfdiRechazado(
      'campo_invalido',
      `TipoDeComprobante desconocido: ${tipoComprobante}`,
    );
  }

  const moneda = requerido(comprobante, 'Moneda');
  const decimales = DECIMALES_MONEDA[moneda];
  if (decimales === undefined) {
    throw new CfdiRechazado(
      'moneda_no_soportada',
      `Moneda sin decimales conocidos: ${moneda}`,
    );
  }

  const tipoCambio = montoOpcional(comprobante, 'TipoCambio');
  const subtotal = monto(comprobante, 'SubTotal');
  const descuento = montoOpcional(comprobante, 'Descuento') ?? '0';
  const total = monto(comprobante, 'Total');
  const impuestos = leerImpuestos(comprobante);

  validarSumas(comprobante, decimales, {
    subtotal,
    descuento,
    total,
    impuestos,
  });

  const metodoPago = atributo(comprobante, 'MetodoPago') ?? null;
  return {
    uuidFiscal: uuid.toUpperCase(),
    rfcEmisor,
    rfcReceptor,
    fechaEmision,
    tipoComprobante,
    moneda,
    tipoCambio,
    subtotal,
    descuento,
    total,
    metodoPago,
    formaPago: atributo(comprobante, 'FormaPago') ?? null,
    serie: atributo(comprobante, 'Serie') ?? null,
    folio: atributo(comprobante, 'Folio') ?? null,
    impuestos,
    estadoInicial: metodoPago === 'PPD' ? 'parcialidades' : 'abierta',
    xmlRaw: { ...arbol, _xml: xml },
  };
}

function leerImpuestos(comprobante: Nodo): ImpuestosCfdi {
  const globales = hijo(comprobante, 'Impuestos');
  const locales = hijo(hijo(comprobante, 'Complemento'), 'ImpuestosLocales');
  return {
    trasladados: montoOpcional(globales, 'TotalImpuestosTrasladados') ?? '0',
    retenidos: montoOpcional(globales, 'TotalImpuestosRetenidos') ?? '0',
    localesTrasladados: montoOpcional(locales, 'TotaldeTraslados') ?? '0',
    localesRetenidos: montoOpcional(locales, 'TotaldeRetenciones') ?? '0',
  };
}

/**
 * Las tres igualdades del CFDI. Cada suma se redondea a los decimales de la
 * moneda y después se compara exacto: un Importe de 6 decimales cuadra si
 * cuadra al redondear, pero un centavo de diferencia no se perdona.
 */
function validarSumas(
  comprobante: Nodo,
  decimales: number,
  declarado: {
    subtotal: string;
    descuento: string;
    total: string;
    impuestos: ImpuestosCfdi;
  },
): void {
  const conceptos = hijos(hijo(comprobante, 'Conceptos'), 'Concepto');
  if (conceptos.length === 0) {
    throw new CfdiRechazado('campo_invalido', 'El CFDI no trae Conceptos');
  }

  const sumaImportes = redondear(
    sumar(conceptos.map((c) => dinero(monto(c, 'Importe', 'Concepto')))),
    decimales,
  );
  comparar(
    'subtotal_no_cuadra',
    'SubTotal',
    declarado.subtotal,
    sumaImportes,
    'Σ Importe de conceptos',
    decimales,
  );

  const sumaDescuentos = redondear(
    sumar(
      conceptos.map((c) => {
        const d = montoOpcional(c, 'Descuento', 'Concepto');
        return d === null ? CERO : dinero(d);
      }),
    ),
    decimales,
  );
  comparar(
    'descuento_no_cuadra',
    'Descuento',
    declarado.descuento,
    sumaDescuentos,
    'Σ Descuento de conceptos',
    decimales,
  );

  const { trasladados, retenidos, localesTrasladados, localesRetenidos } =
    declarado.impuestos;
  const esperado = redondear(
    dinero(declarado.subtotal)
      .minus(dinero(declarado.descuento))
      .plus(dinero(trasladados))
      .minus(dinero(retenidos))
      .plus(dinero(localesTrasladados))
      .minus(dinero(localesRetenidos)),
    decimales,
  );
  comparar(
    'total_no_cuadra',
    'Total',
    declarado.total,
    esperado,
    'SubTotal − Descuento + trasladados − retenidos + locales trasladados − locales retenidos',
    decimales,
  );
}

function comparar(
  motivo: 'subtotal_no_cuadra' | 'descuento_no_cuadra' | 'total_no_cuadra',
  campo: string,
  declarado: string,
  calculado: Dinero,
  formula: string,
  decimales: number,
): void {
  if (!dinero(declarado).eq(calculado)) {
    throw new CfdiRechazado(
      motivo,
      `${campo} no cuadra: declara ${declarado}, ${formula} da ${aTexto(calculado, decimales)}`,
    );
  }
}

function rfc(
  comprobante: Nodo,
  nodo: 'Emisor' | 'Receptor',
  motivo: 'rfc_emisor' | 'rfc_receptor',
): string {
  const valor = atributo(hijo(comprobante, nodo), 'Rfc');
  if (!valor || !RFC.test(valor)) {
    throw new CfdiRechazado(
      motivo,
      `RFC del ${nodo.toLowerCase()} con formato inválido: ${valor ?? '(ausente)'}`,
    );
  }
  return valor;
}

function esTipoComprobante(
  valor: string,
): valor is (typeof TIPOS_COMPROBANTE)[number] {
  return (TIPOS_COMPROBANTE as readonly string[]).includes(valor);
}

function hijo(padre: Nodo | undefined, nombre: string): Nodo | undefined {
  const valor = padre?.[nombre];
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Nodo)
    : undefined;
}

function hijos(padre: Nodo | undefined, nombre: string): Nodo[] {
  const valor = padre?.[nombre];
  return Array.isArray(valor) ? (valor as Nodo[]) : [];
}

function atributo(nodo: Nodo | undefined, nombre: string): string | undefined {
  const valor = nodo?.[`@_${nombre}`];
  return typeof valor === 'string' ? valor : undefined;
}

function requerido(nodo: Nodo, nombre: string, donde = 'Comprobante'): string {
  const valor = atributo(nodo, nombre);
  if (valor === undefined || valor === '') {
    throw new CfdiRechazado('campo_invalido', `Falta ${donde}@${nombre}`);
  }
  return valor;
}

function monto(nodo: Nodo, nombre: string, donde = 'Comprobante'): string {
  const valor = requerido(nodo, nombre, donde);
  if (!esDecimal(valor)) {
    throw new CfdiRechazado(
      'campo_invalido',
      `${donde}@${nombre} no es un monto decimal: ${valor}`,
    );
  }
  return valor;
}

function montoOpcional(
  nodo: Nodo | undefined,
  nombre: string,
  donde = 'Comprobante',
): string | null {
  if (atributo(nodo, nombre) === undefined) return null;
  return monto(nodo as Nodo, nombre, donde);
}
