import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { TEXTOS_PLATAFORMA } from '@/features/plataforma/textos';
import { MarcaPlataforma } from './MarcaPlataforma';
import estilos from './EncabezadoPlataforma.module.css';

export interface EncabezadoPlataformaProps {
  /** Correo del dueño con sesión. */
  correo: string;
  /** Control de tema (contenedor): presentación no lo conoce. */
  controlTema: ReactNode;
  /** El cierre de sesión está en curso. */
  cerrando?: boolean;
  onCerrarSesion(): void;
}

/**
 * Encabezado de la pantalla interna: marca con el chip «Plataforma», control
 * de tema, correo del dueño y «Cerrar sesión». Es el único `banner`.
 */
export function EncabezadoPlataforma({
  correo,
  controlTema,
  cerrando = false,
  onCerrarSesion,
}: EncabezadoPlataformaProps) {
  return (
    <header className={estilos.encabezado}>
      <div className={estilos.marca}>
        <MarcaPlataforma />
      </div>
      <div className={estilos.tema}>{controlTema}</div>
      <span className={estilos.correo}>{correo}</span>
      <Button
        variante="secundario"
        disabled={cerrando}
        onClick={onCerrarSesion}
      >
        {TEXTOS_PLATAFORMA.cerrarSesion}
      </Button>
    </header>
  );
}
