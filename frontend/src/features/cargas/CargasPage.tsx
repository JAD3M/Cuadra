import { MarcadorPendiente } from '@/shared/ui/MarcadorPendiente';
import { HistorialCargas } from './components/HistorialCargas';
import { usePollingCargas } from './usePollingCargas';
import { vistaHistorial } from './vista';

/**
 * Pantalla provisional de cargas: el marcador sigue hasta que llegue la
 * pantalla completa (S8) y debajo ya vive el historial con sus datos. Sin una
 * carga recién subida (`null`) la lista es lo único que se consulta.
 */
export function CargasPage() {
  const { lista } = usePollingCargas(null);
  return (
    <>
      <MarcadorPendiente titulo="Cargas" nivel={2} />
      <HistorialCargas
        vista={vistaHistorial(lista)}
        cargas={lista.data?.datos ?? []}
        onReintentar={() => void lista.refetch()}
      />
    </>
  );
}
