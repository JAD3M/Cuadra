import { useRef, type MouseEvent } from 'react';
import { Outlet, useLocation, useMatches } from 'react-router';
import { useSessionContext } from '@/app/session';
import { ControlTema } from '@/shared/tema';
import { tituloDeRuta } from '@/app/manejadorRuta';
import { Header } from './Header';
import { PENDIENTES_PLACEHOLDER } from './pendientesPlaceholder';
import { Sidebar } from './Sidebar';
import estilos from './ShellLayout.module.css';

/**
 * Layout de las rutas internas (contenedor). Es el único consumidor de la
 * sesión: la convierte en props para las piezas de presentación.
 *
 * - `loading`: estado neutro de carga, sin datos de identidad.
 * - `ready`: enlace de salto, barra lateral, encabezado y contenido.
 * - `ended`: aviso neutro de sesión terminada. Es el punto de enganche de
 *   CU-21 (redirección a `/login`); aquí no se implementa ninguna.
 *
 * El título del documento lo pone `RutaRaiz`; aquí solo se muestra en el `h1`.
 */
export function ShellLayout() {
  const sesion = useSessionContext();
  const { pathname } = useLocation();
  const coincidencias = useMatches();
  const contenido = useRef<HTMLElement>(null);

  if (sesion.status === 'loading') {
    return (
      <main id="contenido" aria-busy="true" className={estilos.estado}>
        <p>Cargando la sesión…</p>
      </main>
    );
  }

  if (sesion.status === 'ended') {
    return (
      <main id="contenido" className={estilos.estado}>
        <p>La sesión terminó.</p>
      </main>
    );
  }

  const { usuario, empresa, roles } = sesion.contexto;
  const titulo = tituloDeRuta(coincidencias.at(-1)?.handle) ?? 'Cuadra';

  // Un ancla `#contenido` basta para saltar, pero no siempre mueve el foco a
  // un elemento con tabindex=-1; se hace explícito.
  function saltarAlContenido(evento: MouseEvent<HTMLAnchorElement>) {
    evento.preventDefault();
    contenido.current?.focus();
  }

  return (
    <>
      <a
        href="#contenido"
        className={estilos.saltar}
        onClick={saltarAlContenido}
      >
        Saltar al contenido
      </a>
      <div className={estilos.shell}>
        <Sidebar
          rutaActual={pathname}
          pendientes={PENDIENTES_PLACEHOLDER}
          usuario={usuario}
          roles={roles}
          controlTema={<ControlTema />}
        />
        <div className={estilos.columna}>
          <Header titulo={titulo} empresa={empresa} />
          <main
            id="contenido"
            tabIndex={-1}
            ref={contenido}
            className={estilos.contenido}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
