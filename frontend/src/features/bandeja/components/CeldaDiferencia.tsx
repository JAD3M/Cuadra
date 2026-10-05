import { clasificarDiferencia } from '@/shared/dinero';
import { Monto } from '@/shared/ui/Monto';
import { MENOR_A_UN_CENTAVO, SIN_DATO } from '@/features/bandeja/textos';
import estilos from './CeldaDiferencia.module.css';

export interface CeldaDiferenciaProps {
  /** Diferencia como decimal en cadena; `null` si no hay propuesta. */
  valor: string | null | undefined;
}

/**
 * Diferencia entre el movimiento y su CFDI. Cero queda atenuado; cualquier
 * otra diferencia se resalta. Una diferencia que se muestra como `$0.00`
 * pero no es cero (menos de medio centavo) se resalta y agrega un texto
 * oculto para que no se confunda con una coincidencia exacta.
 */
export function CeldaDiferencia({ valor }: CeldaDiferenciaProps) {
  const clase = clasificarDiferencia(valor);

  if (clase === 'sin_dato') {
    return (
      <span
        className={`${estilos.celda} ${estilos.atenuada}`}
        data-clase={clase}
      >
        {SIN_DATO}
      </span>
    );
  }

  const resaltada = clase !== 'cero';
  return (
    <span
      className={`${estilos.celda} ${resaltada ? estilos.resaltada : estilos.atenuada}`}
      data-clase={clase}
    >
      <Monto valor={valor} />
      {clase === 'subcentavo' ? (
        <span className="solo-lectores"> {MENOR_A_UN_CENTAVO}</span>
      ) : null}
    </span>
  );
}
