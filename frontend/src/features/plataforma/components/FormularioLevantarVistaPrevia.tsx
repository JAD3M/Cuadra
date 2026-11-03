import { useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { TEXTOS_BANCOS } from '@/features/plataforma/textos';
import { Button } from '@/shared/ui/Button';
import estilos from './FormularioLevantarVistaPrevia.module.css';

export interface FormularioLevantarVistaPreviaProps {
  /** Nombre del banco tal como lo ve la persona (BBVA). */
  banco: string;
  /** Hay un envío en curso: se deshabilita y se anuncia. */
  pendiente: boolean;
  onConfirmar(): void;
  onCancelar(): void;
}

/**
 * Panel inline de confirmación (mockup `Plataforma.dc.html`): explica el
 * efecto y pide confirmar. No decide nada; el servidor vuelve a comprobar.
 */
export function FormularioLevantarVistaPrevia({
  banco,
  pendiente,
  onConfirmar,
  onCancelar,
}: FormularioLevantarVistaPreviaProps) {
  const refTitulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    refTitulo.current?.focus();
  }, []);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pendiente) return;
    onConfirmar();
  }

  return (
    <form
      method="post"
      noValidate
      aria-label={TEXTOS_BANCOS.boton}
      aria-busy={pendiente}
      className={estilos.formulario}
      onSubmit={enviar}
    >
      <h3 ref={refTitulo} tabIndex={-1} className={estilos.titulo}>
        {TEXTOS_BANCOS.confirmarTitulo(banco)}
      </h3>
      <p className={estilos.texto}>{TEXTOS_BANCOS.confirmarTexto(banco)}</p>
      <div className={estilos.acciones}>
        <Button type="submit" disabled={pendiente} className={estilos.accion}>
          {pendiente ? TEXTOS_BANCOS.levantando : TEXTOS_BANCOS.boton}
        </Button>
        <Button
          type="button"
          variante="secundario"
          className={estilos.accion}
          onClick={onCancelar}
        >
          {TEXTOS_BANCOS.cancelar}
        </Button>
      </div>
    </form>
  );
}
