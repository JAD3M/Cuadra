import { useState, type ReactNode } from 'react';
import {
  useAccionesPlataforma,
  useSesionPlataforma,
} from '@/shared/sesion/plataforma';
import { ControlTema } from '@/shared/tema';
import { EncabezadoPlataforma } from './components/EncabezadoPlataforma';
import { NavegacionPlataforma } from './components/NavegacionPlataforma';
import estilos from './MarcoPlataforma.module.css';

/**
 * Marco compartido de las pantallas internas del dueño: encabezado con
 * pestañas, tema y cierre de sesión, y el `main` donde va cada pantalla. Sin
 * sesión lista no pinta nada (la guarda de ruta ya se ocupa de redirigir).
 */
export function MarcoPlataforma({ children }: { children: ReactNode }) {
  const sesion = useSesionPlataforma();
  const { cerrarSesion } = useAccionesPlataforma();
  const [cerrando, setCerrando] = useState(false);

  if (sesion.status !== 'ready') return null;

  return (
    <div className={estilos.pagina}>
      <EncabezadoPlataforma
        correo={sesion.usuario.correo}
        controlTema={<ControlTema />}
        navegacion={<NavegacionPlataforma />}
        cerrando={cerrando}
        onCerrarSesion={() => {
          setCerrando(true);
          void cerrarSesion();
        }}
      />
      <main className={estilos.principal}>{children}</main>
    </div>
  );
}
