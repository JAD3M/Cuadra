import { formatearMonto } from '@/shared/dinero';

// Montos de la vista previa (historia 3.4, VistaPrevia.dc.html). Todo el
// formato pasa por `formatearMonto` (decimal.js): ningún monto toca `Number`.

const SIN_DATO = '—';

export type TipoMonto = 'abono' | 'cargo' | 'cero';

export interface MontoConSigno {
  texto: string;
  tipo: TipoMonto;
}

/**
 * Un movimiento con signo explícito: «+1,500.00» (abono), «-250.00» (cargo).
 * El cero, o lo que redondea a cero, va sin signo. El mockup usa «-» ASCII,
 * no el menos tipográfico de `formatearMonto`.
 */
export function montoConSigno(valor: string): MontoConSigno {
  const f = formatearMonto(valor, { moneda: false });
  if (f === null) return { texto: SIN_DATO, tipo: 'cero' };
  if (f.negativo) {
    return { texto: `-${f.texto.replace(/^−/, '')}`, tipo: 'cargo' };
  }
  if (f.texto === '0.00') return { texto: f.texto, tipo: 'cero' };
  return { texto: `+${f.texto}`, tipo: 'abono' };
}

/** Un saldo con miles y dos decimales, sin «$» (como el mockup); «—» si no hay. */
export function saldoVista(valor: string | null): string {
  if (valor === null) return SIN_DATO;
  const f = formatearMonto(valor, { moneda: false });
  if (f === null) return SIN_DATO;
  return f.negativo ? `-${f.texto.replace(/^−/, '')}` : f.texto;
}
