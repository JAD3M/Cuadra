import { Button } from '@/shared/ui/Button';
import estilos from './SesionNoDisponible.module.css';

export interface SesionNoDisponibleProps {
  onReintentar: () => void;
  onCerrarSesion: () => void;
}

/**
 * La primera consulta del contexto falló por un motivo que no es de
 * autorización (red, 5xx, respuesta inválida). No hay identidad que mostrar:
 * solo se ofrece reintentar o cerrar la sesión. Presentacional: el contenedor
 * (`ShellLayout`) le pasa las acciones.
 */
export function SesionNoDisponible({
  onReintentar,
  onCerrarSesion,
}: SesionNoDisponibleProps) {
  return (
    <main id="contenido" className={estilos.estado}>
      <div role="alert" className={estilos.aviso}>
        <p className={estilos.texto}>
          No se pudo conectar con el servidor. Inténtalo de nuevo.
        </p>
        <div className={estilos.acciones}>
          <Button onClick={onReintentar}>Reintentar</Button>
          <Button variante="secundario" onClick={onCerrarSesion}>
            Cerrar sesión
          </Button>
        </div>
      </div>
    </main>
  );
}
