import { useId, type FormEvent, type Ref } from 'react';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import type { ClaseErrorGuardado } from '@/features/tolerancia/errores';
import {
  AYUDA_MISMO_VALOR,
  AYUDA_NORMAL,
  ERROR_GUARDADO,
  ETIQUETA_CAMPO,
  EXITO_GUARDADO,
  GUARDAR,
  GUARDANDO,
  GUARDANDO_ESTADO,
  MOTIVOS_INVALIDO,
} from '@/features/tolerancia/textos';
import type { MotivoInvalido } from '@/features/tolerancia/validarTolerancia';
import estilos from './FormularioTolerancia.module.css';

export interface FormularioToleranciaProps {
  /** Lo que muestra el campo; el contenedor decide si es el vigente o el borrador. */
  texto: string;
  /** Ayuda cuando no hay error: la normal o «es el valor actual». */
  ayuda: 'normal' | 'mismo_valor';
  /** Por qué el borrador no vale; `null` si vale. */
  invalido: MotivoInvalido | null;
  puedeGuardar: boolean;
  guardando: boolean;
  /** Se acaba de guardar: el mensaje de éxito va en la región de estado. */
  exito: boolean;
  /** Clase del último guardado fallido; nunca lleva texto del servidor. */
  fallo: ClaseErrorGuardado | null;
  onCambiar: (texto: string) => void;
  onGuardar: () => void;
  /** Para devolver el foco al campo tras guardar. */
  campoRef?: Ref<HTMLInputElement>;
  /** Para llevar el foco a la alerta cuando aparece. */
  alertaRef?: Ref<HTMLDivElement>;
}

const CLASE_DESCRIPCION = {
  error: `${estilos.descripcion} ${estilos.error}`,
  mismo_valor: `${estilos.descripcion} ${estilos.igual}`,
  normal: `${estilos.descripcion} ${estilos.ayuda}`,
} as const;

/**
 * Formulario de cambio de la tolerancia. Solo presentación: el texto, el estado
 * y los avisos llegan por props. El campo es de texto (`inputMode` decimal,
 * nunca `type="number"`): el valor viaja como cadena y lo valida el validador
 * de decimales, no el navegador. Un solo párrafo describe al campo y cambia
 * entre la ayuda, el «es el valor actual» y el error de validación (el mensaje
 * se lee al enfocar el campo; no se anuncia en cada tecla).
 */
export function FormularioTolerancia({
  texto,
  ayuda,
  invalido,
  puedeGuardar,
  guardando,
  exito,
  fallo,
  onCambiar,
  onGuardar,
  campoRef,
  alertaRef,
}: FormularioToleranciaProps) {
  const idCampo = useId();
  const idDescripcion = `${idCampo}-descripcion`;

  // Enter manda un submit aunque el botón esté deshabilitado: la puerta es esta.
  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (puedeGuardar && !guardando) onGuardar();
  };

  const variante = invalido !== null ? 'error' : ayuda;
  const mensaje =
    invalido !== null
      ? MOTIVOS_INVALIDO[invalido]
      : ayuda === 'mismo_valor'
        ? AYUDA_MISMO_VALOR
        : AYUDA_NORMAL;

  return (
    <form className={estilos.formulario} onSubmit={alEnviar} noValidate>
      <label htmlFor={idCampo} className={estilos.etiqueta}>
        {ETIQUETA_CAMPO}
      </label>
      <div className={estilos.fila}>
        <input
          ref={campoRef}
          id={idCampo}
          className={estilos.campo}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={texto}
          disabled={guardando}
          aria-invalid={invalido !== null}
          aria-describedby={idDescripcion}
          onChange={(evento) => onCambiar(evento.target.value)}
        />
        <Button
          type="submit"
          tono="sin_match"
          className={estilos.guardar}
          disabled={!puedeGuardar || guardando}
        >
          {guardando ? GUARDANDO : GUARDAR}
        </Button>
      </div>
      <p id={idDescripcion} className={CLASE_DESCRIPCION[variante]}>
        {mensaje}
      </p>
      <div role="status" className={estilos.region}>
        {guardando ? (
          <span className="solo-lectores">{GUARDANDO_ESTADO}</span>
        ) : null}
        {exito ? (
          <div className={estilos.exito}>
            <svg
              className={estilos.iconoExito}
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12l3 3 5-6" />
            </svg>
            <span>{EXITO_GUARDADO}</span>
          </div>
        ) : null}
      </div>
      {fallo !== null ? (
        <AlertaError ref={alertaRef} {...ERROR_GUARDADO[fallo]} />
      ) : null}
    </form>
  );
}
