import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Outlet, useLocation, useMatches } from 'react-router';
import { useSessionActions, useSessionContext } from '@/shared/sesion';
import { ControlTema } from '@/shared/tema';
import { tituloDeRuta } from '@/app/manejadorRuta';
import { Header } from './Header';
import { PENDIENTES_PLACEHOLDER } from './pendientesPlaceholder';
import { SesionNoDisponible } from './SesionNoDisponible';
import { Sidebar } from './Sidebar';
import estilos from './ShellLayout.module.css';

/**
 * Contenedor del aviso `unavailable`. Pide las acciones aquí y no en
 * `ShellLayout` para que la sesión provisional (sin acciones, siempre
 * `ready`) siga funcionando.
 */
function NoDisponible() {
  const { reintentarContexto, cerrarSesion } = useSessionActions();
  return (
    <SesionNoDisponible
      onReintentar={reintentarContexto}
      onCerrarSesion={cerrarSesion}
    />
  );
}

/**
 * Layout de las rutas internas (contenedor). Es el único consumidor de la
 * sesión: la convierte en props para las piezas de presentación.
 *
 * - `ready`: enlace de salto, barra lateral, encabezado y contenido.
 * - `loading`: estado neutro de carga, sin datos de identidad.
 * - `unavailable`: aviso de conexión con «Reintentar» y «Cerrar sesión».
 * - `anonymous`, `selecting`, `ended`: nada; la guarda `RutaProtegida` decide
 *   a dónde va el usuario.
 *
 * Por debajo de 900 px la barra lateral pasa a ser un panel que se abre con
 * el botón «Menú» (divulgación: `aria-expanded` y `aria-controls`). Se cierra
 * con Escape, al cambiar de ruta y al elegir un enlace.
 *
 * El título del documento lo pone `RutaRaiz`; aquí solo se muestra en el `h1`.
 */
export function ShellLayout() {
  const sesion = useSessionContext();
  const { pathname } = useLocation();
  const coincidencias = useMatches();
  const contenido = useRef<HTMLElement>(null);
  const botonMenu = useRef<HTMLButtonElement>(null);
  // Se guarda la ruta en la que se abrió el menú: al cambiar de ruta deja de
  // coincidir y el menú se cierra solo, sin efectos.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null);
  const menuAbierto = abiertoEn === pathname;

  switch (sesion.status) {
    case 'ready':
      break;
    case 'loading':
      return (
        <main id="contenido" aria-busy="true" className={estilos.estado}>
          <p>Cargando la sesión…</p>
        </main>
      );
    case 'unavailable':
      return <NoDisponible />;
    case 'anonymous':
    case 'selecting':
    case 'ended':
      // `RutaProtegida` ya redirigió (o, en un cambio de empresa, la pantalla
      // de elección ocupa su lugar): aquí no hay nada que mostrar.
      return null;
  }

  const { usuario, empresa, roles } = sesion.contexto;
  const titulo = tituloDeRuta(coincidencias.at(-1)?.handle) ?? 'Cuadra';

  // Un ancla `#contenido` basta para saltar, pero no siempre mueve el foco a
  // un elemento con tabindex=-1; se hace explícito.
  function saltarAlContenido(evento: MouseEvent<HTMLAnchorElement>) {
    evento.preventDefault();
    contenido.current?.focus();
  }

  function alTeclear(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== 'Escape' || !menuAbierto) return;
    setAbiertoEn(null);
    botonMenu.current?.focus();
  }

  // Elegir un enlace cierra el menú aunque sea la ruta actual.
  function alPulsarLateral(evento: MouseEvent<HTMLDivElement>) {
    if ((evento.target as Element).closest('a')) setAbiertoEn(null);
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
      <div className={estilos.shell} onKeyDown={alTeclear}>
        <div
          id="barra-lateral"
          className={estilos.lateral}
          data-abierto={menuAbierto}
          onClick={alPulsarLateral}
        >
          <Sidebar
            rutaActual={pathname}
            pendientes={PENDIENTES_PLACEHOLDER}
            usuario={usuario}
            roles={roles}
            controlTema={<ControlTema />}
          />
        </div>
        <div className={estilos.columna}>
          <Header
            titulo={titulo}
            empresa={empresa}
            barraMovil={
              <div className={estilos.barraMovil}>
                <span className={estilos.marcaMovil}>Cuadra</span>
                <button
                  ref={botonMenu}
                  type="button"
                  className={estilos.botonMenu}
                  aria-expanded={menuAbierto}
                  aria-controls="barra-lateral"
                  onClick={() => setAbiertoEn(menuAbierto ? null : pathname)}
                >
                  Menú
                </button>
              </div>
            }
          />
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
