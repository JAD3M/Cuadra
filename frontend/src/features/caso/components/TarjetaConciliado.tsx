import { useId } from 'react';
import { CONCILIADO } from '@/features/caso/textos';
import { formatearDiaDeInstante } from '@/features/caso/fecha';
import comunes from './bloques.module.css';
import estilos from './TarjetaConciliado.module.css';

export interface TarjetaConciliadoProps {
  /** Nombre de quien confirmó; `null` si el servidor no lo devolvió. */
  usuario: string | null;
  /** Instante ISO de la confirmación; `null` si el servidor no lo devolvió. */
  confirmadaAt: string | null;
}

/**
 * Variante de solo lectura de un caso ya confirmado: quién y cuándo (el día en
 * la zona del navegador, como en la maqueta). Sin controles de decisión: la
 * decide el estado del servidor, nunca el rol de quien mira.
 */
export function TarjetaConciliado({
  usuario,
  confirmadaAt,
}: TarjetaConciliadoProps) {
  const titulo = useId();
  const fecha =
    confirmadaAt === null ? null : formatearDiaDeInstante(confirmadaAt);
  const confirmado =
    usuario === null && fecha === null
      ? null
      : CONCILIADO.confirmado(usuario, fecha);
  return (
    <section
      className={`${comunes.tarjeta} ${estilos.tarjeta}`}
      aria-labelledby={titulo}
    >
      <h3 id={titulo} className={`${comunes.rotulo} ${estilos.rotulo}`}>
        {CONCILIADO.titulo}
      </h3>
      {confirmado === null ? null : (
        <p className={estilos.parrafo}>{confirmado}</p>
      )}
      <span className={estilos.nota}>{CONCILIADO.cerrado}</span>
    </section>
  );
}
