import { useId } from 'react';
import { InsigniaIa } from '@/features/bandeja/components/InsigniaIa';
import { insigniaIa } from '@/features/bandeja/ia';
import { MOTOR } from '@/features/caso/textos';
import comunes from './bloques.module.css';
import estilos from './TarjetaMotor.module.css';

export interface TarjetaMotorProps {
  /** Código de la regla tal como lo envía el servidor; se muestra verbatim. */
  regla: string | null;
  /** Motivo del servidor, verbatim. */
  motivo: string | null;
}

/**
 * «Por qué el motor lo propone»: regla y motivo tal cual, con la insignia de
 * IA solo para `llm_sugerencia` («simulada» solo con el prefijo completo al
 * inicio del motivo) y el recordatorio de que solo una persona cierra un caso.
 */
export function TarjetaMotor({ regla, motivo }: TarjetaMotorProps) {
  const titulo = useId();
  const insignia = insigniaIa(regla, motivo);
  return (
    <section className={comunes.tarjeta} aria-labelledby={titulo}>
      <h3 id={titulo} className={comunes.rotulo}>
        {MOTOR.titulo}
      </h3>
      {regla === null && insignia === null ? null : (
        <div className={estilos.cabecera}>
          {regla === null ? null : (
            <span className={estilos.regla}>{regla}</span>
          )}
          {insignia === null ? null : (
            <InsigniaIa simulada={insignia === 'ia_simulada'} />
          )}
        </div>
      )}
      {motivo === null ? null : <p className={estilos.motivo}>{motivo}</p>}
      <span className={estilos.aviso}>{MOTOR.soloProponen}</span>
    </section>
  );
}
