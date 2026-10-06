import { Button } from '@/shared/ui/Button';
import { Monto } from '@/shared/ui/Monto';
import { MONEDA_BASE } from '@/features/bandeja/constantes';
import { etiquetaCfdi } from '@/features/bandeja/etiquetaCfdi';
import { PROPUESTAS } from '@/features/caso/textos';
import estilos from './FilaPropuesta.module.css';

/** Lo que la fila necesita de una propuesta colapsada. */
export interface PropuestaFila {
  conciliacionId: string;
  regla: string | null;
  cfdi: {
    uuidFiscal: string;
    serie: string | null;
    folio: string | null;
    nombreEmisor: string | null;
    total: string;
    moneda: string;
  };
}

export interface FilaPropuestaProps {
  propuesta: PropuestaFila;
  /** Expande esta propuesta: pide su `conciliacionId`. */
  onSeleccionar: (conciliacionId: string) => void;
}

/**
 * Propuesta colapsada: etiqueta del CFDI, emisor, total y regla (como en la
 * maqueta). El botón dice «Ver propuesta» y su nombre accesible agrega la
 * etiqueta del CFDI al final, de modo que contiene el texto visible.
 */
export function FilaPropuesta({
  propuesta,
  onSeleccionar,
}: FilaPropuestaProps) {
  const etiqueta = etiquetaCfdi(propuesta.cfdi);
  const { cfdi } = propuesta;
  return (
    <li className={estilos.fila}>
      <div className={estilos.datos}>
        <span className={estilos.folio}>{etiqueta}</span>
        {cfdi.nombreEmisor === null ? null : (
          <span className={estilos.emisor}>{cfdi.nombreEmisor}</span>
        )}
        <span className={estilos.total}>
          <Monto
            valor={cfdi.total}
            codigoMoneda={cfdi.moneda === MONEDA_BASE ? undefined : cfdi.moneda}
          />
        </span>
        {propuesta.regla === null ? null : (
          <span className={estilos.regla}>{propuesta.regla}</span>
        )}
      </div>
      <Button
        variante="fantasma"
        className={estilos.ver}
        aria-expanded="false"
        onClick={() => onSeleccionar(propuesta.conciliacionId)}
      >
        {PROPUESTAS.verPropuesta}{' '}
        <span className="solo-lectores">{etiqueta}</span>
      </Button>
    </li>
  );
}
