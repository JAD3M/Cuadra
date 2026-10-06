import { useRef, useState } from 'react';
import {
  TIPO_CFDI,
  TIPO_ESTADO_CUENTA,
  type TipoCarga,
} from '@/shared/dominio';
import type { RespuestaCarga } from '@/shared/api/contratos';
import { useSessionContext } from '@/shared/sesion';
import { useEpoca } from './claves';
import { AvisoRevisor } from './components/AvisoRevisor';
import { PanelCarga } from './components/PanelCarga';
import { TarjetaCfdi } from './components/TarjetaCfdi';
import { TarjetaEstadoCuenta } from './components/TarjetaEstadoCuenta';
import estilos from './CargasContenedor.module.css';
import { perfilVigente } from './perfil';
import { usePerfiles } from './usePerfiles';
import { usePollingCargas, type PanelSubida } from './usePollingCargas';
import { useSubirCarga } from './useSubirCarga';
import { derivarPanel, mensajeYaExistia, puedeSubir } from './vista';

/**
 * Contenedor de las tarjetas de subida (esqueleto de S5; la pantalla completa
 * llega en S8). Reúne rol, selección, campos escritos y la mutación; las
 * tarjetas solo reciben props. El estado de la pantalla se deriva de lo que ya
 * existe (sesión, mutación, perfiles): nada se guarda de más.
 *
 * Tras un éxito la carga queda en el panel de su tarjeta: se muestra lo que
 * respondió el POST y, mientras siga activa, se sondea su detalle hasta que
 * termine. Un panel de otra época no se muestra.
 *
 * Una subida a la vez (la guarda vive en `useSubirCarga`); mientras una tarjeta
 * sube solo ella se apaga (M13). Un fallo conserva la selección y los campos
 * para poder reintentar; un éxito, incluido un lote que ya existía, los limpia.
 */
export function CargasContenedor() {
  const sesion = useSessionContext();
  const perfiles = usePerfiles();
  const { subir, isPending, variables } = useSubirCarga();
  const epoca = useEpoca();
  // La carga recién subida: la reemplaza la siguiente subida con éxito y no
  // hay forma de descartarla (M13).
  const [panel, setPanel] = useState<PanelSubida | null>(null);
  const { panelDatos, iniciarVentana } = usePollingCargas(panel);
  const [archivosCfdi, setArchivosCfdi] = useState<File[]>([]);
  const [archivoCsv, setArchivoCsv] = useState<File | null>(null);
  const [banco, setBanco] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [perfilElegido, setPerfilElegido] = useState<string | null>(null);
  const regionCfdi = useRef<HTMLDivElement>(null);
  const regionCsv = useRef<HTMLDivElement>(null);

  // La ruta ya exige sesión lista; si no lo está no hay roles que juzgar.
  if (sesion.status !== 'ready') return null;
  const deshabilitadas = !puedeSubir(sesion.contexto.roles);
  const subiendoCfdi = isPending && variables?.tipo === TIPO_CFDI;
  const subiendoCsv = isPending && variables?.tipo === TIPO_ESTADO_CUENTA;
  const perfil = perfilVigente(perfiles.data, perfilElegido);

  const vistaPanel = derivarPanel({ panel, datos: panelDatos, epoca });
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
        errorMensaje={panelDatos.errorMensaje}
      />
    );

  /** Deja la respuesta del POST como el panel de su tarjeta y abre una ventana de sondeo. */
  function mostrarPanel(respuesta: RespuestaCarga, tipo: TipoCarga) {
    if (epoca === null) return;
    setPanel({
      id: respuesta.id,
      tipo,
      yaExistia: respuesta.yaExistia,
      inicial: respuesta,
      epoca,
    });
    iniciarVentana();
  }

  function subirCfdi(archivos: File[]) {
    const enviada = subir(
      { tipo: TIPO_CFDI, archivos },
      {
        onSuccess: (respuesta) => {
          setArchivosCfdi([]);
          mostrarPanel(respuesta, TIPO_CFDI);
        },
      },
    );
    // El botón pulsado se deshabilita y el foco caería al `body`: pasa una vez
    // a la región de estado de la tarjeta.
    if (enviada) regionCfdi.current?.focus();
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
      },
    );
    if (enviada) regionCsv.current?.focus();
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
          onSeleccionar={setArchivoCsv}
          onBanco={setBanco}
          onCuenta={setCuenta}
          onPerfil={setPerfilElegido}
          onSubir={subirEstadoCuenta}
        />
      </div>
    </div>
  );
}
