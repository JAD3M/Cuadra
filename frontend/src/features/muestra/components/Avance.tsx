import type { RespuestaMuestra } from '@/features/muestra/tipos';
import { porcentaje } from '@/features/muestra/formato';
import { AVANCE } from '@/features/muestra/textos';
import estilos from './Avance.module.css';
import { IconoCheck } from './iconos';

export interface AvanceProps {
  avance: RespuestaMuestra['avance'];
  /** «septiembre 2026», para el aviso de muestra completa. */
  mes: string;
}

/** Tarjeta «Avance»: barra, tres cifras y el aviso de muestra completa. */
export function Avance({ avance, mes }: AvanceProps) {
  const verificados = avance.conformes + avance.desacuerdos;
  const texto = AVANCE.verificados(verificados, avance.total);
  const completa = avance.pendientes === 0 && avance.total > 0;
  return (
    <section className={estilos.tarjeta} aria-labelledby="muestra-avance-t">
      <div className={estilos.cabecera}>
        <h2 id="muestra-avance-t" className={estilos.rotulo}>
          {AVANCE.titulo}
        </h2>
        <span className={estilos.resumen}>
          <span className={estilos.cifra}>{texto.cifras}</span>
          {texto.resto}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={AVANCE.barra}
        aria-valuemin={0}
        aria-valuemax={avance.total}
        aria-valuenow={verificados}
        className={estilos.barra}
      >
        <div
          className={estilos.relleno}
          style={{ inlineSize: `${porcentaje(verificados, avance.total)}%` }}
        />
      </div>
      <div className={estilos.datos}>
        <div className={estilos.dato}>
          <span className={estilos.rotulo}>{AVANCE.conformes}</span>
          <span className={`${estilos.valor} ${estilos.conforme}`}>
            {avance.conformes}
          </span>
        </div>
        <div className={estilos.dato}>
          <span className={estilos.rotulo}>{AVANCE.desacuerdos}</span>
          <span className={`${estilos.valor} ${estilos.desacuerdo}`}>
            {avance.desacuerdos}
          </span>
        </div>
        <div className={estilos.dato}>
          <span className={estilos.rotulo}>{AVANCE.pendientes}</span>
          <span className={estilos.valor}>{avance.pendientes}</span>
        </div>
      </div>
      {completa ? (
        <div className={estilos.completa} role="status">
          <IconoCheck className={estilos.completaIcono} />
          <span>{AVANCE.completa(mes)}</span>
        </div>
      ) : null}
    </section>
  );
}
