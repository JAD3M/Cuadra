import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { DESCARTE } from '@/features/caso/textos';
import { excedeLimite, motivoParaEnvio } from '@/features/caso/motivo';
import comunes from './bloques.module.css';
import { CampoMotivo } from './CampoMotivo';
import estilos from './DescartarMovimiento.module.css';

export interface DescartarMovimientoProps {
  /** El descarte viaja al servidor. */
  enviando: boolean;
  /** Bloquea el formulario sin estar enviando (409, 404, caso desactualizado). */
  deshabilitado?: boolean;
  /** Alerta del fallo, dentro de la tarjeta y antes de los botones. */
  alerta?: ReactNode;
  /** Motivo ya recortado y no vacío. */
  onDescartar: (motivo: string) => void;
  /** El formulario se abrió, se cerró o el motivo cambió: limpia el error. */
  onCambio?: () => void;
}

/**
 * Descartar un movimiento sin match: un botón secundario que abre en línea
 * una tarjeta con el motivo obligatorio. Valida en el navegador por
 * comodidad (vacío o más de 500); el servidor decide siempre. El texto vive
 * aquí y el contenedor lo remonta al cambiar de caso.
 */
export function DescartarMovimiento({
  enviando,
  deshabilitado = false,
  alerta,
  onDescartar,
  onCambio,
}: DescartarMovimientoProps) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [intentado, setIntentado] = useState(false);
  const titulo = useId();
  const campo = useRef<HTMLTextAreaElement>(null);
  const excede = excedeLimite(motivo);
  const vacio = intentado && motivoParaEnvio(motivo) === undefined;
  const bloqueado = enviando || deshabilitado;

  // Al abrir, el foco va al campo del motivo.
  useEffect(() => {
    if (abierto) campo.current?.focus();
  }, [abierto]);

  if (!abierto) {
    return (
      <div className={estilos.ayudaFila}>
        <Button
          variante="secundario"
          onClick={() => {
            setAbierto(true);
            onCambio?.();
          }}
        >
          {DESCARTE.accion}
        </Button>
        <span className={estilos.ayuda}>{DESCARTE.ayuda}</span>
      </div>
    );
  }

  function descartar() {
    const texto = motivoParaEnvio(motivo);
    if (texto === undefined || excede) {
      // Nada se envía: el error queda a la vista y el foco vuelve al campo.
      setIntentado(true);
      campo.current?.focus();
      return;
    }
    onDescartar(texto);
  }

  function cancelar() {
    setAbierto(false);
    setMotivo('');
    setIntentado(false);
    onCambio?.();
  }

  return (
    <section
      className={`${comunes.tarjeta} ${estilos.tarjeta}`}
      aria-labelledby={titulo}
    >
      <h3 id={titulo} className={`${comunes.rotulo} ${estilos.rotulo}`}>
        {DESCARTE.titulo}
      </h3>
      <CampoMotivo
        valor={motivo}
        onCambio={(texto) => {
          setMotivo(texto);
          onCambio?.();
        }}
        invalido={vacio || excede}
        deshabilitado={bloqueado}
        campoRef={campo}
        etiqueta={DESCARTE.motivoEtiqueta}
        ejemplo={DESCARTE.motivoEjemplo}
        mensajeError={
          excede ? DESCARTE.motivoLargo : DESCARTE.motivoObligatorio
        }
        anunciarError
      />
      {enviando ? (
        <span role="status" className="solo-lectores">
          {DESCARTE.enviando}
        </span>
      ) : null}
      {alerta}
      <div className={estilos.acciones}>
        <Button
          tono="sin_match"
          className={estilos.accion}
          disabled={bloqueado}
          onClick={descartar}
        >
          {enviando ? DESCARTE.descartando : DESCARTE.confirmar}
        </Button>
        <Button
          variante="secundario"
          className={estilos.accion}
          disabled={enviando}
          onClick={cancelar}
        >
          {DESCARTE.cancelar}
        </Button>
      </div>
      <span className={estilos.nota}>{DESCARTE.nota}</span>
    </section>
  );
}
