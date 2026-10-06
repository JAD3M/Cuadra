import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  ACCION_CONFIRMAR,
  ACCION_RECHAZAR,
  REGLA_REFERENCIA_MONTO_EXACTO,
} from '@/shared/dominio';
import { etiquetaCfdi } from '@/features/bandeja/etiquetaCfdi';
import { useEpoca } from '@/features/bandeja/useEpoca';
import { AlertaAccion } from './components/AlertaAccion';
import { AvisoVarias } from './components/AvisoVarias';
import { BannerResolucion } from './components/BannerResolucion';
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
import {
  bannerDe,
  derivarVista,
  historialIdDe,
  propuestaSeleccionada,
  vistaDeLectura,
  type ResolucionVigente,
} from './vista';

export interface CasoContenedorProps {
  movimientoId: string;
}

/**
 * Contenedor del detalle: lee el caso, deriva la vista del estado que devolvió
 * el servidor y compone los componentes de presentación. Cubre los estados de
 * lectura, las variantes con propuestas y de solo lectura, el historial, la
 * decisión (confirmar y rechazar siempre actúan sobre la propuesta expandida),
 * los errores de la acción, el banner de la resolución con su foco y el caso
 * desactualizado. Todo lo que viene de una acción se muestra solo si se activó
 * en la época vigente.
 */
export function CasoContenedor({ movimientoId }: CasoContenedorProps) {
  const consulta = useCaso(movimientoId);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const caso = consulta.data;
  const expandida =
    caso === undefined
      ? null
      : propuestaSeleccionada(caso.propuestas, seleccion);
  const resolucion = useResolverCaso();
  const cliente = useQueryClient();
  const epoca = useEpoca();
  const alertaRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const descripcionRef = useRef<HTMLHeadingElement>(null);
  // Solo cuenta lo que se activó en la época vigente: lo de otra se ignora.
  const vigente =
    resolucion.variables !== undefined && resolucion.variables.epoca === epoca;
  // La última resolución exitosa, derivada de la respuesta del servidor. La
  // mutación termina cuando el caso ya se volvió a pedir.
  const resuelta: ResolucionVigente | null =
    vigente && resolucion.isSuccess
      ? {
          accion:
            resolucion.data.estado === 'confirmada'
              ? ACCION_CONFIRMAR
              : ACCION_RECHAZAR,
          conciliacionId: resolucion.data.id,
          rechazadas: resolucion.data.rechazadasAutomaticamente.length,
        }
      : null;
  // El caso mostrado ya es viejo: la resolución salió bien y volver a pedirlo
  // falló. Se bloquean los controles hasta poder confirmar su estado actual.
  const desactualizado = resuelta !== null && consulta.isRefetchError;
  const hayResolucion = resuelta !== null;
  // El historial es el de la propuesta mostrada; tras rechazar la última, el
  // de la rechazada; un sin_match común no tiene.
  const historial = useHistorial(
    historialIdDe(resuelta, caso?.propuestas ?? [], expandida),
  );
  const enviando =
    resolucion.isPending && resolucion.variables !== undefined
      ? resolucion.variables.accion
      : null;
  // Un fallo solo se muestra en la época en la que se activó la acción.
  const errorAccion =
    resolucion.isError && vigente && resolucion.variables !== undefined
      ? clasificarErrorAccion(resolucion.error, resolucion.variables.accion)
      : null;
  const conAlerta = errorAccion !== null && errorAccion !== 'motivo_largo';

  // Tras un fallo el foco va a la alerta; el 400 lo lleva el propio campo.
  useEffect(() => {
    if (conAlerta) alertaRef.current?.focus();
  }, [conAlerta, errorAccion]);

  // Al terminar una resolución los controles ya no están o cambiaron: el foco
  // va una sola vez al banner.
  useEffect(() => {
    if (hayResolucion) bannerRef.current?.focus();
  }, [hayResolucion, resolucion.submittedAt]);

  /**
   * «Recargar caso» (409): solo al hacer clic; pide el caso y su historial. El
   * botón desaparece con la alerta, así que el foco pasa a la descripción.
   */
  async function recargar() {
    resolucion.reset();
    await cliente.invalidateQueries({ queryKey: clavesCaso.todas(epoca) });
    descripcionRef.current?.focus();
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
  const banner =
    resuelta === null
      ? null
      : bannerDe(resuelta, desactualizado ? undefined : caso);
  const conPropuestas = vista === 'sugerencia' || vista === 'varias';

  return (
    <div className={estilos.pagina}>
      <EncabezadoCaso
        estado={caso.estado}
        regla={expandida?.regla ?? null}
        origen={expandida?.origen ?? null}
        descripcion={caso.movimiento.descripcion}
        descripcionRef={descripcionRef}
        avisos={
          banner === null ? null : (
            <>
              <BannerResolucion ref={bannerRef} {...banner} />
              {desactualizado ? (
                <ErrorCaso
                  tipo="conexion"
                  onReintentar={() => void consulta.refetch()}
                />
              ) : null}
            </>
          )
        }
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
                  desactualizado ||
                  errorAccion === 'conflicto' ||
                  errorAccion === 'no_encontrado'
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
                    accion: ACCION_CONFIRMAR,
                    conciliacionId: expandida.conciliacionId,
                  })
                }
                onRechazar={(motivo) =>
                  resolucion.resolver({
                    accion: ACCION_RECHAZAR,
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
