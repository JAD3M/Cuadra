import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import type { ClaseErrorBitacora } from '@/features/bitacora/errores';
import {
  ERROR_CONEXION,
  ERROR_OTRO,
  ERROR_SIN_PERMISO,
  REINTENTAR,
  VACIO,
  VACIO_CON_FILTROS,
} from '@/features/bitacora/textos';
import estilos from './EstadosBitacora.module.css';

export interface VacioBitacoraProps {
  /** Hay algún filtro activo: se ofrece restablecerlos. */
  conFiltros: boolean;
  onRestablecer: () => void;
}

/** La lista respondió sin eventos. Sin filtros no hay nada que restablecer. */
export function VacioBitacora({
  conFiltros,
  onRestablecer,
}: VacioBitacoraProps) {
  const copia = conFiltros ? VACIO_CON_FILTROS : VACIO;
  return (
    <div className={estilos.vacio}>
      <strong className={estilos.titulo}>{copia.titulo}</strong>
      <span className={estilos.detalle}>{copia.detalle}</span>
      {conFiltros ? (
        <Button variante="secundario" onClick={onRestablecer}>
          {VACIO_CON_FILTROS.accion}
        </Button>
      ) : null}
    </div>
  );
}

const COPIA_ERROR: Record<
  ClaseErrorBitacora,
  { titulo: string; detalle?: string }
> = {
  conexion: ERROR_CONEXION,
  sin_permiso: ERROR_SIN_PERMISO,
  otro: ERROR_OTRO,
};

export interface ErrorBitacoraProps {
  clase: ClaseErrorBitacora;
  /** Sin permiso nunca ofrece reintento: no ayudaría. */
  onReintentar: () => void;
}

/** Fallo de la lista con copy fijo por clase (Bitacora.dc.html). */
export function ErrorBitacora({ clase, onReintentar }: ErrorBitacoraProps) {
  const { titulo, detalle } = COPIA_ERROR[clase];
  return (
    <div className={estilos.margen}>
      <AlertaError
        titulo={titulo}
        detalle={detalle}
        accion={
          clase === 'sin_permiso' ? undefined : (
            <Button variante="secundario" onClick={onReintentar}>
              {REINTENTAR}
            </Button>
          )
        }
      />
    </div>
  );
}
