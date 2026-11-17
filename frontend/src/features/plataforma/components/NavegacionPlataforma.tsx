import { NavLink } from 'react-router';
import { TEXTOS_MEDICION_PLATAFORMA } from '@/features/plataforma/textos';
import estilos from './NavegacionPlataforma.module.css';

/**
 * Pestañas de la cabecera del dueño: «Empresas y bancos» y «Medición». La
 * activa lleva `aria-current="page"` (lo pone `NavLink`); `end` evita que
 * `/plataforma` quede activa también dentro de `/plataforma/medicion`.
 */
export function NavegacionPlataforma() {
  return (
    <nav
      aria-label={TEXTOS_MEDICION_PLATAFORMA.navegacion}
      className={estilos.navegacion}
    >
      <NavLink to="/plataforma" end className={estilos.pestana}>
        {TEXTOS_MEDICION_PLATAFORMA.pestanaEmpresas}
      </NavLink>
      <NavLink to="/plataforma/medicion" className={estilos.pestana}>
        {TEXTOS_MEDICION_PLATAFORMA.pestanaMedicion}
      </NavLink>
    </nav>
  );
}
