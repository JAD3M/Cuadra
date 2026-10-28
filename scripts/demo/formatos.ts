import { createHash } from 'crypto';
import {
  aTexto,
  dinero,
  type Dinero,
  redondear,
  sumar,
} from '../../src/common/dinero';
import type { CfdiDemo, MovimientoDemo } from './escenarios';

/**
 * CU-18. Escritores de los dos formatos que la demo entrega: CFDI 4.0 (XML) y
 * el estado de cuenta del perfil `cuadra` (CSV). Puros y deterministas. Todo
 * monto pasa por decimal.js (src/common/dinero): nunca por `number`.
 */

export const RFC_EMPRESA: Readonly<Record<'fdb' | 'tcu', string>> = {
  fdb: 'FDB190215QK4',
  tcu: 'TCU170830R52',
};

/** RFC genérico del SAT para pruebas; hace de proveedor de certificación. */
export const RFC_PAC = 'AAA010101AAA';

export const NOMBRE_EMPRESA: Readonly<Record<'fdb' | 'tcu', string>> = {
  fdb: 'Ferretería del Bajío SA de CV (sintético)',
  tcu: 'Transportes Cuautla SA de CV (sintético)',
};

const TASA_IVA = dinero('0.16');

/** IVA de un concepto, redondeado al centavo (exacto si el importe es múltiplo de 0.25). */
function ivaDe(importe: string): Dinero {
  return redondear(dinero(importe).times(TASA_IVA), 2);
}

/** SubTotal = Σ importes. */
export function subtotalDe(importes: readonly string[]): string {
  return aTexto(sumar(importes.map(dinero)), 2);
}

/** Total = SubTotal + Σ IVA por concepto; igual a lo que exige el lector de CFDI. */
export function totalDe(importes: readonly string[]): string {
  const iva = sumar(importes.map(ivaDe));
  return aTexto(sumar(importes.map(dinero)).plus(iva), 2);
}

/**
 * UUID con forma de timbre (8-4-4-4-12, versión 4, variante 8-B) derivado de
 * un sha256: estable entre corridas, único por comprobante y nunca un timbre
 * real.
 */
export function uuidDe(empresa: string, serie: string, folio: string): string {
  const hex = createHash('sha256')
    .update(`cuadra-demo:${empresa}:${serie}-${folio}`)
    .digest('hex')
    .slice(0, 32)
    .split('');
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  const plano = hex.join('').toUpperCase();
  return [
    plano.slice(0, 8),
    plano.slice(8, 12),
    plano.slice(12, 16),
    plano.slice(16, 20),
    plano.slice(20),
  ].join('-');
}

export function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const attr = (nombre: string, valor: string): string =>
  `${nombre}="${escaparXml(valor)}"`;

/** CFDI 4.0 sintético, con la forma de `src/cfdi/fixtures/pue-valido.xml`. */
export function escribirCfdi(c: CfdiDemo): string {
  const importes = c.conceptos.map((x) => x.importe);
  const fecha = `${c.fecha}T${c.hora}`;
  const ppd = c.metodoPago === 'PPD';
  const traslados = aTexto(sumar(importes.map(ivaDe)), 2);
  const conceptos = c.conceptos
    .map(
      (x) =>
        `    <cfdi:Concepto ${[
          attr('ClaveProdServ', '01010101'),
          attr('Cantidad', '1'),
          attr('ClaveUnidad', 'E48'),
          attr('Descripcion', x.descripcion),
          attr('ValorUnitario', x.importe),
          attr('Importe', x.importe),
          attr('ObjetoImp', '02'),
        ].join(' ')}>\n` +
        `      <cfdi:Impuestos><cfdi:Traslados><cfdi:Traslado ${[
          attr('Base', x.importe),
          attr('Impuesto', '002'),
          attr('TipoFactor', 'Tasa'),
          attr('TasaOCuota', '0.160000'),
          attr('Importe', aTexto(ivaDe(x.importe), 2)),
        ].join(' ')}/></cfdi:Traslados></cfdi:Impuestos>\n` +
        `    </cfdi:Concepto>`,
    )
    .join('\n');
  const comprobante = [
    'xmlns:cfdi="http://www.sat.gob.mx/cfd/4"',
    'xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigitalv11"',
    attr('Version', '4.0'),
    attr('Serie', c.serie),
    attr('Folio', c.folio),
    attr('Fecha', fecha),
    attr('FormaPago', ppd ? '99' : '03'),
    attr('SubTotal', subtotalDe(importes)),
    attr('Moneda', c.moneda),
    ...(c.moneda === 'USD' && c.tipoCambio
      ? [attr('TipoCambio', c.tipoCambio)]
      : []),
    attr('Total', totalDe(importes)),
    attr('TipoDeComprobante', 'I'),
    attr('Exportacion', '01'),
    attr('MetodoPago', c.metodoPago),
    attr('LugarExpedicion', '62740'),
    attr('Sello', 'SINTETICO'),
    attr('NoCertificado', 'SINTETICO'),
    attr('Certificado', 'SINTETICO'),
  ].join(' ');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- SINTETICO: datos inventados por scripts/demo/generar.ts; nunca datos reales. -->\n` +
    `<cfdi:Comprobante ${comprobante}>\n` +
    `  <cfdi:Emisor ${attr('Rfc', RFC_EMPRESA[c.empresa])} ${attr('Nombre', NOMBRE_EMPRESA[c.empresa])} ${attr('RegimenFiscal', '601')}/>\n` +
    `  <cfdi:Receptor ${attr('Rfc', c.receptor.rfc)} ${attr('Nombre', c.receptor.nombre)} ${attr('DomicilioFiscalReceptor', '62740')} ${attr('RegimenFiscalReceptor', '601')} ${attr('UsoCFDI', 'G03')}/>\n` +
    `  <cfdi:Conceptos>\n${conceptos}\n  </cfdi:Conceptos>\n` +
    `  <cfdi:Impuestos ${attr('TotalImpuestosTrasladados', traslados)}/>\n` +
    `  <cfdi:Complemento><tfd:TimbreFiscalDigital ${[
      attr('Version', '1.1'),
      attr('UUID', uuidDe(c.empresa, c.serie, c.folio)),
      attr('FechaTimbrado', fecha),
      attr('RfcProvCertif', RFC_PAC),
      attr('SelloCFD', 'SINTETICO'),
      attr('NoCertificadoSAT', 'SINTETICO'),
      attr('SelloSAT', 'SINTETICO'),
    ].join(' ')}/></cfdi:Complemento>\n` +
    `</cfdi:Comprobante>\n`
  );
}

/** RFC 4180: comillas solo si el campo trae coma, comilla o salto de línea. */
function campoCsv(texto: string): string {
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * Perfil `cuadra`: utf-8 sin BOM, LF, punto decimal, sin separador de miles.
 * La columna `moneda` es obligatoria (historia 3.1): la demo es toda en MXN.
 */
export function escribirCsv(filas: readonly MovimientoDemo[]): string {
  const lineas = ['fecha,descripcion,referencia,monto,moneda'].concat(
    filas.map((f) =>
      [f.fecha, f.descripcion, f.referencia, f.monto, 'MXN']
        .map(campoCsv)
        .join(','),
    ),
  );
  return `${lineas.join('\n')}\n`;
}
