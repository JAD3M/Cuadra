import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { REINTENTAR } from '@/features/bandeja/textos';
import estilos from './ErrorBandeja.module.css';

export interface ErrorBandejaProps {
  titulo: string;
  detalle?: string;
  /** Ausente = sin reintento (p. ej. falta de permiso: reintentar no ayuda). */
  onReintentar?: () => void;
  /** Rótulo de la acción; por omisión «Reintentar». */
  textoAccion?: string;
}

/** Fallo de la lista: la alerta compartida con su acción de reintento. */
export function ErrorBandeja({
  titulo,
  detalle,
  onReintentar,
  textoAccion = REINTENTAR,
}: ErrorBandejaProps) {
  return (
    <div className={estilos.margen}>
      <AlertaError
        titulo={titulo}
        detalle={detalle}
        accion={
          onReintentar ? (
            <Button variante="secundario" onClick={onReintentar}>
              {textoAccion}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
