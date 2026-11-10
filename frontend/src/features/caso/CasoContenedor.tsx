import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  ACCION_CONFIRMAR,
  ACCION_RECHAZAR,
  REGLA_REFERENCIA_MONTO_EXACTO,
  puede,
} from '@/shared/dominio';
import { useSessionContext } from '@/shared/sesion';
import { etiquetaCfdi } from '@/features/bandeja/etiquetaCfdi';
import { useEpoca } from '@/features/bandeja/useEpoca';
import { AlertaAccion } from './components/AlertaAccion';
import { AvisoInfo } from './components/AvisoInfo';
import { AvisoSoloLectura } from './components/AvisoSoloLectura';
import { AvisoVarias } from './components/AvisoVarias';
import { BannerResolucion } from './components/BannerResolucion';
import { BloqueMovimiento } from './components/BloqueMovimiento';
import { DescartarMovimiento } from './components/DescartarMovimiento';
import { DetallePropuesta } from './components/DetallePropuesta';
import { EncabezadoCaso } from './components/EncabezadoCaso';
import { EnlaceBandeja } from './components/EnlaceBandeja';
import { ErrorCaso } from './components/ErrorCaso';
import { EstadoCargaCaso } from './components/EstadoCargaCaso';
import { Historial } from './components/Historial';
import { ListaPropuestas } from './components/ListaPropuestas';
import { ReabrirConfirmacion } from './components/ReabrirConfirmacion';
import { PanelDecision } from './components/PanelDecision';
import { TarjetaConciliado } from './components/TarjetaConciliado';
import { etiquetasCanceladas, etiquetasPorCfdi } from './canceladas';
import { TarjetaDescartado } from './components/TarjetaDescartado';
import { TarjetaRequiereRevision } from './components/TarjetaRequiereRevision';
import { TarjetaSinMatch } from './components/TarjetaSinMatch';
import estilos from './CasoContenedor.module.css';
import { clavesCaso } from './claves';
import { clasificarErrorAccion, clasificarErrorDescarte } from './errores';
import { PROPUESTAS, REABRIR, VOLVER_A_BANDEJA } from './textos';
import { useCaso } from './useCaso';
import {
  useDescartarMovimiento,
  useDeshacerDescarte,
} from './useDescartarMovimiento';
import { useHistorial } from './useHistorial';
import { useReabrirConfirmacion } from './useReabrirConfirmacion';
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
  // Comodidad: sin la capacidad no se dibujan los controles; el servidor
  // responde 403 igual si alguien los fuerza.
  const sesion = useSessionContext();
  const puedeResolver =
    sesion.status === 'ready' &&
    puede(sesion.contexto.capacidades, 'conciliaciones.resolver');
  const puedeDescartar =
    sesion.status === 'ready' &&
    puede(sesion.contexto.capacidades, 'movimientos.descartar');
  const rolPuedeDeshacer =
    sesion.status === 'ready' &&
    puede(sesion.contexto.capacidades, 'movimientos.deshacer_descarte');
  const rolPuedeReabrir =
    sesion.status === 'ready' &&
    puede(sesion.contexto.capacidades, 'conciliaciones.reabrir');
  const descartar = useDescartarMovimiento();
  const reabrir = useReabrirConfirmacion();
  const deshacer = useDeshacerDescarte();
  const alertaRef = useRef<HTMLDivElement>(null);
  const descartadoRef = useRef<HTMLElement>(null);
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

  // Descartar y deshacer: lo que se activó en otra época se ignora, igual.
  const descarteVigente =
    descartar.variables !== undefined && descartar.variables.epoca === epoca;
  const deshacerVigente =
    deshacer.variables !== undefined && deshacer.variables.epoca === epoca;
  const errorDescarte =
    descartar.isError && descarteVigente
      ? clasificarErrorDescarte(descartar.error)
      : null;
  const errorDeshacer =
    deshacer.isError && deshacerVigente
      ? clasificarErrorDescarte(deshacer.error)
      : null;
  // Tras un 409 o 404 los controles del descarte esperan a recargar.
  const descarteBloqueado = [errorDescarte, errorDeshacer].some(
    (e) => e === 'conflicto' || e === 'no_encontrado',
  );
  // El descarte salió bien y volver a pedir el caso falló: el caso es viejo.
  const descarteDesactualizado =
    consulta.isRefetchError &&
    ((descartar.isSuccess && descarteVigente) ||
      (deshacer.isSuccess && deshacerVigente));
  const hayAlertaDescarte = errorDescarte !== null || errorDeshacer !== null;

  // Reabrir: lo que se activó en otra época se ignora, igual.
  const reabrirVigente =
    reabrir.variables !== undefined && reabrir.variables.epoca === epoca;
  const errorReabrir =
    reabrir.isError && reabrirVigente
      ? clasificarErrorDescarte(reabrir.error)
      : null;
  // Tras un 409 o 404 el formulario espera a recargar.
  const reabrirBloqueado =
    errorReabrir === 'conflicto' || errorReabrir === 'no_encontrado';
  // La reapertura salió bien y volver a pedir el caso falló: el caso es viejo.
  const reabrirDesactualizado =
    consulta.isRefetchError && reabrir.isSuccess && reabrirVigente;

  // Tras un fallo el foco va a la alerta; el 400 lo lleva el propio campo.
  useEffect(() => {
    if (conAlerta || hayAlertaDescarte || errorReabrir !== null) {
      alertaRef.current?.focus();
    }
  }, [
    conAlerta,
    errorAccion,
    hayAlertaDescarte,
    errorDescarte,
    errorDeshacer,
    errorReabrir,
  ]);

  // Descartar terminó: el formulario ya no está; el foco va a la tarjeta
  // «Descartado». Al deshacer, a la descripción del movimiento.
  const descartoOk = descartar.isSuccess && descarteVigente;
  const deshizoOk = deshacer.isSuccess && deshacerVigente;
  useEffect(() => {
    if (descartoOk) descartadoRef.current?.focus();
  }, [descartoOk, descartar.submittedAt]);
  useEffect(() => {
    if (deshizoOk) descripcionRef.current?.focus();
  }, [deshizoOk, deshacer.submittedAt]);

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
    descartar.reset();
    deshacer.reset();
    reabrir.reset();
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
  // Solo un caso cerrado puede pedir revisión; el servidor sigue diciendo «conciliado».
  const enRevision = vista === 'conciliado' && caso.requiereRevision;
  const descarte = caso.descarte ?? null;
  const conPropuestas = vista === 'sugerencia' || vista === 'varias';

  return (
    <div className={estilos.pagina}>
      <EncabezadoCaso
        estado={caso.estado}
        requiereRevision={enRevision}
        regla={expandida?.regla ?? null}
        origen={expandida?.origen ?? null}
        descripcion={caso.movimiento.descripcion}
        descartado={descarte !== null}
        descripcionRef={descripcionRef}
        avisos={
          banner === null &&
          !descarteDesactualizado &&
          !reabrirDesactualizado ? null : (
            <>
              {banner === null ? null : (
                <BannerResolucion ref={bannerRef} {...banner} />
              )}
              {desactualizado ||
              descarteDesactualizado ||
              reabrirDesactualizado ? (
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
              {puedeResolver ? (
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
              ) : (
                <AvisoSoloLectura />
              )}
              <ListaPropuestas
                propuestas={caso.propuestas}
                seleccionadaId={expandida.conciliacionId}
                onSeleccionar={setSeleccion}
              />
            </div>
          ) : null}
          {vista === 'sin_match' && descarte === null ? (
            <>
              <TarjetaSinMatch
                regla={caso.sinMatch?.regla ?? null}
                motivo={caso.sinMatch?.motivo ?? null}
              />
              {puedeDescartar ? (
                <DescartarMovimiento
                  enviando={descartar.isPending}
                  deshabilitado={descarteBloqueado || descarteDesactualizado}
                  onCambio={() => {
                    if (descartar.isError) descartar.reset();
                  }}
                  alerta={
                    errorDescarte === null ? null : (
                      <AlertaAccion
                        ref={alertaRef}
                        tipo={errorDescarte}
                        onRecargar={() => void recargar()}
                      />
                    )
                  }
                  onDescartar={(motivo) =>
                    descartar.descartar({
                      movimientoId: caso.movimiento.id,
                      motivo,
                    })
                  }
                />
              ) : null}
            </>
          ) : null}
          {descarte === null ? null : (
            <TarjetaDescartado
              ref={descartadoRef}
              descarte={descarte}
              rolPuedeDeshacer={rolPuedeDeshacer}
              enviando={deshacer.isPending}
              deshabilitado={descarteBloqueado || descarteDesactualizado}
              alerta={
                errorDeshacer === null ? null : (
                  <AlertaAccion
                    ref={alertaRef}
                    tipo={errorDeshacer}
                    onRecargar={() => void recargar()}
                  />
                )
              }
              onDeshacer={() =>
                deshacer.deshacer({ movimientoId: caso.movimiento.id })
              }
            />
          )}
          {vista === 'conciliado' && expandida !== null ? (
            <>
              <DetallePropuesta
                propuesta={expandida}
                toleranciaMonto={caso.toleranciaMonto}
              />
              {enRevision ? (
                <TarjetaRequiereRevision
                  etiquetasCanceladas={etiquetasCanceladas(expandida)}
                  usuario={expandida.confirmadaPor?.nombre ?? null}
                  confirmadaAt={expandida.confirmadaAt}
                />
              ) : (
                <TarjetaConciliado
                  usuario={expandida.confirmadaPor?.nombre ?? null}
                  confirmadaAt={expandida.confirmadaAt}
                />
              )}
              {caso.puedeReabrir ? (
                <ReabrirConfirmacion
                  key={expandida.conciliacionId}
                  enviando={reabrir.isPending}
                  deshabilitado={reabrirBloqueado || reabrirDesactualizado}
                  onCambio={() => {
                    if (reabrir.isError) reabrir.reset();
                  }}
                  alerta={
                    errorReabrir === null ? null : (
                      <AlertaAccion
                        ref={alertaRef}
                        tipo={errorReabrir}
                        onRecargar={() => void recargar()}
                      />
                    )
                  }
                  onReabrir={(motivo) =>
                    reabrir.reabrir({
                      conciliacionId: expandida.conciliacionId,
                      motivo,
                    })
                  }
                />
              ) : (
                <AvisoInfo
                  texto={
                    rolPuedeReabrir
                      ? REABRIR.soloAutorOAdmin
                      : REABRIR.soloLecturaRol
                  }
                />
              )}
            </>
          ) : null}
        </div>
        <Historial
          eventos={historial.data?.datos ?? []}
          etiquetaCfdi={
            expandida === null ? null : etiquetaCfdi(expandida.cfdi)
          }
          etiquetasPorCfdi={etiquetasPorCfdi(expandida)}
          pendiente={caso.estado === 'sugerencia'}
          descarte={
            descarte === null
              ? null
              : {
                  por: descarte.por,
                  motivo: descarte.motivo,
                  fecha: descarte.fecha,
                }
          }
          cargando={historial.isLoading}
          fallo={historial.isError && historial.data === undefined}
          onReintentar={() => void historial.refetch()}
        />
      </div>
    </div>
  );
}
