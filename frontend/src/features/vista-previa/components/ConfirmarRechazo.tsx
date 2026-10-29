import { useEffect, useId, useRef } from 'react';
import { Button } from '@/shared/ui/Button';
import { CONFIRMAR_RECHAZO } from '@/features/vista-previa/textos';
import estilos from './ConfirmarRechazo.module.css';

export interface ConfirmarRechazoProps {
  /** Cuántos movimientos se descartarían. */
  total: number;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Confirmación de rechazar (`role="alertdialog"`): descarta movimientos, así
 * que pide una segunda decisión. Al aparecer recibe el foco para que se anuncie
 * y el teclado quede dentro.
 */
export function ConfirmarRechazo({
  total,
  onConfirmar,
  onCancelar,
}: ConfirmarRechazoProps) {
  const idTitulo = useId();
  const idDetalle = useId();
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    raiz.current?.focus();
  }, []);
  return (
    <div
      ref={raiz}
      role="alertdialog"
      aria-labelledby={idTitulo}
      aria-describedby={idDetalle}
      tabIndex={-1}
      className={estilos.dialogo}
    >
      <div className={estilos.texto}>
        <strong id={idTitulo} className={estilos.titulo}>
          {CONFIRMAR_RECHAZO.titulo}
        </strong>
        <span id={idDetalle} className={estilos.detalle}>
          {CONFIRMAR_RECHAZO.detalle(total)}
        </span>
      </div>
      <div className={estilos.botones}>
        <Button variante="peligro" onClick={onConfirmar}>
          {CONFIRMAR_RECHAZO.confirmar}
        </Button>
        <Button variante="secundario" onClick={onCancelar}>
          {CONFIRMAR_RECHAZO.cancelar}
        </Button>
      </div>
    </div>
  );
}
