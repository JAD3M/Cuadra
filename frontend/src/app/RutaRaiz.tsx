import { useEffect } from 'react';
import { Outlet, useMatches } from 'react-router';
import { tituloDeRuta, tituloDocumentoDeRuta } from './manejadorRuta';

/**
 * Raíz del árbol de rutas. En cada cambio de ruta pone el título del
 * documento (`<titulo> · Cuadra`, o el `tituloDocumento` de la ruta) y lo anuncia en una región `status` solo
 * para lectores de pantalla, de modo que el cambio de página no pase en
 * silencio. No declara landmarks.
 */
export function RutaRaiz() {
  const coincidencias = useMatches();
  const manejador = coincidencias.at(-1)?.handle;
  const titulo = tituloDeRuta(manejador);
  const tituloDocumento = tituloDocumentoDeRuta(manejador);

  useEffect(() => {
    if (tituloDocumento) document.title = tituloDocumento;
  }, [tituloDocumento]);

  return (
    <>
      <div role="status" className="solo-lectores">
        {titulo}
      </div>
      <Outlet />
    </>
  );
}
