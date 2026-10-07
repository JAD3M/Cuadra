import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  TIPO_CFDI,
  TIPO_ESTADO_CUENTA,
  type TipoCarga,
} from '@/shared/dominio';
import type { RespuestaCarga } from '@/shared/api/contratos';
import { useSessionContext } from '@/shared/sesion';
import { clavesCargas, useEpoca } from './claves';
import { AlertaSubida, type FalloSubida } from './components/AlertaSubida';
import { AvisoRevisor } from './components/AvisoRevisor';
import { HistorialCargas } from './components/HistorialCargas';
import { PanelCarga } from './components/PanelCarga';
import { TarjetaCfdi } from './components/TarjetaCfdi';
import { TarjetaEstadoCuenta } from './components/TarjetaEstadoCuenta';
import estilos from './CargasContenedor.module.css';
import { clasificarErrorSubida } from './errores';
import { perfilVigente } from './perfil';
import {
  REGLAS_CFDI,
  REGLAS_ESTADO_CUENTA,
  evaluarSeleccion,
} from './seleccion';
import { usePerfiles } from './usePerfiles';
import { usePollingCargas, type PanelSubida } from './usePollingCargas';
import { useSubirCarga } from './useSubirCarga';
import {
  derivarPanel,
  estadoActualizacion,
  mensajeYaExistia,
  puedeSubir,
  vistaHistorial,
} from './vista';

/**
 * Contenedor de la pantalla de cargas: el aviso de solo lectura, las tarjetas
 * de subida y el historial, en ese orden (Cargas.dc.html). Reúne rol,
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
 * Al vencer el tope del polling, una carga aún activa cambia su barra de
 * proceso por el aviso con «Actualizar» (K5).
 */
export function CargasContenedor() {
  const sesion = useSessionContext();
  const perfiles = usePerfiles();
  const { subir, isPending, variables } = useSubirCarga();
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
    clase: FalloSubida;
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

  // La ruta ya exige sesión lista; si no lo está no hay roles que juzgar.
  if (sesion.status !== 'ready') return null;
  const deshabilitadas = !puedeSubir(sesion.contexto.roles);
  const subiendoCfdi = isPending && variables?.tipo === TIPO_CFDI;
  const subiendoCsv = isPending && variables?.tipo === TIPO_ESTADO_CUENTA;
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
  function registrarFallo(error: unknown, tipo: TipoCarga) {
    const clase = clasificarErrorSubida(error);
    if (clase === null || epoca === null) return;
    setFallo({ tipo, clase, epoca });
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

  // Lo que «Reintentar» volvería a enviar: la selección de ahora, ya filtrada.
  const aceptadosCfdi = evaluarSeleccion(archivosCfdi, REGLAS_CFDI)
    .filter((e) => e.motivo === null)
    .map((e) => e.archivo);
  const aceptadoCsv =
    archivoCsv !== null &&
    evaluarSeleccion([archivoCsv], REGLAS_ESTADO_CUENTA)[0]?.motivo === null
      ? archivoCsv
      : null;

  /** La alerta de la tarjeta de `tipo`; solo si es de la época vigente. */
  function alertaDe(tipo: TipoCarga, reintentar: (() => void) | undefined) {
    if (fallo === null || fallo.tipo !== tipo || fallo.epoca !== epoca) {
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
      {deshabilitadas ? <AvisoRevisor /> : null}
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
          )}
          onSeleccionar={setArchivosCfdi}
          onSubir={subirCfdi}
        />
        <TarjetaEstadoCuenta
          archivo={archivoCsv}
          banco={banco}
          cuenta={cuenta}
          perfiles={perfiles.data}
          perfil={perfil}
          perfilesFallo={perfiles.isError}
          onReintentarPerfiles={() => void perfiles.refetch()}
          deshabilitada={deshabilitadas}
          subiendo={subiendoCsv}
          regionRef={regionCsv}
          resultado={panel?.tipo === TIPO_ESTADO_CUENTA ? resultado : null}
          alerta={alertaDe(
            TIPO_ESTADO_CUENTA,
            aceptadoCsv !== null
              ? () => subirEstadoCuenta(aceptadoCsv)
              : undefined,
          )}
          onSeleccionar={setArchivoCsv}
          onBanco={setBanco}
          onCuenta={setCuenta}
          onPerfil={setPerfilElegido}
          onSubir={subirEstadoCuenta}
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
