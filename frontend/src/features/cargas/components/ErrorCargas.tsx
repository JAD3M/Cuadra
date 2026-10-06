import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import {
  ERROR_CONEXION,
  ERROR_SIN_PERMISO,
  REINTENTAR,
} from '@/features/cargas/textos';
import type { VistaHistorial } from '@/features/cargas/vista';
import estilos from './ErrorCargas.module.css';

export interface ErrorCargasProps {
  tipo: Extract<VistaHistorial, 'fallo' | 'sin_permiso'>;
  /** Ausente = sin reintento. Con `sin_permiso` nunca se ofrece: no ayudaría. */
  onReintentar?: () => void;
}

/**
 * Fallo de la lectura del historial, con el texto de la bandeja (M10). Nunca
 * muestra texto del servidor.
 */
export function ErrorCargas({ tipo, onReintentar }: ErrorCargasProps) {
  const texto = tipo === 'sin_permiso' ? ERROR_SIN_PERMISO : ERROR_CONEXION;
  const reintentable = tipo === 'fallo' && onReintentar !== undefined;
  return (
    <div className={estilos.margen}>
      <AlertaError
        titulo={texto.titulo}
        detalle={texto.detalle}
        accion={
          reintentable ? (
            <Button variante="secundario" onClick={onReintentar}>
              {REINTENTAR}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
