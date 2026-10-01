import { MemoryRouter } from 'react-router';
import { MuestraShell } from '@/app/MuestraShell';
import { KitPage } from '@/features/kit/KitPage';
import { ThemeProvider } from '@/shared/tema';

/*
 * TEMPORAL: montaje de la galería para ver la interfaz antes de que exista
 * el router. La rebanada 9 introduce el router y los proveedores reales;
 * la rebanada 11 mueve la galería a la ruta `/__kit`, solo en desarrollo.
 * Entonces este archivo y `MuestraShell` se reemplazan.
 */
export function App() {
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={['/bandeja']}>
        <KitPage muestraShell={<MuestraShell />} />
      </MemoryRouter>
    </ThemeProvider>
  );
}
