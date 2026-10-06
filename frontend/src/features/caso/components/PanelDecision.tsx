import { useId, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { DECISION } from '@/features/caso/textos';
import { excedeLimite, motivoParaEnvio } from '@/features/caso/motivo';
import comunes from './bloques.module.css';
import { CampoMotivo } from './CampoMotivo';
import estilos from './PanelDecision.module.css';

/** La acción que viaja al servidor, si hay una. */
export type AccionEnVuelo = 'confirmar' | 'rechazar';

export interface PanelDecisionProps {
  /** Etiqueta del CFDI de la propuesta expandida: va en el nombre accesible. */
  etiquetaCfdi: string;
  enviando: AccionEnVuelo | null;
  onConfirmar: () => void;
  /** Motivo ya recortado, o `undefined` si no escribió nada. */
  onRechazar: (motivo: string | undefined) => void;
}

/**
 * «Tu decisión»: confirmar con un clic (sin segundo paso ni diálogo) y
 * rechazar con un motivo opcional en línea. No sabe de roles: los controles
 * están siempre habilitados y el servidor decide. El texto del motivo vive
 * aquí; el contenedor remonta el panel al cambiar de propuesta para que un
 * motivo nunca viaje con otra.
 */
export function PanelDecision({
  etiquetaCfdi,
  enviando,
  onConfirmar,
  onRechazar,
}: PanelDecisionProps) {
  const [motivo, setMotivo] = useState('');
  const titulo = useId();
  const campo = useRef<HTMLTextAreaElement>(null);
  const excede = excedeLimite(motivo);
  const bloqueado = enviando !== null;

  function rechazar() {
    if (excede) {
      // Nada se envía: el error ya está a la vista y el foco vuelve al campo.
      campo.current?.focus();
      return;
    }
    onRechazar(motivoParaEnvio(motivo));
  }

  return (
    <section className={comunes.tarjeta} aria-labelledby={titulo}>
      <h2 id={titulo} className={comunes.rotulo}>
        {DECISION.titulo}
      </h2>
      <CampoMotivo
        valor={motivo}
        onCambio={setMotivo}
        invalido={excede}
        deshabilitado={bloqueado}
        campoRef={campo}
      />
      {enviando === null ? null : (
        <span role="status" className="solo-lectores">
          {DECISION.enviando}
        </span>
      )}
      <div className={estilos.acciones}>
        <Button
          tono="conciliado"
          className={estilos.accion}
          disabled={bloqueado}
          onClick={onConfirmar}
        >
          <span aria-hidden="true">{DECISION.glifoConfirmar}</span>{' '}
          {enviando === 'confirmar' ? DECISION.confirmando : DECISION.confirmar}{' '}
          <span className="solo-lectores">{etiquetaCfdi}</span>
        </Button>
        <Button
          variante="peligro"
          className={estilos.accion}
          disabled={bloqueado}
          onClick={rechazar}
        >
          <span aria-hidden="true">{DECISION.glifoRechazar}</span>{' '}
          {enviando === 'rechazar' ? DECISION.rechazando : DECISION.rechazar}{' '}
          <span className="solo-lectores">{etiquetaCfdi}</span>
        </Button>
      </div>
      <span className={estilos.aviso}>{DECISION.soloProponen}</span>
    </section>
  );
}
