import { useEffect, useRef, useState } from 'react';
import { puede } from '@/shared/dominio';
import { useSessionContext } from '@/shared/sesion';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import { useEpoca } from '@/features/cargas/claves';
import { AccionesVistaPrevia } from './components/AccionesVistaPrevia';
import { NoEncontrada, SinPermiso, YaResuelta } from './components/AvisoEstado';
import { AvisoInformativo } from './components/AvisoInformativo';
import { BannerDecision } from './components/BannerDecision';
import { ConfirmarRechazo } from './components/ConfirmarRechazo';
import { EnlaceCargas, IrACargas } from './components/EnlaceCargas';
import { EsqueletoVistaPrevia } from './components/EsqueletoVistaPrevia';
import {
  EstadoVistaPrevia,
  type FaseVistaPrevia,
} from './components/EstadoVistaPrevia';
import { ResumenLectura } from './components/ResumenLectura';
import { TablaMovimientos } from './components/TablaMovimientos';
import { clasificarErrorDecision, clasificarErrorLectura } from './errores';
import {
  ERROR_CONEXION,
  ERROR_DECISION,
  ERROR_RED_DECISION,
  REINTENTAR,
  SOLO_CONSULTA,
} from './textos';
import { useDecidirVistaPrevia } from './useDecidirVistaPrevia';
import { useVistaPrevia } from './useVistaPrevia';
import estilos from './VistaPreviaContenedor.module.css';

export interface VistaPreviaContenedorProps {
  cargaId: string;
}

/**
 * Contenedor de la vista previa (historia 3.4). Sin `cargas.ver` solo muestra
 * el aviso de sin permiso y no pide nada, como la pantalla de Cargas. Con
 * acceso lee la vista previa y, si la persona puede cargar (`cargas.cargar`),
 * ofrece aceptar y rechazar; si no, solo consulta. Todo lo que se muestra de
 * una decisión sale de la respuesta del servidor y solo cuenta en la época en
 * que se activó. Aceptar y rechazar pasan por la API: aquí no se decide nada.
 */
export function VistaPreviaContenedor({ cargaId }: VistaPreviaContenedorProps) {
  const sesion = useSessionContext();
  // La ruta ya exige sesión lista; si no lo está no hay capacidades que juzgar.
  if (sesion.status !== 'ready') return null;
  const capacidades = sesion.contexto.capacidades;
  if (!puede(capacidades, 'cargas.ver')) {
    return (
      <section aria-label="Sin permiso" className={estilos.pagina}>
        <SinPermiso />
      </section>
    );
  }
  return (
    <VistaPreviaConAcceso
      cargaId={cargaId}
      puedeDecidir={puede(capacidades, 'cargas.cargar')}
    />
  );
}

function VistaPreviaConAcceso({
  cargaId,
  puedeDecidir,
}: VistaPreviaContenedorProps & { puedeDecidir: boolean }) {
  const consulta = useVistaPrevia(cargaId);
  const decision = useDecidirVistaPrevia();
  const epoca = useEpoca();
  const [confirmando, setConfirmando] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const alertaRef = useRef<HTMLDivElement>(null);
  const rechazarRef = useRef<HTMLButtonElement>(null);
  const volverAlBoton = useRef(false);

  const datos = consulta.data;
  // Solo cuenta lo que se activó en la época vigente: lo de otra se ignora.
  const vigente =
    decision.variables !== undefined && decision.variables.epoca === epoca;
  const accionEnCurso = vigente ? decision.variables?.accion : undefined;
  const enviando = decision.isPending ? (accionEnCurso ?? null) : null;
  const decidida =
    vigente && decision.isSuccess && accionEnCurso !== undefined
      ? { accion: accionEnCurso, respuesta: decision.data }
      : null;
  const errorDecision =
    vigente && decision.isError
      ? clasificarErrorDecision(decision.error)
      : null;
  const errorLectura =
    datos === undefined && consulta.isError
      ? clasificarErrorLectura(consulta.error)
      : null;

  const noEncontrada =
    errorLectura === 'no_encontrada' || errorDecision === 'no_encontrada';
  const yaResuelta =
    errorLectura === 'ya_resuelta' || errorDecision === 'ya_resuelta';
  const sinPermiso =
    errorLectura === 'sin_permiso' || errorDecision === 'sin_permiso';
  const errorServidor = errorDecision === 'servidor';
  const errorRed = errorDecision === 'red';
  const cargando = datos === undefined && consulta.isPending;

  const conContenido =
    datos !== undefined && decidida === null && !noEncontrada;
  const decidible = conContenido && puedeDecidir && !yaResuelta && !sinPermiso;
  const conConfirmacion = decidible && confirmando;
  const conAcciones = decidible && !confirmando;

  const fase: FaseVistaPrevia =
    enviando === 'aceptar'
      ? 'aceptando'
      : enviando === 'rechazar'
        ? 'rechazando'
        : decidida !== null
          ? decidida.accion === 'aceptar'
            ? 'aceptada'
            : 'rechazada'
          : 'espera';

  const hayAlerta = yaResuelta || sinPermiso || errorServidor || errorRed;
  const hayDecidida = decidida !== null;

  // Tras decidir, los controles ya no están: el foco va una sola vez al banner.
  useEffect(() => {
    if (hayDecidida) bannerRef.current?.focus();
  }, [hayDecidida]);

  // Tras un fallo de la acción el foco va a la alerta.
  useEffect(() => {
    if (hayAlerta && errorDecision !== null) alertaRef.current?.focus();
  }, [hayAlerta, errorDecision, decision.submittedAt]);

  // Al cancelar la confirmación el foco vuelve al botón que la abrió.
  useEffect(() => {
    if (!confirmando && volverAlBoton.current) {
      volverAlBoton.current = false;
      rechazarRef.current?.focus();
    }
  }, [confirmando]);

  function aceptar() {
    decision.decidir({ accion: 'aceptar', cargaId });
  }

  function rechazar() {
    volverAlBoton.current = false;
    setConfirmando(false);
    decision.decidir({ accion: 'rechazar', cargaId });
  }

  function abrirConfirmacion() {
    // Un error de un intento anterior no debe quedar junto al diálogo.
    decision.reset();
    setConfirmando(true);
  }

  function cancelarRechazo() {
    volverAlBoton.current = true;
    setConfirmando(false);
  }

  return (
    <div className={estilos.pagina}>
      <EnlaceCargas variante="atras" />
      <div className={estilos.estado}>
        <EstadoVistaPrevia fase={fase} />
      </div>

      {cargando ? <EsqueletoVistaPrevia /> : null}
      {noEncontrada ? <NoEncontrada /> : null}
      {yaResuelta ? <YaResuelta ref={alertaRef} /> : null}
      {sinPermiso ? <SinPermiso ref={alertaRef} /> : null}
      {errorLectura === 'conexion' ? (
        <AlertaError
          titulo={ERROR_CONEXION.titulo}
          detalle={ERROR_CONEXION.detalle}
          accion={
            <Button
              variante="secundario"
              onClick={() => void consulta.refetch()}
            >
              {REINTENTAR}
            </Button>
          }
        />
      ) : null}
      {errorServidor ? (
        <AlertaError
          ref={alertaRef}
          titulo={ERROR_DECISION.titulo}
          detalle={
            accionEnCurso === 'rechazar'
              ? ERROR_DECISION.rechazar
              : ERROR_DECISION.aceptar
          }
        />
      ) : null}
      {errorRed ? (
        <AlertaError
          ref={alertaRef}
          titulo={ERROR_RED_DECISION.titulo}
          detalle={ERROR_RED_DECISION.detalle}
          accion={<IrACargas />}
        />
      ) : null}
      {conContenido && !puedeDecidir ? (
        <AvisoInformativo>
          <strong>{SOLO_CONSULTA.titulo}</strong>
          <span>{SOLO_CONSULTA.detalle}</span>
        </AvisoInformativo>
      ) : null}
      {decidida !== null ? (
        <BannerDecision
          ref={bannerRef}
          accion={decidida.accion}
          movimientos={decidida.respuesta.movimientos}
        />
      ) : null}

      {conContenido ? (
        <>
          <ResumenLectura
            archivo={datos.archivo}
            banco={datos.banco}
            total={datos.total}
            saldoInicial={datos.saldoInicial}
            saldoFinal={datos.saldoFinal}
          />
          <TablaMovimientos movimientos={datos.movimientos} />
        </>
      ) : null}
      {conConfirmacion ? (
        <ConfirmarRechazo
          total={datos.total}
          onConfirmar={rechazar}
          onCancelar={cancelarRechazo}
        />
      ) : null}
      {conAcciones ? (
        <AccionesVistaPrevia
          ocupado={enviando}
          onAceptar={aceptar}
          onRechazar={abrirConfirmacion}
          rechazarRef={rechazarRef}
        />
      ) : null}
    </div>
  );
}
