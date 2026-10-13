import { TEXTOS_PLATAFORMA } from '@/features/plataforma/textos';
import { MarcaPlataforma } from './MarcaPlataforma';
import estilos from './PanelMarcaPlataforma.module.css';

/**
 * Panel de marca del acceso de plataforma. Como el de empresa, el titular es
 * un párrafo: el panel se oculta en pantallas angostas y el único `h1` de la
 * página es el del formulario. No lleva contadores ni datos de empresas.
 */
export function PanelMarcaPlataforma() {
  return (
    <div className={estilos.panel}>
      <MarcaPlataforma tamano="grande" />
      <div className={estilos.mensaje}>
        <p className={estilos.titular}>{TEXTOS_PLATAFORMA.titularPanel}</p>
        <p className={estilos.apoyo}>{TEXTOS_PLATAFORMA.apoyoPanel}</p>
      </div>
    </div>
  );
}
