import type { ReactNode } from 'react';
import estilos from './MarcadorPendiente.module.css';

export interface MarcadorPendienteProps {
  /** Nombre de la pantalla; es el encabezado del marcador. */
  titulo: string;
  /**
   * Nivel del encabezado. Fuera del shell la página no tiene otro título, así
   * que usa 1; dentro del shell el `Header` ya aporta el h1 y usa 2.
   */
  nivel?: 1 | 2;
  /** Dato adicional de la pantalla (por ejemplo, el id de la ruta). */
  children?: ReactNode;
}

/**
 * Marca honesta de una pantalla que aún no existe: nombre y aviso, sin datos
 * inventados. Solo presentación.
 */
export function MarcadorPendiente({
  titulo,
  nivel = 1,
  children,
}: MarcadorPendienteProps) {
  const Encabezado = nivel === 1 ? 'h1' : 'h2';
  return (
    <section className={estilos.marcador}>
      <Encabezado className={estilos.titulo}>{titulo}</Encabezado>
      <p className={estilos.aviso}>
        Pantalla en construcción. Esta sección todavía no está disponible.
      </p>
      {children}
    </section>
  );
}
