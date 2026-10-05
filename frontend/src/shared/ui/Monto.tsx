import { formatearMonto } from '@/shared/dinero';
import estilos from './Monto.module.css';

export interface MontoProps {
  /** Decimal en cadena tal como lo envía la API. Nunca un `number`. */
  valor: string | null | undefined;
  /** Antepone el signo de peso. Por defecto `true`. */
  moneda?: boolean;
  /**
   * Código de moneda (por ejemplo `USD`) que se muestra tras el monto, dentro
   * del mismo elemento sin salto de línea. Se omite con un valor inválido.
   */
  codigoMoneda?: string;
}

const PLACEHOLDER = '—';

/**
 * Muestra un monto en una sola línea, en fuente mono con numerales
 * tabulares. Un valor ausente o inválido muestra un guion largo con un
 * texto oculto "Monto no disponible"; jamás `0.00`.
 */
export function Monto({ valor, moneda = true, codigoMoneda }: MontoProps) {
  const formateado =
    typeof valor === 'string' ? formatearMonto(valor, { moneda }) : null;

  if (formateado === null) {
    return (
      <span
        className={`${estilos.monto} ${estilos.invalido}`}
        data-estado="invalido"
      >
        <span aria-hidden="true">{PLACEHOLDER}</span>
        <span className={estilos.ocultoVisual}>Monto no disponible</span>
      </span>
    );
  }

  const estado = formateado.negativo ? 'negativo' : 'normal';
  const clases = formateado.negativo
    ? `${estilos.monto} ${estilos.negativo}`
    : estilos.monto;

  return (
    <span className={clases} data-estado={estado}>
      {codigoMoneda ? `${formateado.texto} ${codigoMoneda}` : formateado.texto}
    </span>
  );
}
