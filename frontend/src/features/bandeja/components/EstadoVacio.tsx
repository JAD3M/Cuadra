import { Button } from '@/shared/ui/Button';
import {
  VACIO_CON_FILTROS,
  VACIO_POR_DEFECTO,
} from '@/features/bandeja/textos';
import estilos from './EstadoVacio.module.css';

export interface EstadoVacioProps {
  /** Hay filtros distintos de los de por defecto: se ofrece restablecerlos. */
  conFiltros: boolean;
  onRestablecer: () => void;
}

/** La lista respondió sin movimientos. Sin filtros no hay nada que restablecer. */
export function EstadoVacio({ conFiltros, onRestablecer }: EstadoVacioProps) {
  const copia = conFiltros ? VACIO_CON_FILTROS : VACIO_POR_DEFECTO;
  return (
    <div className={estilos.vacio}>
      <strong className={estilos.titulo}>{copia.titulo}</strong>
      <span className={estilos.detalle}>{copia.detalle}</span>
      {conFiltros ? (
        <Button variante="secundario" onClick={onRestablecer}>
          {VACIO_CON_FILTROS.accion}
        </Button>
      ) : null}
    </div>
  );
}
