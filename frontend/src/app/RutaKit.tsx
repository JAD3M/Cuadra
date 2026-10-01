import { KitPage } from '@/features/kit/KitPage';
import { MuestraShell } from './MuestraShell';

/**
 * Ruta `/__kit`, solo en desarrollo: la galería con la muestra del shell
 * ensamblada. Vive en `app` porque `features` no puede importar `app`.
 */
export function RutaKit() {
  return <KitPage muestraShell={<MuestraShell />} />;
}
