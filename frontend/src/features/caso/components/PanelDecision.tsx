import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  ACCION_CONFIRMAR,
  ACCION_RECHAZAR,
  type AccionResolucion,
} from '@/shared/dominio';
import { Button } from '@/shared/ui/Button';
import { DECISION } from '@/features/caso/textos';
import { excedeLimite, motivoParaEnvio } from '@/features/caso/motivo';
import comunes from './bloques.module.css';
import { CampoMotivo } from './CampoMotivo';
import estilos from './PanelDecision.module.css';

/** La acción que viaja al servidor, si hay una. */
export type AccionEnVuelo = AccionResolucion;

export interface PanelDecisionProps {
  /** Etiqueta del CFDI de la propuesta expandida: va en el nombre accesible. */
  etiquetaCfdi: string;
  enviando: AccionEnVuelo | null;
  onConfirmar: () => void;
  /** Motivo ya recortado, o `undefined` si no escribió nada. */
  onRechazar: (motivo: string | undefined) => void;
  /** Alerta del fallo de la acción, dentro de la tarjeta y antes de los botones. */
  alerta?: ReactNode;
  /** Bloquea botones y campo sin estar enviando (409, 404, caso desactualizado). */
  deshabilitado?: boolean;
  /** El servidor rechazó el motivo por largo (400): se marca el campo y se enfoca. */
  motivoLargoServidor?: boolean;
  /** El motivo cambió: el contenedor limpia el 400 del servidor. */
  onEditarMotivo?: () => void;
  /** Texto con el que arranca el campo (la galería muestra el exceso de largo). */
  motivoInicial?: string;
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
  alerta,
  deshabilitado = false,
  motivoLargoServidor = false,
  onEditarMotivo,
  motivoInicial = '',
}: PanelDecisionProps) {
  const [motivo, setMotivo] = useState(motivoInicial);
  const titulo = useId();
  const campo = useRef<HTMLTextAreaElement>(null);
  const excede = excedeLimite(motivo);
  const bloqueado = enviando !== null || deshabilitado;

  useEffect(() => {
    if (motivoLargoServidor) campo.current?.focus();
  }, [motivoLargoServidor]);

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
        onCambio={(texto) => {
          setMotivo(texto);
          onEditarMotivo?.();
        }}
        invalido={excede || motivoLargoServidor}
        deshabilitado={bloqueado}
        campoRef={campo}
      />
      {enviando === null ? null : (
        <span role="status" className="solo-lectores">
          {DECISION.enviando}
        </span>
      )}
      {alerta}
      <div className={estilos.acciones}>
        <Button
          tono="conciliado"
          className={estilos.accion}
          disabled={bloqueado}
          onClick={onConfirmar}
        >
          <span aria-hidden="true">{DECISION.glifoConfirmar}</span>{' '}
          {enviando === ACCION_CONFIRMAR
            ? DECISION.confirmando
            : DECISION.confirmar}{' '}
          <span className="solo-lectores">{etiquetaCfdi}</span>
        </Button>
        <Button
          variante="peligro"
          className={estilos.accion}
          disabled={bloqueado}
          onClick={rechazar}
        >
          <span aria-hidden="true">{DECISION.glifoRechazar}</span>{' '}
          {enviando === ACCION_RECHAZAR
            ? DECISION.rechazando
            : DECISION.rechazar}{' '}
          <span className="solo-lectores">{etiquetaCfdi}</span>
        </Button>
      </div>
      <span className={estilos.aviso}>{DECISION.soloProponen}</span>
    </section>
  );
}
