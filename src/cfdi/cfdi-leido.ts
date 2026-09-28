// src/cfdi/cfdi-leido.ts
import type { TipoComprobante } from '../common/entities/tipos';

/**
 * Estado con el que nace el CFDI según su método de pago (CU-05). PPD se paga
 * en partes y exige complementos de pago: no se concilia igual que PUE.
 *
 * Ojo: `ck_cfdi_estado` todavía no admite 'parcialidades'. La migración va en
 * CU-06, que es la que persiste.
 */
export type EstadoInicialCfdi = 'abierta' | 'parcialidades';

/** Totales de impuestos tal como los declara el CFDI; '0' si no hay nodo. */
export interface ImpuestosCfdi {
  trasladados: string;
  retenidos: string;
  /** Complemento implocal:ImpuestosLocales. */
  localesTrasladados: string;
  localesRetenidos: string;
}

/**
 * Lo que el lector extrae. Los montos son texto decimal tal como vienen en el
 * XML: nunca pasan por `number`.
 */
export interface CfdiLeido {
  /** UUID del TimbreFiscalDigital, en mayúsculas. */
  uuidFiscal: string;
  rfcEmisor: string;
  rfcReceptor: string;
  /** `Fecha` sin zona, tal cual: hora local del emisor, no UTC. */
  fechaEmision: string;
  tipoComprobante: TipoComprobante;
  moneda: string;
  tipoCambio: string | null;
  subtotal: string;
  /** '0' si el comprobante no trae `Descuento`. */
  descuento: string;
  total: string;
  metodoPago: string | null;
  formaPago: string | null;
  serie: string | null;
  folio: string | null;
  impuestos: ImpuestosCfdi;
  estadoInicial: EstadoInicialCfdi;
  /** Árbol parseado más `_xml`, el original íntegro (ck_cfdi_xml_raw_integro). */
  xmlRaw: Record<string, unknown> & { _xml: string };
}

/** Qué validación falló. Estable: CU-06 lo va a guardar y mostrar. */
export type MotivoRechazoCfdi =
  | 'xml_mal_formado'
  | 'no_es_cfdi'
  | 'version'
  | 'campo_invalido'
  | 'rfc_emisor'
  | 'rfc_receptor'
  | 'uuid_ausente'
  | 'moneda_no_soportada'
  | 'subtotal_no_cuadra'
  | 'descuento_no_cuadra'
  | 'total_no_cuadra';

export class CfdiRechazado extends Error {
  constructor(
    readonly motivo: MotivoRechazoCfdi,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'CfdiRechazado';
  }
}
