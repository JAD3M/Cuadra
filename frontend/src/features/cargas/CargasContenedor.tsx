import { useRef, useState } from 'react';
import { TIPO_CFDI, TIPO_ESTADO_CUENTA } from '@/shared/dominio';
import { useSessionContext } from '@/shared/sesion';
import { AvisoRevisor } from './components/AvisoRevisor';
import { TarjetaCfdi } from './components/TarjetaCfdi';
import { TarjetaEstadoCuenta } from './components/TarjetaEstadoCuenta';
import estilos from './CargasContenedor.module.css';
import { perfilVigente } from './perfil';
import { usePerfiles } from './usePerfiles';
import { useSubirCarga } from './useSubirCarga';
import { puedeSubir } from './vista';

/**
 * Contenedor de las tarjetas de subida (esqueleto de S5; la pantalla completa
 * llega en S8). Reúne rol, selección, campos escritos y la mutación; las
 * tarjetas solo reciben props. El estado de la pantalla se deriva de lo que ya
 * existe (sesión, mutación, perfiles): nada se guarda de más.
 *
 * Una subida a la vez (la guarda vive en `useSubirCarga`); mientras una tarjeta
 * sube solo ella se apaga (M13). Un fallo conserva la selección y los campos
 * para poder reintentar; un éxito, incluido un lote que ya existía, los limpia.
 */
export function CargasContenedor() {
  const sesion = useSessionContext();
  const perfiles = usePerfiles();
  const { subir, isPending, variables } = useSubirCarga();
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

  function subirCfdi(archivos: File[]) {
    const enviada = subir(
      { tipo: TIPO_CFDI, archivos },
      { onSuccess: () => setArchivosCfdi([]) },
    );
    // El botón pulsado se deshabilita y el foco caería al `body`: pasa una vez
    // a la región de estado de la tarjeta.
    if (enviada) regionCfdi.current?.focus();
  }

  function subirEstadoCuenta(archivo: File) {
    const enviada = subir(
      { tipo: TIPO_ESTADO_CUENTA, archivo, banco, cuenta, perfil },
      {
        onSuccess: () => {
          setArchivoCsv(null);
          setBanco('');
          setCuenta('');
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
