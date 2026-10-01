import { OPCIONES_TEMA } from './opcionesTema';
import { SelectorTema } from './SelectorTema';
import { useTema } from './useTema';

/**
 * Contenedor del control de tema: conecta `SelectorTema` con `useTema()`.
 * Marca la preferencia guardada (con `system` queda marcada "Sistema", no el
 * tema resuelto) y guarda la elección al hacer clic.
 */
export function ControlTema() {
  const { preferencia, setPreferencia } = useTema();
  return (
    <SelectorTema
      valor={preferencia}
      opciones={OPCIONES_TEMA}
      onCambiar={setPreferencia}
    />
  );
}
