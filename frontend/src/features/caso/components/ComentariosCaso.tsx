import { useId, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { formatearInstante } from '@/features/caso/fecha';
import {
  COMENTARIO_MAXIMO,
  excedeLimite,
  motivoParaEnvio,
} from '@/features/caso/motivo';
import { COMENTARIOS } from '@/features/caso/textos';
import { AvisoInfo } from './AvisoInfo';
import comunes from './bloques.module.css';
import { CampoMotivo } from './CampoMotivo';
import estilos from './ComentariosCaso.module.css';

export interface ComentarioVisible {
  id: string;
  por: string;
  /** Instante ISO. */
  fecha: string;
  texto: string;
}

export interface ComentariosCasoProps {
  /** Del más antiguo al más reciente, como los manda el servidor. */
  comentarios: readonly ComentarioVisible[];
  /** Lo decide el servidor: sin él no hay campo, solo la nota de solo lectura. */
  puedeComentar: boolean;
  /** El comentario viaja al servidor. */
  enviando: boolean;
  /** El último envío salió bien: el campo se vacía. */
  enviado: boolean;
  /** Alerta del fallo, junto al botón. */
  alerta?: ReactNode;
  /** Texto ya recortado y no vacío. */
  onComentar: (texto: string) => void;
  /** El texto cambió: limpia el error del envío. */
  onCambio?: () => void;
}

/**
 * Comentarios del caso: la lista de lo que ya se dijo y, si el servidor lo
 * permite, el formulario para dejar uno. Valida en el navegador por comodidad
 * (vacío o más de 1000); el servidor decide siempre. El contenedor lo remonta
 * al cambiar de decisión.
 */
export function ComentariosCaso({
  comentarios,
  puedeComentar,
  enviando,
  enviado,
  alerta,
  onComentar,
  onCambio,
}: ComentariosCasoProps) {
  const [texto, setTexto] = useState('');
  const [intentado, setIntentado] = useState(false);
  const titulo = useId();
  const campo = useRef<HTMLTextAreaElement>(null);
  const excede = excedeLimite(texto, COMENTARIO_MAXIMO);
  const vacio = intentado && motivoParaEnvio(texto) === undefined;

  // El envío salió bien: el campo queda listo para otro comentario. Se ajusta
  // durante el render, al pasar `enviado` a verdadero, y no en un efecto.
  const [yaEnviado, setYaEnviado] = useState(enviado);
  if (enviado !== yaEnviado) {
    setYaEnviado(enviado);
    if (enviado) {
      setTexto('');
      setIntentado(false);
    }
  }

  function comentar() {
    const limpio = motivoParaEnvio(texto);
    if (limpio === undefined || excede) {
      // Nada se envía: el error queda a la vista y el foco vuelve al campo.
      setIntentado(true);
      campo.current?.focus();
      return;
    }
    onComentar(limpio);
  }

  return (
    <section className={comunes.tarjeta} aria-labelledby={titulo}>
      <h3 id={titulo} className={comunes.rotulo}>
        {COMENTARIOS.titulo}
      </h3>
      {comentarios.length === 0 ? (
        <span className={estilos.vacio}>{COMENTARIOS.vacio}</span>
      ) : (
        <ul className={estilos.lista}>
          {comentarios.map((c) => (
            <li key={c.id} className={estilos.comentario}>
              <div className={estilos.cabecera}>
                <strong className={estilos.autor}>{c.por}</strong>
                <span className={estilos.fecha}>
                  {formatearInstante(c.fecha)}
                </span>
              </div>
              <span className={estilos.texto}>{c.texto}</span>
            </li>
          ))}
        </ul>
      )}
      {puedeComentar ? (
        <div className={estilos.formulario}>
          <CampoMotivo
            valor={texto}
            onCambio={(nuevo) => {
              setTexto(nuevo);
              onCambio?.();
            }}
            invalido={vacio || excede}
            deshabilitado={enviando}
            campoRef={campo}
            etiqueta={COMENTARIOS.etiqueta}
            ejemplo={COMENTARIOS.ejemplo}
            mensajeError={excede ? COMENTARIOS.largo : COMENTARIOS.obligatorio}
            maximo={COMENTARIO_MAXIMO}
            anunciarError
          />
          {enviando ? (
            <span role="status" className="solo-lectores">
              {COMENTARIOS.enviando}
            </span>
          ) : null}
          {alerta}
          <div className={estilos.acciones}>
            <Button
              variante="secundario"
              className={estilos.boton}
              disabled={enviando}
              onClick={comentar}
            >
              {enviando ? COMENTARIOS.comentando : COMENTARIOS.accion}
            </Button>
            <span className={estilos.ayuda}>{COMENTARIOS.ayuda}</span>
          </div>
        </div>
      ) : (
        <AvisoInfo texto={COMENTARIOS.soloLectura} />
      )}
    </section>
  );
}
