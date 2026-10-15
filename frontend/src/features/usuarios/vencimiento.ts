import { formatearFecha } from '@/features/bandeja/fecha';
import { PENDIENTES } from './textos';

const DIA_MS = 86_400_000;

/**
 * Texto del vencimiento de una pendiente. Si vence o no lo dice el servidor
 * (`vencida`); el reloj del navegador solo sirve para escribir cuántos días
 * faltan de una invitación que el servidor ya dio por vigente, y nunca baja
 * de un día.
 */
export function textoVence(
  venceEn: string,
  vencida: boolean,
  ahora: number = Date.now(),
): { texto: string; vencida: boolean } {
  if (vencida) return { texto: PENDIENTES.vencida, vencida: true };
  const dias = Math.max(1, Math.ceil((Date.parse(venceEn) - ahora) / DIA_MS));
  return {
    texto: dias === 1 ? 'Vence en 1 día' : `Vence en ${dias} días`,
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
