import { useLocation } from 'react-router';
import { Card } from '@/shared/ui/Card';
import { ControlTema } from '@/shared/tema';
import { Header, PENDIENTES_PLACEHOLDER, Sidebar } from '@/app/shell';
import type { ContextoSesion } from '@/shared/api/contratos';
import estilos from './MuestraShell.module.css';

/** Datos de sesión de ejemplo, con la forma de `ContextoSesion`. */
const SESION_DE_EJEMPLO: ContextoSesion = {
  usuario: {
    id: '3f2b8a6e-6c1d-4a39-9d5e-0c1f7a1b2c3d',
    nombre: 'Luis Reyes',
    email: 'luis.reyes@despacho.mx',
  },
  empresa: {
    id: '7a1c9e52-0b34-4d6f-8e21-5c9d3b7a4f10',
    razonSocial: 'Ferretería del Bajío',
    rfc: 'FDB190215QK4',
  },
  roles: ['revisor', 'admin'],
};

/**
 * Ensambla las piezas del shell con datos de ejemplo para la galería. Solo
 * `Header` y `Sidebar`; el layout real llega con `ShellLayout`. No crea un
 * segundo `main`: el contenido es una región rotulada dentro de la página.
 */
export function MuestraShell() {
  const { pathname } = useLocation();
  return (
    <>
      <Sidebar
        rutaActual={pathname}
        pendientes={PENDIENTES_PLACEHOLDER}
        usuario={SESION_DE_EJEMPLO.usuario}
        roles={SESION_DE_EJEMPLO.roles}
        controlTema={<ControlTema />}
      />
      <div
        className={estilos.contenido}
        role="region"
        aria-label="Contenido de ejemplo"
      >
        <Header
          titulo="Bandeja de revisión"
          subtitulo="Movimientos abiertos, del monto más alto al más bajo"
          empresa={SESION_DE_EJEMPLO.empresa}
        />
        <Card>
          <p className={estilos.texto}>
            Área de contenido de la página. Los enlaces de la barra lateral
            cambian la ruta de esta muestra.
          </p>
        </Card>
      </div>
    </>
  );
}
