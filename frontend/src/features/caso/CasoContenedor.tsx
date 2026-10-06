import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { REGLA_REFERENCIA_MONTO_EXACTO } from '@/shared/dominio';
import { etiquetaCfdi } from '@/features/bandeja/etiquetaCfdi';
import { useEpoca } from '@/features/bandeja/useEpoca';
import { AlertaAccion } from './components/AlertaAccion';
import { AvisoVarias } from './components/AvisoVarias';
import { BloqueMovimiento } from './components/BloqueMovimiento';
import { DetallePropuesta } from './components/DetallePropuesta';
import { EncabezadoCaso } from './components/EncabezadoCaso';
import { EnlaceBandeja } from './components/EnlaceBandeja';
import { ErrorCaso } from './components/ErrorCaso';
import { EstadoCargaCaso } from './components/EstadoCargaCaso';
import { Historial } from './components/Historial';
import { ListaPropuestas } from './components/ListaPropuestas';
import { PanelDecision } from './components/PanelDecision';
import { TarjetaConciliado } from './components/TarjetaConciliado';
import { TarjetaSinMatch } from './components/TarjetaSinMatch';
import estilos from './CasoContenedor.module.css';
import { clavesCaso } from './claves';
import { clasificarErrorAccion } from './errores';
import { PROPUESTAS, VOLVER_A_BANDEJA } from './textos';
import { useCaso } from './useCaso';
import { useHistorial } from './useHistorial';
import { useResolverCaso } from './useResolverCaso';
import { derivarVista, propuestaSeleccionada, vistaDeLectura } from './vista';

export interface CasoContenedorProps {
  movimientoId: string;
}

/**
 * Contenedor del detalle: lee el caso, deriva la vista del estado que devolvió
 * el servidor y compone los componentes de presentación. Por ahora cubre la
 * carga, las variantes con propuestas, las de solo lectura, el historial y la
 * decisión (confirmar y rechazar siempre actúan sobre la propuesta expandida);
 * los errores y los banners se agregan por rebanadas.
 */
export function CasoContenedor({ movimientoId }: CasoContenedorProps) {
  const consulta = useCaso(movimientoId);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const caso = consulta.data;
  const expandida =
    caso === undefined
      ? null
      : propuestaSeleccionada(caso.propuestas, seleccion);
  // El historial es el de la propuesta mostrada; un sin_match no tiene.
  const historial = useHistorial(expandida?.conciliacionId ?? null);
  const resolucion = useResolverCaso();
  const cliente = useQueryClient();
  const epoca = useEpoca();
  const alertaRef = useRef<HTMLDivElement>(null);
  const enviando =
    resolucion.isPending && resolucion.variables !== undefined
      ? resolucion.variables.accion
      : null;
  // Un fallo solo se muestra en la época en la que se activó la acción.
  const errorAccion =
    resolucion.isError &&
    resolucion.variables !== undefined &&
    resolucion.variables.epoca === epoca
      ? clasificarErrorAccion(resolucion.error, resolucion.variables.accion)
      : null;
  const conAlerta = errorAccion !== null && errorAccion !== 'motivo_largo';

  // Tras un fallo el foco va a la alerta; el 400 lo lleva el propio campo.
  useEffect(() => {
    if (conAlerta) alertaRef.current?.focus();
  }, [conAlerta, errorAccion]);

  /** «Recargar caso» (409): solo al hacer clic; pide el caso y su historial. */
  async function recargar() {
    resolucion.reset();
    await cliente.invalidateQueries({ queryKey: clavesCaso.todas(epoca) });
  }

  const lectura = vistaDeLectura(consulta);
  if (lectura !== null) {
    return (
      <div className={estilos.pagina}>
        <EnlaceBandeja texto={VOLVER_A_BANDEJA} variante="atras" />
        {lectura === 'cargando' ? (
          <EstadoCargaCaso />
        ) : (
          <ErrorCaso
            tipo={lectura === 'error' ? 'conexion' : lectura}
            onReintentar={() => void consulta.refetch()}
          />
        )}
      </div>
    );
  }
  if (caso === undefined) return null;

  const vista = derivarVista(caso);
  const conPropuestas = vista === 'sugerencia' || vista === 'varias';

  return (
    <div className={estilos.pagina}>
      <EncabezadoCaso
        estado={caso.estado}
        regla={expandida?.regla ?? null}
        origen={expandida?.origen ?? null}
        descripcion={caso.movimiento.descripcion}
      />
      <div className={estilos.columnas}>
        <div className={estilos.principal}>
          <BloqueMovimiento
            fecha={caso.movimiento.fecha}
            descripcion={caso.movimiento.descripcion}
            referencia={caso.movimiento.referencia}
            monto={caso.movimiento.monto}
            moneda={caso.movimiento.moneda}
            referenciaCoincide={
              expandida?.regla === REGLA_REFERENCIA_MONTO_EXACTO
            }
          />
          {conPropuestas && expandida !== null ? (
            <div className={estilos.propuestas}>
              <h2 className={estilos.titulo}>{PROPUESTAS.titulo}</h2>
              <AvisoVarias cantidad={caso.propuestas.length} />
              <DetallePropuesta
                propuesta={expandida}
                toleranciaMonto={caso.toleranciaMonto}
              />
              <PanelDecision
                key={expandida.conciliacionId}
                etiquetaCfdi={etiquetaCfdi(expandida.cfdi)}
                enviando={enviando}
                deshabilitado={
                  errorAccion === 'conflicto' || errorAccion === 'no_encontrado'
                }
                motivoLargoServidor={errorAccion === 'motivo_largo'}
                onEditarMotivo={() => {
                  if (errorAccion === 'motivo_largo') resolucion.reset();
                }}
                alerta={
                  conAlerta ? (
                    <AlertaAccion
                      ref={alertaRef}
                      tipo={errorAccion}
                      onRecargar={() => void recargar()}
                    />
                  ) : null
                }
                onConfirmar={() =>
                  resolucion.resolver({
                    accion: 'confirmar',
                    conciliacionId: expandida.conciliacionId,
                  })
                }
                onRechazar={(motivo) =>
                  resolucion.resolver({
                    accion: 'rechazar',
                    conciliacionId: expandida.conciliacionId,
                    motivo,
                  })
                }
              />
              <ListaPropuestas
                propuestas={caso.propuestas}
                seleccionadaId={expandida.conciliacionId}
                onSeleccionar={setSeleccion}
              />
            </div>
          ) : null}
          {vista === 'sin_match' ? (
            <TarjetaSinMatch
              regla={caso.sinMatch?.regla ?? null}
              motivo={caso.sinMatch?.motivo ?? null}
            />
          ) : null}
          {vista === 'conciliado' && expandida !== null ? (
            <>
              <DetallePropuesta
                propuesta={expandida}
                toleranciaMonto={caso.toleranciaMonto}
              />
              <TarjetaConciliado
                usuario={expandida.confirmadaPor?.nombre ?? null}
                confirmadaAt={expandida.confirmadaAt}
              />
            </>
          ) : null}
        </div>
        <Historial
          eventos={historial.data?.datos ?? []}
          etiquetaCfdi={
            expandida === null ? null : etiquetaCfdi(expandida.cfdi)
          }
          pendiente={caso.estado === 'sugerencia'}
          cargando={historial.isLoading}
          fallo={historial.isError && historial.data === undefined}
          onReintentar={() => void historial.refetch()}
        />
      </div>
    </div>
  );
}
