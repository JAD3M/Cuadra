// src/cfdi/cfdi-leido.ts
import type { EstadoCfdi, TipoComprobante } from '../common/entities/tipos';

/**
 * Estado con el que nace el CFDI según su método de pago (CU-05). PPD se paga
 * en partes y exige complementos de pago: no se concilia igual que PUE.
 * Atado a `EstadoCfdi` para que no pueda salir un estado que el CHECK rechace.
 */
export type EstadoInicialCfdi = Extract<
  EstadoCfdi,
  'abierta' | 'parcialidades'
>;

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
  | 'campo_fuera_de_limite'
  | 'rfc_emisor'
  | 'rfc_receptor'
  | 'uuid_ausente'
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
