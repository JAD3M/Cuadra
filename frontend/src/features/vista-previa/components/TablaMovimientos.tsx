import type { ClaseVistaPrevia } from '@/shared/dominio';
import { EstadoChip, type TonoEstadoChip } from '@/shared/ui/EstadoChip';
import { Tabla, Td, Th } from '@/shared/ui/Tabla';
import { montoConSigno } from '@/features/vista-previa/dinero';
import { ESTADO_MOVIMIENTO, MOVIMIENTOS } from '@/features/vista-previa/textos';
import estilos from './TablaMovimientos.module.css';

/** Lo que la tabla necesita de un movimiento; el del contrato lo cumple. */
export interface FilaMovimiento {
  /** `YYYY-MM-DD`, tal como llega. */
  fecha: string;
  /** Decimal en cadena con signo, tal como lo envía la API. Nunca un `number`. */
  monto: string;
  referencia: string | null;
  /** Qué pasará con él al aceptar; lo dice el servidor. */
  clase: ClaseVistaPrevia;
}

/** Verde entra, gris se omite, ámbar va a revisión: el texto siempre acompaña. */
const TONO_CLASE: Readonly<Record<ClaseVistaPrevia, TonoEstadoChip>> = {
  nuevo: 'conciliado',
  existente: 'neutral',
  dudoso: 'sin_match',
};

export interface TablaMovimientosProps {
  movimientos: readonly FilaMovimiento[];
}

const SIN_REFERENCIA = '—';

/**
 * Los movimientos leídos, en el orden del servidor. El monto lleva signo y
 * tono (verde abono, rojo cargo) y nunca se parte; sale del texto decimal sin
 * pasar por flotante. Una referencia nula va «—», atenuada. La columna Estado
 * dice qué pasará con cada fila (historia 3.5); las que ya existen se atenúan.
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
              <Th>{MOVIMIENTOS.estado}</Th>
              <Th numerica>{MOVIMIENTOS.monto}</Th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m, i) => {
              const monto = montoConSigno(m.monto);
              return (
                <tr key={i} data-clase={m.clase} className={estilos.fila}>
                  <Td className={estilos.fecha}>{m.fecha}</Td>
                  <Td
                    className={`${estilos.referencia} ${
                      m.referencia === null ? estilos.sinReferencia : ''
                    }`}
                  >
                    {m.referencia ?? SIN_REFERENCIA}
                  </Td>
                  <Td>
                    <EstadoChip tono={TONO_CLASE[m.clase]}>
                      {ESTADO_MOVIMIENTO[m.clase]}
                    </EstadoChip>
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
