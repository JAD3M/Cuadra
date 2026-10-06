import type { ReactNode, Ref } from 'react';
import { REGLAS_CFDI, evaluarSeleccion } from '@/features/cargas/seleccion';
import {
  ELEGIR_ARCHIVOS,
  QUITAR_RECHAZADOS,
  RECHAZO_CFDI,
  SUBIENDO,
  TARJETA_CFDI,
  botonSubirCfdi,
  resumenDeSeleccion,
} from '@/features/cargas/textos';
import { Button } from '@/shared/ui/Button';
import { ListaArchivos } from './ListaArchivos';
import { RegionResultado } from './RegionResultado';
import { SelectorArchivos } from './SelectorArchivos';
import { ZonaSoltar } from './ZonaSoltar';
import estilos from './tarjeta.module.css';
import { useId } from 'react';

export interface TarjetaCfdiProps {
  /** La selección actual, sin filtrar: la tarjeta la evalúa en cada render. */
  archivos: readonly File[];
  /** Rol de solo lectura: todo queda deshabilitado, no oculto. */
  deshabilitada: boolean;
  /** Esta tarjeta tiene una subida en curso (solo ella se apaga, M13). */
  subiendo: boolean;
  /** Cada elección o drop REEMPLAZA la selección (M16). */
  onSeleccionar: (archivos: File[]) => void;
  /** Solo los aceptados: un rechazado nunca se envía. */
  onSubir: (archivos: File[]) => void;
  /** Para mover el foco a la región de estado al enviar. */
  regionRef?: Ref<HTMLDivElement>;
  /** El resultado de la carga recién subida de esta tarjeta; lo anuncia la región. */
  resultado?: ReactNode;
  /** La alerta de una subida que falló en esta tarjeta; fuera de la región de estado, tiene su propio `role="alert"`. */
  alerta?: ReactNode;
}

/**
 * Tarjeta de CFDI: zona de soltar, lista de la selección y botón de subir. Solo
 * presentación: la selección y el envío viven en el contenedor. La validación
 * local es comodidad; el servidor vuelve a validar cada archivo.
 */
export function TarjetaCfdi({
  archivos,
  deshabilitada,
  subiendo,
  onSeleccionar,
  onSubir,
  regionRef,
  resultado,
  alerta,
}: TarjetaCfdiProps) {
  const idTitulo = useId();
  const inactiva = deshabilitada || subiendo;
  const evaluados = evaluarSeleccion(archivos, REGLAS_CFDI);
  const aceptados = evaluados
    .filter((e) => e.motivo === null)
    .map((e) => e.archivo);
  const listos = aceptados.length;
  const hayRechazados = listos < evaluados.length;

  return (
    <section className={estilos.tarjeta} aria-labelledby={idTitulo}>
      <h2 id={idTitulo} className={`${estilos.rotulo} ${estilos.rotuloCfdi}`}>
        {TARJETA_CFDI.titulo}
      </h2>
      <ZonaSoltar habilitada={!inactiva} onSoltar={onSeleccionar}>
        <svg
          className={estilos.icono}
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M6 3h9l5 5v13H6z" />
          <path d="M14 3v6h6" />
          <path d="M9 15l2 2 4-4" />
        </svg>
        <strong className={estilos.zonaTitulo}>{TARJETA_CFDI.zona}</strong>
        <span className={estilos.zonaDetalle}>{TARJETA_CFDI.zonaDetalle}</span>
        <SelectorArchivos
          etiqueta={ELEGIR_ARCHIVOS}
          accept={REGLAS_CFDI.extension}
          multiple
          deshabilitado={inactiva}
          onElegir={onSeleccionar}
        />
        <span className={estilos.ayuda}>{TARJETA_CFDI.limites}</span>
      </ZonaSoltar>
      <ListaArchivos
        archivos={evaluados}
        motivos={RECHAZO_CFDI}
        rotulo={TARJETA_CFDI.lista}
        apagada={subiendo}
      />
      <div className={estilos.pie}>
        <span className={estilos.resumen}>
          <span>{resumenDeSeleccion(listos, evaluados.length)}</span>
          {hayRechazados ? (
            <Button
              variante="fantasma"
              disabled={inactiva}
              onClick={() => onSeleccionar(aceptados)}
            >
              {QUITAR_RECHAZADOS}
            </Button>
          ) : null}
        </span>
        <Button
          disabled={inactiva || listos === 0}
          onClick={() => onSubir(aceptados)}
        >
          {subiendo ? SUBIENDO : botonSubirCfdi(listos)}
        </Button>
      </div>
      <RegionResultado subiendo={subiendo} regionRef={regionRef}>
        {resultado}
      </RegionResultado>
      {alerta}
    </section>
  );
}
