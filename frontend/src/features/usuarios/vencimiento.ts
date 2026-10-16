import { formatearFecha } from '@/features/bandeja/fecha';
import { PERSONAS } from './textos';

const DIA_MS = 86_400_000;

/**
 * Texto del estado de una pendiente («Pendiente · vence en N días» o
 * «Vencida»). Si vence o no lo dice el servidor
 * (`vencida`); el reloj del navegador solo sirve para escribir cuántos días
 * faltan de una invitación que el servidor ya dio por vigente, y nunca baja
 * de un día.
 */
export function textoVence(
  venceEn: string,
  vencida: boolean,
  ahora: number = Date.now(),
): { texto: string; vencida: boolean } {
  if (vencida) return { texto: PERSONAS.vencida, vencida: true };
  const dias = Math.max(1, Math.ceil((Date.parse(venceEn) - ahora) / DIA_MS));
  return {
    texto: PERSONAS.pendiente(dias === 1 ? '1 día' : `${dias} días`),
    vencida: false,
  };
}

/**
 * Día de envío (`YYYY-MM-DD`) de un instante ISO, separado por texto como la
 * bandeja: un `Date` correría el día en zonas al oeste de UTC.
 */
export function textoEnviada(creadaEn: string): string {
  return formatearFecha(creadaEn.slice(0, 10));
}
