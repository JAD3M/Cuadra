import { TEXTOS_MEDICION_PLATAFORMA as T } from '@/features/plataforma/textos';
import estilos from './MedicionPlataforma.module.css';

/** Aviso informativo: ninguna empresa tiene propuestas todavía. */
export function AvisoSinDatos() {
  return (
    <div className={estilos.aviso} role="status">
      <div className={estilos.avisoTexto}>
        <strong>{T.sinDatosTitulo}</strong>
        <span className={estilos.avisoDetalle}>{T.sinDatosDetalle}</span>
      </div>
    </div>
  );
}
