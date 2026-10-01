import { Outlet } from 'react-router';

/**
 * PROVISIONAL: layout mínimo de las rutas internas. Solo aporta el `main` de
 * la página; la barra lateral, el encabezado y la sesión llegan con
 * `ShellLayout`, que reemplaza este archivo.
 */
export function LayoutStub() {
  return (
    <main id="contenido" tabIndex={-1}>
      <Outlet />
    </main>
  );
}
