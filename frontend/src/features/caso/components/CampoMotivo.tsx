import { useId, type Ref } from 'react';
import { MOTIVO_MAXIMO } from '@/shared/dominio';
import { DECISION } from '@/features/caso/textos';
import { contarCaracteres } from '@/features/caso/motivo';
import estilos from './CampoMotivo.module.css';

export interface CampoMotivoProps {
  valor: string;
  onCambio: (texto: string) => void;
  /** El motivo excede el límite (o el servidor lo rechazó por largo). */
  invalido: boolean;
  deshabilitado: boolean;
  /** Para devolverle el foco cuando el envío se bloquea por exceso. */
  campoRef?: Ref<HTMLTextAreaElement>;
  /** Etiqueta del campo; por omisión la del rechazo. */
  etiqueta?: string;
  /** Texto de ejemplo del campo; por omisión el del rechazo. */
  ejemplo?: string;
  /** Mensaje cuando es inválido; por omisión el del límite de largo. */
  mensajeError?: string;
  /** El error se anuncia como alerta (descarte, motivo obligatorio). */
  anunciarError?: boolean;
}

/**
 * Motivo del rechazo, opcional, en línea dentro de la tarjeta de decisión. El
 * contador muestra el largo bruto; el error y el color de peligro salen de que
 * el motivo sea inválido. Sin `maxLength`: pegar de más debe poder verse.
 */
export function CampoMotivo({
  valor,
  onCambio,
  invalido,
  deshabilitado,
  campoRef,
  etiqueta = DECISION.motivoEtiqueta,
  ejemplo = DECISION.motivoEjemplo,
  mensajeError = DECISION.motivoLargo,
  anunciarError = false,
}: CampoMotivoProps) {
  const id = useId();
  const ayuda = `${id}-ayuda`;
  return (
    <div className={estilos.campo}>
      <label htmlFor={id} className={estilos.etiqueta}>
        {etiqueta}
      </label>
      <textarea
        id={id}
        ref={campoRef}
        className={estilos.control}
        value={valor}
        placeholder={ejemplo}
        disabled={deshabilitado}
        aria-invalid={invalido ? 'true' : undefined}
        aria-describedby={ayuda}
        onChange={(evento) => onCambio(evento.target.value)}
      />
      <div id={ayuda} className={estilos.ayuda}>
        {invalido ? (
          <span
            className={estilos.error}
            role={anunciarError ? 'alert' : undefined}
          >
            {mensajeError}
          </span>
        ) : null}
        <span
          className={`${estilos.contador} ${invalido ? estilos.contadorPeligro : ''}`}
        >
          {DECISION.contador(contarCaracteres(valor), MOTIVO_MAXIMO)}
        </span>
      </div>
    </div>
  );
}
