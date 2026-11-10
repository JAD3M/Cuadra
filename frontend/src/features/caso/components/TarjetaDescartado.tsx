import { useId, type ReactNode, type Ref } from 'react';
import { Button } from '@/shared/ui/Button';
import { formatearDiaDeInstante } from '@/features/caso/fecha';
import { DESCARTADO } from '@/features/caso/textos';
import { AvisoInfo } from './AvisoInfo';
import comunes from './bloques.module.css';
import estilos from './TarjetaDescartado.module.css';

/** Lo que la tarjeta necesita del descarte; el del contrato la cumple. */
export interface DescarteMostrado {
  motivo: string;
  por: string | null;
  /** Instante ISO del descarte. */
  fecha: string | null;
  /** Lo decide el servidor: admin o quien descartó. */
  puedeDeshacer: boolean;
}

export interface TarjetaDescartadoProps {
  descarte: DescarteMostrado;
  /** Su rol tiene `movimientos.deshacer_descarte`: decide qué nota se muestra. */
  rolPuedeDeshacer: boolean;
  /** El deshacer viaja al servidor. */
  enviando: boolean;
  /** Bloquea el botón sin estar enviando (409, 404, caso desactualizado). */
  deshabilitado?: boolean;
  /** Alerta del fallo, antes de los botones. */
  alerta?: ReactNode;
  onDeshacer: () => void;
  /** Para mover el foco a la tarjeta cuando el descarte termina. */
  ref?: Ref<HTMLElement>;
}

/**
 * Variante de solo lectura de un movimiento descartado: motivo, quién y
 * cuándo. «Deshacer descarte» aparece solo si el servidor dice que quien mira
 * puede (`puedeDeshacer`); si no, una nota explica por qué, según su rol.
 */
export function TarjetaDescartado({
  descarte,
  rolPuedeDeshacer,
  enviando,
  deshabilitado = false,
  alerta,
  onDeshacer,
  ref,
}: TarjetaDescartadoProps) {
  const titulo = useId();
  return (
    <section
      ref={ref}
      tabIndex={-1}
      className={`${comunes.tarjeta} ${estilos.tarjeta}`}
      aria-labelledby={titulo}
    >
      <h3 id={titulo} className={comunes.rotulo}>
        {DESCARTADO.titulo}
      </h3>
      <p className={estilos.parrafo}>{DESCARTADO.principal}</p>
      <dl className={comunes.kv}>
        <div className={comunes.completa}>
          <dt>{DESCARTADO.motivo}</dt>
          <dd className={comunes.texto}>{descarte.motivo}</dd>
        </div>
        <div>
          <dt>{DESCARTADO.por}</dt>
          <dd className={comunes.texto}>
            {descarte.por ?? DESCARTADO.sinDato}
          </dd>
        </div>
        <div>
          <dt>{DESCARTADO.fecha}</dt>
          <dd className={comunes.mono}>
            {descarte.fecha === null
              ? DESCARTADO.sinDato
              : formatearDiaDeInstante(descarte.fecha)}
          </dd>
        </div>
      </dl>
      <span className={estilos.nota}>{DESCARTADO.nota}</span>
      {alerta}
      {descarte.puedeDeshacer ? (
        <div className={estilos.deshacer}>
          <Button
            variante="secundario"
            disabled={enviando || deshabilitado}
            onClick={onDeshacer}
          >
            {enviando ? DESCARTADO.deshaciendo : DESCARTADO.deshacer}
          </Button>
          <span className={estilos.ayuda}>{DESCARTADO.deshacerAyuda}</span>
        </div>
      ) : (
        <AvisoInfo
          texto={
            rolPuedeDeshacer
              ? DESCARTADO.soloAutorOAdmin
              : DESCARTADO.soloLecturaRol
          }
        />
      )}
    </section>
  );
}
