import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { MOTIVO_RECHAZO_MAXIMO } from '@/features/vista-previa/constantes';
import { CONFIRMAR_RECHAZO } from '@/features/vista-previa/textos';
import estilos from './ConfirmarRechazo.module.css';

export interface ConfirmarRechazoProps {
  /** Cuántos movimientos se descartarían. */
  total: number;
  /** `motivo` solo viene si la persona escribió algo (recortado). */
  onConfirmar: (motivo?: string) => void;
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
  const idMotivo = useId();
  const idAyuda = useId();
  const [motivo, setMotivo] = useState('');
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
      <div className={estilos.campo}>
        <label htmlFor={idMotivo} className={estilos.etiqueta}>
          {CONFIRMAR_RECHAZO.motivoEtiqueta}
        </label>
        <textarea
          id={idMotivo}
          className={estilos.control}
          rows={3}
          maxLength={MOTIVO_RECHAZO_MAXIMO}
          value={motivo}
          aria-describedby={idAyuda}
          onChange={(evento) => setMotivo(evento.target.value)}
        />
        <span id={idAyuda} className={estilos.ayuda}>
          {CONFIRMAR_RECHAZO.motivoAyuda}
        </span>
      </div>
      <div className={estilos.botones}>
        <Button
          variante="peligro"
          onClick={() => {
            const limpio = motivo.trim();
            onConfirmar(limpio === '' ? undefined : limpio);
          }}
        >
          {CONFIRMAR_RECHAZO.confirmar}
        </Button>
        <Button variante="secundario" onClick={onCancelar}>
          {CONFIRMAR_RECHAZO.cancelar}
        </Button>
      </div>
    </div>
  );
}
