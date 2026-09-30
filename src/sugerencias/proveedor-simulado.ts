// src/sugerencias/proveedor-simulado.ts
import { dinero } from '../common/dinero';
import {
  type CandidatoEntrada,
  type EntradaSugerencia,
  ProveedorSugerencia,
  type RespuestaSugerencia,
} from './proveedor-sugerencia';

/**
 * CU-18. Proveedor determinista para demos: no llama a ningún modelo. Existe
 * para que la demo corra sin llave y sin red, y por eso todo lo que dice lleva
 * la etiqueta: nadie debe confundir esto con un modelo real. Como el resto de
 * proveedores, solo sugiere; `validarRespuesta` y la persistencia siguen siendo
 * la compuerta, y el motor de reglas es quien decide.
 */
export const ETIQUETA_SIMULADA = '[SIMULADA — no es un modelo real]';
export const MODELO_SIMULADO = 'simulado-demo';

function escapar(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ¿La descripción cita este comprobante? Coincide por serie-folio (con o sin
 * guion/espacios) o, si no hay serie, por folio. Los bordes impiden que
 * "GAMA2001" cite "A2001": nunca se busca sobre texto pegado.
 */
function cita(descripcion: string, serieFolio: string): boolean {
  const texto = descripcion.toUpperCase();
  const partes = serieFolio.toUpperCase().split('-');
  const folio = escapar(partes[partes.length - 1].trim());
  const serie = partes.length > 1 ? escapar(partes[0].trim()) : '';
  const cuerpo = serie ? `${serie}\\s*-?\\s*${folio}` : folio;
  return new RegExp(`(?<![A-Z0-9])${cuerpo}(?![A-Z0-9])`).test(texto);
}

function mismoMonto(a: string, b: string): boolean {
  return dinero(a).eq(dinero(b));
}

function sugerir(
  c: CandidatoEntrada,
  confianza: 'alta' | 'media',
  detalle: string,
): RespuestaSugerencia {
  return {
    decision: 'sugerir',
    candidato: c.etiqueta,
    confianza,
    explicacion: `${ETIQUETA_SIMULADA} ${detalle}`,
  };
}

/**
 * Regla fija, en orden, gana la primera:
 * 1. Exactamente un candidato citado en la descripción: se sugiere ('alta' si
 *    el monto coincide, 'media' si no).
 * 2. Ninguno citado, más de un candidato y exactamente uno con el monto
 *    exacto: se sugiere con 'media'. Con un solo candidato no se aplica: entre
 *    movimientos de igual monto sería elegir al azar (falso positivo).
 * 3. Cualquier otro caso: ninguno.
 */
export function decidirSimulado(e: EntradaSugerencia): RespuestaSugerencia {
  const { movimiento, candidatos } = e;
  const citados = candidatos.filter((c) =>
    cita(movimiento.descripcion, c.serieFolio),
  );
  if (citados.length === 1) {
    const c = citados[0];
    const exacto = mismoMonto(c.total, movimiento.monto);
    return sugerir(
      c,
      exacto ? 'alta' : 'media',
      `La descripcion cita ${c.serieFolio}${exacto ? ' y el monto coincide' : ', aunque el monto difiere'}.`,
    );
  }
  if (citados.length === 0 && candidatos.length > 1) {
    const exactos = candidatos.filter((c) =>
      mismoMonto(c.total, movimiento.monto),
    );
    if (exactos.length === 1) {
      return sugerir(
        exactos[0],
        'media',
        `Entre ${candidatos.length} candidatos solo ${exactos[0].serieFolio} coincide exactamente en monto.`,
      );
    }
  }
  return { decision: 'ninguno' };
}

export class ProveedorSimulado extends ProveedorSugerencia {
  readonly activo = true;
  readonly modelo = MODELO_SIMULADO;

  sugerir(entrada: EntradaSugerencia): Promise<RespuestaSugerencia> {
    return Promise.resolve(decidirSimulado(entrada));
  }
}
