import { useId } from 'react';
import { pareceCuentaCompleta } from '@/features/cargas/cuenta';
import {
  AVISO_CUENTA_COMPLETA,
  AYUDA_CUENTA,
  TARJETA_ESTADO_CUENTA,
} from '@/features/cargas/textos';
import { LIMITES_CARGA } from '@/shared/dominio';
import estilos from './campos.module.css';

export interface CampoCuentaProps {
  valor: string;
  onCambiar: (valor: string) => void;
  deshabilitado?: boolean;
}

/**
 * Campo de cuenta. Pide solo los últimos dígitos y, si lo escrito parece el
 * número completo, lo dice sin bloquear nada (K4, M5). El texto de las ayudas
 * es fijo: el valor escrito nunca se repite fuera del input, ni en un aviso ni
 * en un `title`.
 */
export function CampoCuenta({
  valor,
  onCambiar,
  deshabilitado = false,
}: CampoCuentaProps) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idAviso = `${id}-aviso`;
  const completa = pareceCuentaCompleta(valor);
  return (
    <div className={estilos.campo}>
      <label htmlFor={id} className={estilos.etiqueta}>
        {TARJETA_ESTADO_CUENTA.cuenta}
      </label>
      <input
        id={id}
        className={`${estilos.control} ${estilos.mono}`}
        value={valor}
        placeholder={TARJETA_ESTADO_CUENTA.marcaCuenta}
        maxLength={LIMITES_CARGA.estadoCuenta.maxCuenta}
        disabled={deshabilitado}
        aria-describedby={completa ? `${idAyuda} ${idAviso}` : idAyuda}
        onChange={(e) => onCambiar(e.target.value)}
      />
      <p id={idAyuda} className={estilos.ayuda}>
        {AYUDA_CUENTA}
      </p>
      {completa ? (
        <p id={idAviso} className={estilos.aviso}>
          {AVISO_CUENTA_COMPLETA}
        </p>
      ) : null}
    </div>
  );
}
