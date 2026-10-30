import type { Ref } from 'react';
import type { ConteoClases } from '@/shared/dominio';
import { Button } from '@/shared/ui/Button';
import { ACCIONES } from '@/features/vista-previa/textos';
import { BarraProgreso } from './BarraProgreso';
import estilos from './AccionesVistaPrevia.module.css';

export interface AccionesVistaPreviaProps {
  /** Qué se está enviando; `null` si nada. Apaga ambos botones. */
  ocupado: 'aceptar' | 'rechazar' | null;
  /** Lo que la lectura clasificó: de aquí sale la pista bajo el botón. */
  conteo: ConteoClases;
  onAceptar: () => void;
  /** Pide la confirmación; el rechazo real lo envía `ConfirmarRechazo`. */
  onRechazar: () => void;
  /** Para devolver el foco aquí al cancelar la confirmación. */
  rechazarRef?: Ref<HTMLButtonElement>;
}

/**
 * «Aceptar e importar» y «Rechazar». Mientras algo está en vuelo los dos se
 * apagan y aparece la barra: una sola decisión a la vez.
 */
export function AccionesVistaPrevia({
  ocupado,
  conteo,
  onAceptar,
  onRechazar,
  rechazarRef,
}: AccionesVistaPreviaProps) {
  const apagado = ocupado !== null;
  return (
    <div className={estilos.acciones}>
      <div className={estilos.botones}>
        <Button disabled={apagado} onClick={onAceptar}>
          {ocupado === 'aceptar' ? ACCIONES.aceptando : ACCIONES.aceptar}
        </Button>
        <Button
          ref={rechazarRef}
          variante="secundario"
          disabled={apagado}
          onClick={onRechazar}
        >
          {ocupado === 'rechazar' ? ACCIONES.rechazando : ACCIONES.rechazar}
        </Button>
      </div>
      {ocupado === null ? null : (
        <BarraProgreso
          nombre={
            ocupado === 'aceptar'
              ? ACCIONES.progresoAceptar
              : ACCIONES.progresoRechazar
          }
        />
      )}
      <span className={estilos.pista}>{ACCIONES.pista(conteo)}</span>
    </div>
  );
}
