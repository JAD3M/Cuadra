import { useId, useState } from 'react';
import { Campo, type CampoProps } from './Campo';
import estilos from './CampoContrasena.module.css';

export const TEXTOS_CONTRASENA = {
  mostrar: 'Mostrar',
  ocultar: 'Ocultar',
  etiquetaMostrar: 'Mostrar contraseña',
  etiquetaOcultar: 'Ocultar contraseña',
} as const;

export type CampoContrasenaProps = Omit<CampoProps, 'type' | 'accion'>;

/**
 * `Campo` de contraseña con un botón para mostrarla u ocultarla (mockup
 * `Main.dc.html`). Solo cambia el `type` del control: el valor sigue en el
 * nodo del DOM y no se copia a ningún estado.
 */
export function CampoContrasena({ id, ...resto }: CampoContrasenaProps) {
  const idGenerado = useId();
  const idControl = id ?? idGenerado;
  const [visible, setVisible] = useState(false);

  return (
    <Campo
      {...resto}
      id={idControl}
      type={visible ? 'text' : 'password'}
      accion={
        <button
          type="button"
          className={estilos.boton}
          aria-controls={idControl}
          aria-pressed={visible}
          aria-label={
            visible
              ? TEXTOS_CONTRASENA.etiquetaOcultar
              : TEXTOS_CONTRASENA.etiquetaMostrar
          }
          onClick={() => setVisible((actual) => !actual)}
        >
          {visible ? TEXTOS_CONTRASENA.ocultar : TEXTOS_CONTRASENA.mostrar}
        </button>
      }
    />
  );
}
