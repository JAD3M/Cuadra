import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { TEXTOS_ALTA_EMPRESA } from '@/features/plataforma/textos';
import { Button } from '@/shared/ui/Button';
import { Campo } from '@/shared/ui/Campo';
import estilos from './FormularioCrearEmpresa.module.css';

export interface ValoresCrearEmpresa {
  razonSocial: string;
  /** Tal como lo escribió la persona; el contenedor lo normaliza. */
  rfc: string;
}

export interface FormularioCrearEmpresaProps {
  /** Hay un alta en curso: el envío se deshabilita y se anuncia. */
  pendiente: boolean;
  /** Corrección bajo el campo de razón social (ya en texto de usuario). */
  errorRazonSocial?: string;
  /** Corrección bajo el campo RFC (ya en texto de usuario). */
  errorRfc?: string;
  onEnviar(valores: ValoresCrearEmpresa): void;
  onCancelar(): void;
}

/**
 * Panel inline «Nueva empresa» (mockup `Plataforma.dc.html`). Solo comprueba
 * que los dos campos no estén vacíos; el formato del RFC lo decide el servidor
 * y su motivo llega por `errorRfc`. Conserva lo escrito tras un fallo.
 */
export function FormularioCrearEmpresa({
  pendiente,
  errorRazonSocial,
  errorRfc,
  onEnviar,
  onCancelar,
}: FormularioCrearEmpresaProps) {
  const [razonSocial, setRazonSocial] = useState('');
  const [rfc, setRfc] = useState('');
  const [vacios, setVacios] = useState<{ razon: boolean; rfc: boolean }>({
    razon: false,
    rfc: false,
  });
  const refRazon = useRef<HTMLInputElement>(null);
  const refRfc = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refRazon.current?.focus();
  }, []);

  // Un fallo bajo un campo lleva el foco a ese campo.
  useEffect(() => {
    if (errorRfc) refRfc.current?.focus();
    else if (errorRazonSocial) refRazon.current?.focus();
  }, [errorRfc, errorRazonSocial]);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pendiente) return;
    const faltaRazon = razonSocial.trim() === '';
    const faltaRfc = rfc.trim() === '';
    setVacios({ razon: faltaRazon, rfc: faltaRfc });
    if (faltaRazon) refRazon.current?.focus();
    else if (faltaRfc) refRfc.current?.focus();
    if (faltaRazon || faltaRfc) return;
    onEnviar({ razonSocial, rfc });
  }

  const mensajeRazon =
    errorRazonSocial ??
    (vacios.razon && razonSocial.trim() === ''
      ? TEXTOS_ALTA_EMPRESA.razonVacia
      : undefined);
  const mensajeRfc =
    errorRfc ??
    (vacios.rfc && rfc.trim() === ''
      ? TEXTOS_ALTA_EMPRESA.rfcVacio
      : undefined);

  return (
    <form
      method="post"
      noValidate
      aria-label={TEXTOS_ALTA_EMPRESA.crear}
      aria-busy={pendiente}
      className={estilos.formulario}
      onSubmit={enviar}
    >
      <h2 className={estilos.titulo}>{TEXTOS_ALTA_EMPRESA.titulo}</h2>
      <div className={estilos.campos}>
        <Campo
          ref={refRazon}
          etiqueta={TEXTOS_ALTA_EMPRESA.etiquetaRazonSocial}
          type="text"
          autoComplete="organization"
          value={razonSocial}
          onChange={(e) => setRazonSocial(e.target.value)}
          error={mensajeRazon}
        />
        <Campo
          ref={refRfc}
          etiqueta={TEXTOS_ALTA_EMPRESA.etiquetaRfc}
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className={estilos.rfc}
          value={rfc}
          onChange={(e) => setRfc(e.target.value)}
          ayuda={mensajeRfc ? undefined : TEXTOS_ALTA_EMPRESA.ayudaRfc}
          error={mensajeRfc}
        />
      </div>
      <div className={estilos.acciones}>
        <Button type="submit" disabled={pendiente} className={estilos.accion}>
          {pendiente ? TEXTOS_ALTA_EMPRESA.creando : TEXTOS_ALTA_EMPRESA.crear}
        </Button>
        <Button
          type="button"
          variante="secundario"
          className={estilos.accion}
          onClick={onCancelar}
        >
          {TEXTOS_ALTA_EMPRESA.cancelar}
        </Button>
      </div>
    </form>
  );
}
