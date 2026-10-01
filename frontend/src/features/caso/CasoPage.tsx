import { useParams } from 'react-router';
import { MarcadorPendiente } from '@/shared/ui/MarcadorPendiente';

/** Pantalla provisional: detalle de un caso. Muestra el `id` de la ruta. */
export function CasoPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <MarcadorPendiente titulo="Detalle del caso" nivel={2}>
      <p>
        Caso: <code>{id}</code>
      </p>
    </MarcadorPendiente>
  );
}
