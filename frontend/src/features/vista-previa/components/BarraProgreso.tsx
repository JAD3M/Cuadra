import estilos from './BarraProgreso.module.css';

export interface BarraProgresoProps {
  /** Nombre accesible: qué se está haciendo. */
  nombre: string;
}

/** Barra indeterminada del mockup (`.pista`): no se sabe cuánto falta. */
export function BarraProgreso({ nombre }: BarraProgresoProps) {
  return (
    <div className={estilos.pista} role="progressbar" aria-label={nombre}>
      <div className={estilos.indicador} />
    </div>
  );
}
