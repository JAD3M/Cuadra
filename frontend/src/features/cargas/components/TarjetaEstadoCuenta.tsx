import { useId, type Ref } from 'react';
import {
  REGLAS_ESTADO_CUENTA,
  evaluarSeleccion,
} from '@/features/cargas/seleccion';
import {
  ELEGIR_ARCHIVO,
  RECHAZO_ESTADO_CUENTA,
  SUBIENDO,
  TARJETA_ESTADO_CUENTA,
} from '@/features/cargas/textos';
import { LIMITES_CARGA } from '@/shared/dominio';
import { Button } from '@/shared/ui/Button';
import { CampoCuenta } from './CampoCuenta';
import { CampoPerfil } from './CampoPerfil';
import { ListaArchivos } from './ListaArchivos';
import { RegionSubida } from './RegionSubida';
import { SelectorArchivos } from './SelectorArchivos';
import campos from './campos.module.css';
import estilos from './tarjeta.module.css';

export interface TarjetaEstadoCuentaProps {
  /** El CSV elegido, sin filtrar; `null` si aún no hay. */
  archivo: File | null;
  banco: string;
  cuenta: string;
  /** `undefined` mientras cargan o si la lista falló. */
  perfiles: readonly { id: string }[] | undefined;
  /** La lista de perfiles falló: el select queda apagado con Reintentar. */
  perfilesFallo: boolean;
  /** El perfil elegido, ya resuelto; `null` si no hay perfiles. */
  perfil: string | null;
  /** Rol de solo lectura: todo queda deshabilitado, no oculto. */
  deshabilitada: boolean;
  /** Esta tarjeta tiene una subida en curso (solo ella se apaga, M13). */
  subiendo: boolean;
  /** Cada elección REEMPLAZA al archivo anterior (M16). */
  onSeleccionar: (archivo: File | null) => void;
  onBanco: (banco: string) => void;
  onCuenta: (cuenta: string) => void;
  onPerfil: (id: string) => void;
  onReintentarPerfiles: () => void;
  /** Solo si el archivo está aceptado: un rechazado nunca se envía. */
  onSubir: (archivo: File) => void;
  /** Para mover el foco a la región de estado al enviar. */
  regionRef?: Ref<HTMLDivElement>;
}

/**
 * Tarjeta de estado de cuenta: banco, cuenta, perfil, un CSV y el botón de
 * subir. Solo presentación; el estado y el envío viven en el contenedor.
 */
export function TarjetaEstadoCuenta({
  archivo,
  banco,
  cuenta,
  perfiles,
  perfil,
  perfilesFallo,
  deshabilitada,
  subiendo,
  onSeleccionar,
  onBanco,
  onCuenta,
  onPerfil,
  onReintentarPerfiles,
  onSubir,
  regionRef,
}: TarjetaEstadoCuentaProps) {
  const idTitulo = useId();
  const idBanco = useId();
  const inactiva = deshabilitada || subiendo;
  const evaluados = evaluarSeleccion(
    archivo === null ? [] : [archivo],
    REGLAS_ESTADO_CUENTA,
  );
  const aceptado = evaluados[0]?.motivo === null ? archivo : null;

  return (
    <section className={estilos.tarjeta} aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className={`${estilos.rotulo} ${estilos.rotuloCsv}`}>
        {TARJETA_ESTADO_CUENTA.titulo}
      </h2>
      <div className={estilos.rejilla}>
        <div className={campos.campo}>
          <label htmlFor={idBanco} className={campos.etiqueta}>
            {TARJETA_ESTADO_CUENTA.banco}
          </label>
          <input
            id={idBanco}
            className={campos.control}
            value={banco}
            maxLength={LIMITES_CARGA.estadoCuenta.maxBanco}
            disabled={inactiva}
            onChange={(e) => onBanco(e.target.value)}
          />
        </div>
        <CampoCuenta
          valor={cuenta}
          onCambiar={onCuenta}
          deshabilitado={inactiva}
        />
        <div className={estilos.ancha}>
          <CampoPerfil
            perfiles={perfiles}
            fallo={perfilesFallo}
            valor={perfil ?? ''}
            onCambiar={onPerfil}
            onReintentar={onReintentarPerfiles}
            deshabilitado={inactiva}
          />
        </div>
      </div>
      <div className={estilos.elegir}>
        <SelectorArchivos
          etiqueta={ELEGIR_ARCHIVO}
          accept={REGLAS_ESTADO_CUENTA.extension}
          variante="secundario"
          deshabilitado={inactiva}
          onElegir={(archivos) => onSeleccionar(archivos[0] ?? null)}
        />
      </div>
      <ListaArchivos
        archivos={evaluados}
        motivos={RECHAZO_ESTADO_CUENTA}
        rotulo={TARJETA_ESTADO_CUENTA.archivo}
        apagada={subiendo}
      />
      <div className={estilos.pie}>
        <span className={estilos.ayuda}>{TARJETA_ESTADO_CUENTA.limites}</span>
        <Button
          tono="sin_match"
          disabled={inactiva || aceptado === null}
          onClick={() => {
            if (aceptado !== null) onSubir(aceptado);
          }}
        >
          {subiendo ? SUBIENDO : TARJETA_ESTADO_CUENTA.subir}
        </Button>
      </div>
      <RegionSubida subiendo={subiendo} regionRef={regionRef} />
      <p className={estilos.nota}>{TARJETA_ESTADO_CUENTA.nota}</p>
    </section>
  );
}
