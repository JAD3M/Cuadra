import type { ConteoClases } from '@/shared/dominio';
import { QUE_PASARA } from '@/features/vista-previa/textos';
import { AvisoInformativo } from './AvisoInformativo';
import estilos from './QuePasaraAlAceptar.module.css';

export interface QuePasaraAlAceptarProps {
  conteo: ConteoClases;
}

/**
 * «Qué pasará al aceptar» (historia 3.5): cuántos movimientos son nuevos, ya
 * existen o son dudosos. Con dudosos, un aviso ámbar; si no hay nada nuevo ni
 * dudoso, una caja informativa. Los números son conteos que dice el servidor.
 */
export function QuePasaraAlAceptar({ conteo }: QuePasaraAlAceptarProps) {
  const { nuevos, existentes, dudosos } = conteo;
  return (
    <div className={estilos.bloque}>
      <div className={estilos.cabecera}>
        <span className={estilos.rotulo}>{QUE_PASARA.rotulo}</span>
        <span className={estilos.texto}>{QUE_PASARA.resumen(conteo)}</span>
      </div>
      <div className={estilos.cifras}>
        <div className={estilos.dato}>
          <span className={estilos.pista}>{QUE_PASARA.nuevos}</span>
          <span className={`${estilos.cifra} ${estilos.nuevos}`}>{nuevos}</span>
        </div>
        <div className={estilos.dato}>
          <span className={estilos.pista}>{QUE_PASARA.existentes}</span>
          <span className={`${estilos.cifra} ${estilos.existentes}`}>
            {existentes}
          </span>
        </div>
        <div className={estilos.dato}>
          <span className={estilos.pista}>{QUE_PASARA.dudosos}</span>
          <span className={`${estilos.cifra} ${estilos.dudosos}`}>
            {dudosos}
          </span>
        </div>
      </div>
      {dudosos > 0 ? (
        <div role="status" className={estilos.aviso}>
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
            <path d="M12 3l10 18H2z" />
            <path d="M12 10v5M12 17.5v.5" />
          </svg>
          <div className={estilos.avisoTexto}>
            <strong>{QUE_PASARA.tituloDudosos(dudosos)}</strong>
            <span>{QUE_PASARA.detalleDudosos}</span>
          </div>
        </div>
      ) : null}
      {nuevos === 0 && dudosos === 0 ? (
        <AvisoInformativo>
          <span>{QUE_PASARA.todoExistente}</span>
        </AvisoInformativo>
      ) : null}
    </div>
  );
}
