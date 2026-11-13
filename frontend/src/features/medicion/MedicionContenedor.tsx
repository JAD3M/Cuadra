import { AlertaError } from '@/shared/ui/AlertaError';
import { puede } from '@/shared/dominio';
import { useSessionContext } from '@/shared/sesion';
import { TarjetaComoSeCuenta } from './components/TarjetaComoSeCuenta';
import { TarjetaTasa } from './components/TarjetaTasa';
import estilos from './MedicionContenedor.module.css';
import { ERROR_SIN_PERMISO } from './textos';
import { useMedicion } from './useMedicion';
import { vistaMedicion } from './vista';

/**
 * Contenedor de la pantalla de Medición (historia 9.1): junta la sesión, la
 * lectura y la vista. Sin `medicion.ver` no pide nada y dice que no hay
 * permiso: el menú ya lo oculta y el servidor responde 403, esto cubre la ruta
 * directa. Las tarjetas solo reciben props.
 */
export function MedicionContenedor() {
  const sesion = useSessionContext();
  // La ruta ya exige sesión lista; si no lo está no hay capacidades que juzgar.
  const permitido =
    sesion.status === 'ready' &&
    puede(sesion.contexto.capacidades, 'medicion.ver');
  const medicion = useMedicion(permitido);

  if (!permitido) return <AlertaError {...ERROR_SIN_PERMISO} />;

  const vista = vistaMedicion({
    cargando: medicion.isPending,
    error: medicion.isError,
    datos: medicion.data,
  });
  return (
    <div className={estilos.contenedor}>
      <TarjetaTasa vista={vista} onReintentar={() => void medicion.refetch()} />
      <TarjetaComoSeCuenta />
    </div>
  );
}
