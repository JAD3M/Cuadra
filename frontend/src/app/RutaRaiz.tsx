import { useEffect } from 'react';
import { Outlet, useMatches } from 'react-router';
import { tituloDeRuta } from './manejadorRuta';

/**
 * Raíz del árbol de rutas. En cada cambio de ruta pone el título del
 * documento (`<titulo> · Cuadra`) y lo anuncia en una región `status` solo
 * para lectores de pantalla, de modo que el cambio de página no pase en
 * silencio. No declara landmarks.
 */
export function RutaRaiz() {
  const coincidencias = useMatches();
  const titulo = tituloDeRuta(coincidencias.at(-1)?.handle);

  useEffect(() => {
    if (titulo) document.title = `${titulo} · Cuadra`;
  }, [titulo]);

  return (
    <>
      <div role="status" className="solo-lectores">
        {titulo}
      </div>
      <Outlet />
    </>
  );
}
