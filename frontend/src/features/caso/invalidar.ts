import type { QueryClient } from '@tanstack/react-query';
import { clavesBandeja } from '@/features/bandeja/claves';
import { clavesCaso } from './claves';

/**
 * Tras confirmar o rechazar, refresca lo que cambió en la época dada: el caso
 * y todos sus historiales (las hermanas ganan eventos al confirmar) y la
 * bandeja entera (listas y resumen, que también alimenta el contador de la
 * barra lateral). Se espera al caso para que la pantalla no muestre el estado
 * anterior con los controles habilitados; la bandeja se refresca sin esperar.
 */
export async function invalidarTrasResolver(
  cliente: QueryClient,
  epoca: number,
): Promise<void> {
  await cliente.invalidateQueries({ queryKey: clavesCaso.todas(epoca) });
  void cliente.invalidateQueries({ queryKey: clavesBandeja.todas(epoca) });
}
