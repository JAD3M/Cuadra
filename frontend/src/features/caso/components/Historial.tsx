import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { ERROR_CONEXION, REINTENTAR } from '@/features/bandeja/textos';
import { HISTORIAL } from '@/features/caso/textos';
import { EventoHistorial, EventoPendiente } from './EventoHistorial';
import estilos from './Historial.module.css';

/** Lo que el historial necesita de cada evento; el del contrato la cumple. */
export interface EventoDeHistorial {
  id: string;
  accion: string;
  createdAt: string;
  usuario: { nombre: string } | null;
}

export interface HistorialProps {
  /** Eventos en el orden que devolvió el servidor (cronológico). */
  eventos: readonly EventoDeHistorial[];
  /** Etiqueta del CFDI de la propuesta, para su evento `crear`. */
  etiquetaCfdi: string | null;
  /** Agrega «Esperando decisión»: solo con el estado `sugerencia`. */
  pendiente: boolean;
  /** Se está pidiendo: no se afirma que esté vacío. */
  cargando?: boolean;
  /** La petición falló: error propio, el caso sigue usable. */
  fallo?: boolean;
  onReintentar?: () => void;
}

/**
 * «Historial» de la propuesta mostrada: acción, actor y hora de cada evento,
 * más la fila derivada «Esperando decisión» mientras nadie decide. Un fallo
 * del historial se queda aquí; nunca esconde el caso.
 */
export function Historial({
  eventos,
  etiquetaCfdi,
  pendiente,
  cargando = false,
  fallo = false,
  onReintentar,
}: HistorialProps) {
  const hayFilas = eventos.length > 0 || pendiente;
  return (
    <aside className={estilos.historial} aria-busy={cargando || undefined}>
      <h2 className={estilos.titulo}>{HISTORIAL.titulo}</h2>
      {fallo ? (
        <AlertaError
          titulo={ERROR_CONEXION.titulo}
          detalle={ERROR_CONEXION.detalle}
          accion={
            onReintentar ? (
              <Button variante="secundario" onClick={onReintentar}>
                {REINTENTAR}
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {!fallo && !cargando && !hayFilas ? (
        <span className={estilos.vacio}>{HISTORIAL.vacio}</span>
      ) : null}
      {!fallo && hayFilas ? (
        <ol className={estilos.lista}>
          {eventos.map((evento) => (
            <EventoHistorial
              key={evento.id}
              accion={evento.accion}
              usuario={evento.usuario}
              createdAt={evento.createdAt}
              etiquetaCfdi={etiquetaCfdi}
            />
          ))}
          {pendiente ? <EventoPendiente /> : null}
        </ol>
      ) : null}
    </aside>
  );
}
