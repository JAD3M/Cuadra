import { MarcadorPendiente } from '@/shared/ui/MarcadorPendiente';
import { HistorialCargas } from './components/HistorialCargas';
import { usePollingCargas } from './usePollingCargas';
import { estadoActualizacion, vistaHistorial } from './vista';

/**
 * Pantalla provisional de cargas: el marcador sigue hasta que llegue la
 * pantalla completa (S8) y debajo ya vive el historial con sus datos. Sin una
 * carga recién subida (`null`) la lista es lo único que se consulta.
 */
export function CargasPage() {
  const { lista, activo, capada, actualizar } = usePollingCargas(null);
  const vista = vistaHistorial(lista);
  return (
    <>
      <MarcadorPendiente titulo="Cargas" nivel={2} />
      <HistorialCargas
        vista={vista}
        cargas={lista.data?.datos ?? []}
        onReintentar={() => void lista.refetch()}
        actualizacion={estadoActualizacion({ vista, activo, capada })}
        onActualizar={actualizar}
      />
    </>
  );
}
