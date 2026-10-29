import { Tabla, Td, Th } from '@/shared/ui/Tabla';
import { montoConSigno } from '@/features/vista-previa/dinero';
import { MOVIMIENTOS } from '@/features/vista-previa/textos';
import estilos from './TablaMovimientos.module.css';

/** Lo que la tabla necesita de un movimiento; el del contrato lo cumple. */
export interface FilaMovimiento {
  /** `YYYY-MM-DD`, tal como llega. */
  fecha: string;
  /** Decimal en cadena con signo, tal como lo envía la API. Nunca un `number`. */
  monto: string;
  referencia: string | null;
}

export interface TablaMovimientosProps {
  movimientos: readonly FilaMovimiento[];
}

const SIN_REFERENCIA = '—';

/**
 * Los movimientos leídos, en el orden del servidor. El monto lleva signo y
 * tono (verde abono, rojo cargo) y nunca se parte; sale del texto decimal sin
 * pasar por flotante. Una referencia nula va «—», atenuada.
 */
export function TablaMovimientos({ movimientos }: TablaMovimientosProps) {
  return (
    <section className={estilos.tarjeta}>
      <div className={estilos.cabecera}>
        <span className={estilos.rotulo}>{MOVIMIENTOS.titulo}</span>
        <span className={estilos.moneda}>{MOVIMIENTOS.moneda}</span>
      </div>
      <div className={estilos.cuerpo}>
        <Tabla titulo={MOVIMIENTOS.titulo}>
          <thead>
            <tr>
              <Th>{MOVIMIENTOS.fecha}</Th>
              <Th>{MOVIMIENTOS.referencia}</Th>
              <Th numerica>{MOVIMIENTOS.monto}</Th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m, i) => {
              const monto = montoConSigno(m.monto);
              return (
                <tr key={i}>
                  <Td className={estilos.fecha}>{m.fecha}</Td>
                  <Td
                    className={`${estilos.referencia} ${
                      m.referencia === null ? estilos.sinReferencia : ''
                    }`}
                  >
                    {m.referencia ?? SIN_REFERENCIA}
                  </Td>
                  <Td numerica>
                    <span className={estilos.monto} data-tipo={monto.tipo}>
                      {monto.texto}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Tabla>
      </div>
    </section>
  );
}
