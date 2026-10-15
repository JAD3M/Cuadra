import type { IconoNav as Icono } from './navegacion';

/** Trazos de las maquetas (viewBox 24). */
const TRAZOS: Record<Icono, string[]> = {
  bandeja: ['M3 13h5l2 3h4l2-3h5', 'M5 5h14l2 8v6H3v-6z'],
  cargas: ['M12 16V4', 'M7 9l5-5 5 5', 'M4 20h16'],
  bitacora: ['M6 3h10l4 4v14H6z', 'M10 12h6M10 16h6'],
  tolerancia: ['M12 2v3M12 19v3M2 12h3M19 12h3'],
  usuarios: [
    'M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6',
    'M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2 .7 3.5 2.6 3.5 5.6',
  ],
};

/** Icono decorativo: oculto a tecnologías de asistencia. */
export function IconoNav({ icono }: { icono: Icono }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      focusable="false"
    >
      {icono === 'tolerancia' && <circle cx="12" cy="12" r="3" />}
      {icono === 'usuarios' && <circle cx="9" cy="8" r="3.5" />}
      {TRAZOS[icono].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
