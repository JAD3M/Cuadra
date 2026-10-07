import { CARGA_FALLIDA } from '@/features/cargas/textos';
import { ETIQUETAS_ESTADO_CARGA } from '@/shared/dominio';
import { EstadoChip } from '@/shared/ui/EstadoChip';
import { TONO_ESTADO_CARGA } from '@/features/cargas/tonos';
import estilos from './ResultadoFallido.module.css';

/**
 * La carga falló (mockup v27): el chip Fallida sobre el aviso fijo, con su
 * icono. Sin el mensaje del servidor (el backend escribe siempre uno fijo, así
 * que repetiría el aviso) y sin lista de archivos. No abre un `role="alert"`
 * propio: anidaría una región viva dentro de la región de estado de la tarjeta,
 * que ya lo anuncia.
 */
export function ResultadoFallido() {
  return (
    <div className={estilos.fallido}>
      <svg
        className={estilos.icono}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16.5v.5" />
      </svg>
      <div className={estilos.texto}>
        <EstadoChip tono={TONO_ESTADO_CARGA.fallida}>
          {ETIQUETAS_ESTADO_CARGA.fallida}
        </EstadoChip>
        <span className={estilos.aviso}>{CARGA_FALLIDA}</span>
      </div>
    </div>
  );
}
