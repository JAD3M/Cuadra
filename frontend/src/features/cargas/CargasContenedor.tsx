import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  BANCO_PDF_BBVA,
  TIPO_CFDI,
  TIPO_ESTADO_CUENTA,
  puede,
  type ModoEstadoCuenta,
  type TipoCarga,
} from '@/shared/dominio';
import type {
  RespuestaCarga,
  RespuestaLecturaPdf,
} from '@/shared/api/contratos';
import { AlertaError } from '@/shared/ui/AlertaError';
import { useSessionContext } from '@/shared/sesion';
import { clavesCargas, useEpoca } from './claves';
import { AlertaSubida, type FalloSubida } from './components/AlertaSubida';
import { HistorialCargas } from './components/HistorialCargas';
import { PanelCarga } from './components/PanelCarga';
import { ResultadoLecturaPdf } from './components/ResultadoLecturaPdf';
import { ResultadoProcesando } from './components/ResultadoProcesando';
import { TarjetaCfdi } from './components/TarjetaCfdi';
import { TarjetaEstadoCuenta } from './components/TarjetaEstadoCuenta';
import estilos from './CargasContenedor.module.css';
import { clasificarErrorSubida } from './errores';
import { perfilVigente } from './perfil';
import { ERROR_SIN_PERMISO, LEYENDO_ESTADO_CUENTA } from './textos';
import {
  REGLAS_CFDI,
  REGLAS_ESTADO_CUENTA,
  REGLAS_ESTADO_CUENTA_PDF,
  evaluarSeleccion,
} from './seleccion';
import { usePerfiles } from './usePerfiles';
import { usePollingCargas, type PanelSubida } from './usePollingCargas';
import { useLeerEstadoCuentaPdf } from './useLeerEstadoCuentaPdf';
import { useSubirCarga } from './useSubirCarga';
import {
  derivarPanel,
  estadoActualizacion,
  mensajeYaExistia,
  puedeSubir,
  vistaHistorial,
} from './vista';

/**
 * Contenedor de la pantalla de cargas. Sin `cargas.ver` (revisor, auditor)
 * solo muestra el aviso de sin permiso y no pide nada al servidor, como la
 * pantalla de Usuarios; el menú ya oculta la entrada y el servidor responde
 * 403. Con acceso, las tarjetas de subida y el historial, en ese orden
 * (Cargas.dc.html). Reúne rol,
 * selección, campos escritos y la mutación; las tarjetas solo reciben props.
 * El estado de la pantalla se deriva de lo que ya existe (sesión, mutación,
 * perfiles, lista): nada se guarda de más.
 *
 * Un solo `usePollingCargas` alimenta el historial y las tarjetas: la misma
 * lista, la misma ventana, el mismo tope y el mismo «Actualizar».
 *
 * Tras un éxito la carga queda en el panel de su tarjeta: se muestra lo que
 * respondió el POST y, mientras siga activa, se sondea su detalle hasta que
 * termine. Un panel de otra época no se muestra.
 *
 * Una subida a la vez (la guarda vive en `useSubirCarga`); mientras una tarjeta
 * sube solo ella se apaga (M13). Un fallo conserva la selección y los campos
 * para poder reintentar y deja una alerta en la tarjeta que subió, con el foco;
 * un éxito, incluido un lote que ya existía, los limpia. Una subida nueva quita
 * la alerta anterior.
 *
 * El estado de cuenta también se puede mandar como PDF de BBVA (historia 3.2):
 * el servidor solo lo lee y devuelve saldos y conteos, sin crear una carga ni
 * tocar el historial. Cada formato conserva su propio archivo y su resultado;
 * la alerta de un fallo se muestra en el formato que la produjo.
 *
 * Al vencer el tope del polling, una carga aún activa cambia su barra de
 * proceso por el aviso con «Actualizar» (K5).
 */
export function CargasContenedor() {
  const sesion = useSessionContext();
  // La ruta ya exige sesión lista; si no lo está no hay capacidades que juzgar.
  if (sesion.status !== 'ready') return null;
  if (!puede(sesion.contexto.capacidades, 'cargas.ver')) {
    return (
      <section aria-label="Sin permiso" className={estilos.contenedor}>
        <AlertaError {...ERROR_SIN_PERMISO} />
      </section>
    );
  }
  return <CargasConAcceso />;
}

/** Las tarjetas y el historial; solo se monta con `cargas.ver`. */
function CargasConAcceso() {
  const sesion = useSessionContext();
  const perfiles = usePerfiles();
  const { subir, isPending, variables } = useSubirCarga();
  const { leer, isPending: leyendoPdf } = useLeerEstadoCuentaPdf();
  const epoca = useEpoca();
  const cliente = useQueryClient();
  // La carga recién subida: la reemplaza la siguiente subida con éxito y no
  // hay forma de descartarla (M13).
  const [panel, setPanel] = useState<PanelSubida | null>(null);
  const { lista, panelDatos, iniciarVentana, capada, activo, actualizar } =
    usePollingCargas(panel);
  // El último fallo de subida y la tarjeta en que ocurrió. Guarda la época:
  // la alerta de otra sesión no se muestra (CRG-9).
  const [fallo, setFallo] = useState<{
    tipo: TipoCarga;
    /** El fallo fue al leer un PDF (misma tarjeta que el CSV, otro formato). */
    pdf: boolean;
    clase: FalloSubida;
    epoca: number;
  } | null>(null);
  const [modo, setModo] = useState<ModoEstadoCuenta>('csv');
  const [archivoPdf, setArchivoPdf] = useState<File | null>(null);
  // Lo último que se leyó de un PDF; se descarta si es de otra sesión.
  const [lectura, setLectura] = useState<{
    datos: RespuestaLecturaPdf;
    epoca: number;
  } | null>(null);
  const alertaRef = useRef<HTMLDivElement>(null);
  const [archivosCfdi, setArchivosCfdi] = useState<File[]>([]);
  const [archivoCsv, setArchivoCsv] = useState<File | null>(null);
  const [banco, setBanco] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [perfilElegido, setPerfilElegido] = useState<string | null>(null);
  const regionCfdi = useRef<HTMLDivElement>(null);
  const regionCsv = useRef<HTMLDivElement>(null);

  // Tras un fallo el foco pasa a la alerta (el botón pulsado se apagó y el foco
  // estaba en la región de la tarjeta). Un fallo nuevo es un objeto nuevo.
  useEffect(() => {
    if (fallo !== null) alertaRef.current?.focus();
  }, [fallo]);

  // La ruta ya exige sesión lista; si no lo está no hay capacidades que juzgar.
  if (sesion.status !== 'ready') return null;
  const deshabilitadas = !puedeSubir(sesion.contexto.capacidades);
  const subiendoCfdi = isPending && variables?.tipo === TIPO_CFDI;
  const subiendoCsv = isPending && variables?.tipo === TIPO_ESTADO_CUENTA;
  const esPdf = modo === 'pdf';
  const perfil = perfilVigente(perfiles.data, perfilElegido);

  const vista = vistaHistorial(lista);
  const vistaPanel = derivarPanel({
    panel: panel === null ? null : { tipo: panel.tipo, epoca: panel.epoca },
    datos: panelDatos,
    epoca,
  });
  const resultado =
    panel === null || panelDatos === null || vistaPanel === 'ninguno' ? null : (
      <PanelCarga
        vista={vistaPanel}
        frasesYaExistia={
          panel.yaExistia ? mensajeYaExistia(panel.inicial.estado) : null
        }
        conteo={{
          ok: panelDatos.registrosOk,
          existentes: panelDatos.registrosExistentes,
          error: panelDatos.registrosError,
        }}
        resultados={panelDatos.resultados}
        alActualizar={capada ? actualizar : undefined}
      />
    );

  /** Lo que muestra la tarjeta en modo PDF: «Leyendo…» o lo último que se leyó. */
  const resultadoPdf = leyendoPdf ? (
    <ResultadoProcesando texto={LEYENDO_ESTADO_CUENTA} />
  ) : lectura !== null && lectura.epoca === epoca ? (
    <ResultadoLecturaPdf
      movimientosLeidos={lectura.datos.movimientosLeidos}
      estado={lectura.datos.estado}
      saldoInicial={lectura.datos.saldoInicial}
      saldoFinal={lectura.datos.saldoFinal}
      cargaId={lectura.datos.cargaId}
    />
  ) : null;

  /** Deja la respuesta del POST como el panel de su tarjeta y abre una ventana de sondeo. */
  function mostrarPanel(respuesta: RespuestaCarga, tipo: TipoCarga) {
    if (epoca === null) return;
    // Resubir un lote fallido lo reencola con el mismo id: el detalle que
    // quedó en caché es de la corrida anterior y taparía la nueva.
    void cliente.resetQueries({
      queryKey: clavesCargas.detalle(epoca, respuesta.id),
      exact: true,
    });
    setPanel({
      id: respuesta.id,
      tipo,
      yaExistia: respuesta.yaExistia,
      inicial: respuesta,
      epoca,
    });
    iniciarVentana();
  }

  /**
   * Clasifica el fallo y lo deja en la tarjeta que subió. Un 401 y una
   * cancelación no dicen nada (la capa de sesión atiende el 401); el resto,
   * incluido «otro» (500, fallo inesperado), tiene su alerta en el mockup v25.
   */
  function registrarFallo(error: unknown, tipo: TipoCarga, pdf = false) {
    const clase = clasificarErrorSubida(error);
    if (clase === null || epoca === null) return;
    setFallo({ tipo, pdf, clase, epoca });
  }

  function subirCfdi(archivos: File[]) {
    const enviada = subir(
      { tipo: TIPO_CFDI, archivos },
      {
        onSuccess: (respuesta) => {
          setArchivosCfdi([]);
          mostrarPanel(respuesta, TIPO_CFDI);
        },
        onError: (error) => registrarFallo(error, TIPO_CFDI),
      },
    );
    // El botón pulsado se deshabilita y el foco caería al `body`: pasa una vez
    // a la región de estado de la tarjeta. Una subida nueva quita la alerta.
    if (enviada) {
      setFallo(null);
      regionCfdi.current?.focus();
    }
  }

  function subirEstadoCuenta(archivo: File) {
    const enviada = subir(
      { tipo: TIPO_ESTADO_CUENTA, archivo, banco, cuenta, perfil },
      {
        onSuccess: (respuesta) => {
          setArchivoCsv(null);
          setBanco('');
          setCuenta('');
          mostrarPanel(respuesta, TIPO_ESTADO_CUENTA);
        },
        onError: (error) => registrarFallo(error, TIPO_ESTADO_CUENTA),
      },
    );
    if (enviada) {
      setFallo(null);
      regionCsv.current?.focus();
    }
  }

  function leerPdf(archivo: File) {
    const enviada = leer(
      { archivo, banco: BANCO_PDF_BBVA },
      {
        // El PDF se queda elegido: no se importó nada y se puede volver a leer.
        onSuccess: (datos) => {
          if (epoca !== null) setLectura({ datos, epoca });
        },
        onError: (error) => registrarFallo(error, TIPO_ESTADO_CUENTA, true),
      },
    );
    if (enviada) {
      setFallo(null);
      setLectura(null);
      regionCsv.current?.focus();
    }
  }

  // Lo que «Reintentar» volvería a enviar: la selección de ahora, ya filtrada.
  const aceptadosCfdi = evaluarSeleccion(archivosCfdi, REGLAS_CFDI)
    .filter((e) => e.motivo === null)
    .map((e) => e.archivo);
  const aceptadoCsv =
    archivoCsv !== null &&
    evaluarSeleccion([archivoCsv], REGLAS_ESTADO_CUENTA)[0]?.motivo === null
      ? archivoCsv
      : null;

  const aceptadoPdf =
    archivoPdf !== null &&
    evaluarSeleccion([archivoPdf], REGLAS_ESTADO_CUENTA_PDF)[0]?.motivo === null
      ? archivoPdf
      : null;

  /** La alerta de la tarjeta de `tipo` (y del formato `pdf`); solo si es de la época vigente. */
  function alertaDe(
    tipo: TipoCarga,
    reintentar: (() => void) | undefined,
    pdf: boolean,
  ) {
    if (
      fallo === null ||
      fallo.tipo !== tipo ||
      fallo.pdf !== pdf ||
      fallo.epoca !== epoca
    ) {
      return null;
    }
    return (
      <AlertaSubida
        ref={alertaRef}
        fallo={fallo.clase}
        onReintentar={reintentar}
      />
    );
  }

  return (
    <div className={estilos.contenedor}>
      <div className={estilos.tarjetas}>
        <TarjetaCfdi
          archivos={archivosCfdi}
          deshabilitada={deshabilitadas}
          subiendo={subiendoCfdi}
          regionRef={regionCfdi}
          resultado={panel?.tipo === TIPO_CFDI ? resultado : null}
          alerta={alertaDe(
            TIPO_CFDI,
            aceptadosCfdi.length > 0
              ? () => subirCfdi(aceptadosCfdi)
              : undefined,
            false,
          )}
          onSeleccionar={setArchivosCfdi}
          onSubir={subirCfdi}
        />
        <TarjetaEstadoCuenta
          modo={modo}
          onModo={setModo}
          archivo={esPdf ? archivoPdf : archivoCsv}
          banco={banco}
          cuenta={cuenta}
          perfiles={perfiles.data}
          perfil={perfil}
          perfilesFallo={perfiles.isError}
          onReintentarPerfiles={() => void perfiles.refetch()}
          deshabilitada={deshabilitadas}
          subiendo={subiendoCsv || leyendoPdf}
          regionRef={regionCsv}
          resultado={
            esPdf
              ? resultadoPdf
              : panel?.tipo === TIPO_ESTADO_CUENTA
                ? resultado
                : null
          }
          alerta={
            esPdf
              ? alertaDe(
                  TIPO_ESTADO_CUENTA,
                  aceptadoPdf !== null ? () => leerPdf(aceptadoPdf) : undefined,
                  true,
                )
              : alertaDe(
                  TIPO_ESTADO_CUENTA,
                  aceptadoCsv !== null
                    ? () => subirEstadoCuenta(aceptadoCsv)
                    : undefined,
                  false,
                )
          }
          onSeleccionar={esPdf ? setArchivoPdf : setArchivoCsv}
          onBanco={setBanco}
          onCuenta={setCuenta}
          onPerfil={setPerfilElegido}
          onSubir={esPdf ? leerPdf : subirEstadoCuenta}
        />
      </div>
      <HistorialCargas
        vista={vista}
        cargas={lista.data?.datos ?? []}
        onReintentar={() => void lista.refetch()}
        actualizacion={estadoActualizacion({ vista, activo, capada })}
        onActualizar={actualizar}
      />
    </div>
  );
}
