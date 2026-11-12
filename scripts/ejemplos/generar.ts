import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { aTexto, dinero } from '../../src/common/dinero';
import { construirPdfSintetico } from '../../src/bancos/pdf/pdf-sintetico';
import { escribirCfdi, escribirCsv } from '../demo/formatos';
import {
  DIFERENCIA_NO_CUADRA,
  FACTURAS,
  MOVIMIENTOS,
  PERIODO,
  SALDO_ANTERIOR,
  saldoFinal,
} from './juego';

/**
 * Historia 7.1. Genera `ejemplos/bbva/`: el estado de cuenta de BBVA en PDF
 * (uno que cuadra y uno que no), su CSV equivalente, los CFDI del mismo mes y
 * el manifiesto que marca el origen de cada archivo. Todo SINTÉTICO. Pura y
 * determinista: `generarEjemplos()` devuelve ruta relativa → contenido y el
 * CLI solo la escribe. `ejemplos.deriva.spec.ts` vigila que lo commiteado sea
 * exactamente esta salida.
 */

export const CARPETA = 'ejemplos/bbva';
export const PDF_CUADRA = `${CARPETA}/estado-cuenta-septiembre-2026.pdf`;
export const PDF_NO_CUADRA = `${CARPETA}/estado-cuenta-septiembre-2026-no-cuadra.pdf`;
export const CSV_EQUIVALENTE = `${CARPETA}/estado-cuenta-septiembre-2026.csv`;
export const MANIFIESTO = 'ejemplos/MANIFIESTO.json';

/** Lo único que un archivo del manifiesto puede ser. Un estado de cuenta real nunca entra al repositorio. */
export const ORIGENES_PERMITIDOS = ['sintetico', 'publico'] as const;

const MESES = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
];

/** 1160.5 → 1,160.50 (el formato del texto que extrae el PDF de BBVA). */
function conMiles(texto: string): string {
  const [entero, decimales] = aTexto(dinero(texto).abs(), 2).split('.');
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimales}`;
}

const conSigno = (texto: string): string =>
  `${dinero(texto).isNegative() ? '-' : ''}${conMiles(texto)}`;

function fechaCorta(fecha: string): string {
  const [, mes, dia] = fecha.split('-');
  return `${dia}/${MESES[Number(mes) - 1]}`;
}

function aDDMMAAAA(fecha: string): string {
  const [a, m, d] = fecha.split('-');
  return `${d}/${m}/${a}`;
}

export function lineasDelPdf(saldoDelFinal: string): string[] {
  const lineas = [
    'DOCUMENTO SINTETICO - SIN DATOS REALES',
    'BBVA ESTADO DE CUENTA',
    `Periodo DEL ${aDDMMAAAA(PERIODO.inicio)} AL ${aDDMMAAAA(PERIODO.fin)}`,
    'Moneda MXN',
    `Saldo Anterior ${conMiles(SALDO_ANTERIOR)}`,
    'FECHA OPER LIQ DESCRIPCION IMPORTE SALDO',
  ];
  let saldo = dinero(SALDO_ANTERIOR);
  for (const m of MOVIMIENTOS) {
    saldo = saldo.plus(dinero(m.monto));
    const dia = fechaCorta(m.fecha);
    const ref = m.referencia === '' ? '' : ` Ref. ${m.referencia}`;
    lineas.push(
      `${dia} ${dia} ${m.descripcion}${ref} ${conMiles(m.monto)} ${conSigno(aTexto(saldo, 2))}`,
    );
  }
  lineas.push(`Saldo Final ${conMiles(saldoDelFinal)}`);
  return lineas;
}

export function nombreDeCfdi(folio: string): string {
  return `${CARPETA}/cfdi/fdb-A-${folio}.xml`;
}

export function generarEjemplos(): Map<string, string | Buffer> {
  const salida = new Map<string, string | Buffer>();

  for (const f of FACTURAS) salida.set(nombreDeCfdi(f.folio), escribirCfdi(f));

  salida.set(CSV_EQUIVALENTE, escribirCsv(MOVIMIENTOS));
  salida.set(PDF_CUADRA, construirPdfSintetico(lineasDelPdf(saldoFinal())));
  salida.set(
    PDF_NO_CUADRA,
    construirPdfSintetico(
      lineasDelPdf(
        aTexto(dinero(saldoFinal()).plus(dinero(DIFERENCIA_NO_CUADRA)), 2),
      ),
    ),
  );

  const archivos = [...salida.keys()].sort();
  const manifiesto = {
    aviso:
      'Todo lo de esta carpeta es sintético o público. Un estado de cuenta real nunca se sube al repositorio: ver ejemplos/COMO-ANONIMIZAR.md.',
    archivos: archivos.map((ruta) => ({
      ruta: ruta.replace(/^ejemplos\//, ''),
      origen: 'sintetico' as const,
    })),
  };
  salida.set(MANIFIESTO, `${JSON.stringify(manifiesto, null, 2)}\n`);
  return salida;
}

/** Escribe `generarEjemplos()` en `raiz`. */
export function escribirEjemplos(raiz: string): number {
  const archivos = generarEjemplos();
  for (const [ruta, contenido] of archivos) {
    const destino = join(raiz, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, contenido);
  }
  return archivos.size;
}

if (require.main === module) {
  const total = escribirEjemplos(join(__dirname, '..', '..'));
  console.log(`ejemplos/: ${total} archivos generados`);
}
