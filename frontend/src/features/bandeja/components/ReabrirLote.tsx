import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { CampoMotivo } from '@/features/caso/components/CampoMotivo';
import { excedeLimite, motivoParaEnvio } from '@/features/caso/motivo';
import { REABRIR_LOTE } from '@/features/bandeja/textos';
import estilos from './ReabrirLote.module.css';

export interface ReabrirLoteProps {
  /** La reapertura viaja al servidor. */
  enviando: boolean;
  /** Motivo ya recortado y no vacío. */
  onReabrir: (motivo: string) => void;
}

/**
 * Reabrir el lote recién confirmado (mockups 2 y 7): un botón secundario que
 * abre, dentro del recuadro del resultado, el formulario con el motivo
 * obligatorio. Valida en el navegador por comodidad (vacío o más de 500); el
 * servidor decide siempre. Presentacional salvo el borrador del motivo.
 */
export function ReabrirLote({ enviando, onReabrir }: ReabrirLoteProps) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [intentado, setIntentado] = useState(false);
  const titulo = useId();
  const campo = useRef<HTMLTextAreaElement>(null);
  const excede = excedeLimite(motivo);
  const vacio = intentado && motivoParaEnvio(motivo) === undefined;

  // Al abrir, el foco va al campo del motivo.
  useEffect(() => {
    if (abierto) campo.current?.focus();
  }, [abierto]);

  if (!abierto) {
    return (
      <div className={estilos.fila}>
        <Button variante="secundario" onClick={() => setAbierto(true)}>
          {REABRIR_LOTE.accion}
        </Button>
        <span className={estilos.ayuda}>{REABRIR_LOTE.ayuda}</span>
      </div>
    );
  }

  function reabrir() {
    const texto = motivoParaEnvio(motivo);
    if (texto === undefined || excede) {
      // Nada se envía: el error queda a la vista y el foco vuelve al campo.
      setIntentado(true);
      campo.current?.focus();
      return;
    }
    onReabrir(texto);
  }

  function cancelar() {
    setAbierto(false);
    setMotivo('');
    setIntentado(false);
  }

  return (
    <section className={estilos.formulario} aria-labelledby={titulo}>
      <strong id={titulo}>{REABRIR_LOTE.titulo}</strong>
      <CampoMotivo
        valor={motivo}
        onCambio={setMotivo}
        invalido={vacio || excede}
        deshabilitado={enviando}
        campoRef={campo}
        etiqueta={REABRIR_LOTE.motivoEtiqueta}
        ejemplo={REABRIR_LOTE.motivoEjemplo}
        mensajeError={
          excede ? REABRIR_LOTE.motivoLargo : REABRIR_LOTE.motivoObligatorio
        }
        anunciarError
      />
      {enviando ? (
        <span role="status" className="solo-lectores">
          {REABRIR_LOTE.enviando}
        </span>
      ) : null}
      <div className={estilos.acciones}>
        <Button tono="sin_match" disabled={enviando} onClick={reabrir}>
          {enviando ? REABRIR_LOTE.reabriendo : REABRIR_LOTE.confirmar}
        </Button>
        <Button variante="secundario" disabled={enviando} onClick={cancelar}>
          {REABRIR_LOTE.cancelar}
        </Button>
      </div>
      <span className={estilos.ayuda}>{REABRIR_LOTE.nota}</span>
    </section>
  );
}
