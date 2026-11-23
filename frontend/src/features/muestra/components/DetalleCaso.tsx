import type { CasoMuestra, ResultadoMuestra } from '@/features/muestra/tipos';
import { formatearDiaDeInstante } from '@/features/caso/fecha';
import { etiquetaRegla } from '@/shared/dominio/etiquetas';
import { Button } from '@/shared/ui/Button';
import type { ErrorMarca } from '@/features/muestra/errores';
import { diaCorto } from '@/features/muestra/formato';
import { DETALLE } from '@/features/muestra/textos';
import { DatoMonto } from './DatoMonto';
import estilos from './DetalleCaso.module.css';
import { Marcas } from './Marcas';
import { Verificacion } from './Verificacion';

export interface DetalleCasoProps {
  caso: CasoMuestra;
  /** Posición en toda la muestra (desde 1). */
  n: number;
  total: number;
  hayAnterior: boolean;
  haySiguiente: boolean;
  permisoVerificar: boolean;
  confirmadaPorMi: boolean;
  cambiando: boolean;
  enVuelo: boolean;
  error: ErrorMarca | null;
  onAnterior: () => void;
  onSiguiente: () => void;
  onMarcar: (resultado: ResultadoMuestra) => void;
  onCambiar: () => void;
}

/** Detalle de un caso: movimiento, CFDI, regla, verificación e historial. */
export function DetalleCaso({
  caso,
  n,
  total,
  hayAnterior,
  haySiguiente,
  permisoVerificar,
  confirmadaPorMi,
  cambiando,
  enVuelo,
  error,
  onAnterior,
  onSiguiente,
  onMarcar,
  onCambiar,
}: DetalleCasoProps) {
  const regla = etiquetaRegla(caso.regla);
  const dia =
    caso.confirmadaAt === null
      ? null
      : diaCorto(formatearDiaDeInstante(caso.confirmadaAt));
  return (
    <section className={estilos.tarjeta} aria-labelledby="muestra-caso-t">
      <div className={estilos.cabecera}>
        <h2 id="muestra-caso-t" className={estilos.titulo}>
          Caso <span className={estilos.mono}>{n}</span> de{' '}
          <span className={estilos.mono}>{total}</span>
        </h2>
        <div className={estilos.navegar}>
          <Button
            variante="secundario"
            aria-label={DETALLE.anterior}
            disabled={!hayAnterior}
            onClick={onAnterior}
          >
            {DETALLE.anteriorTexto}
          </Button>
          <Button
            variante="secundario"
            aria-label={DETALLE.siguiente}
            disabled={!haySiguiente}
            onClick={onSiguiente}
          >
            {DETALLE.siguienteTexto}
          </Button>
        </div>
      </div>

      <div className={estilos.dos}>
        <DatoMonto
          rotulo={DETALLE.movimiento}
          titulo={caso.descripcion}
          monto={caso.monto}
          moneda={caso.moneda}
          apoyo={[
            [diaCorto(caso.fecha), caso.banco].filter((p) => p).join(' · '),
            caso.referencia === null ? null : (
              <>
                {DETALLE.referencia}{' '}
                <span className={estilos.mono}>{caso.referencia}</span>
              </>
            ),
          ].filter((l) => l !== null && l !== '')}
        />
        {caso.cfdis.length === 0 ? (
          <div className={estilos.dato}>
            <span className={estilos.rotulo}>{DETALLE.cfdi}</span>
            <span className={estilos.apoyo}>{DETALLE.sinCfdi}</span>
          </div>
        ) : (
          caso.cfdis.map((cfdi) => {
            const folio = [cfdi.serie, cfdi.folio]
              .filter((p) => p !== null && p !== '')
              .join('-');
            return (
              <DatoMonto
                key={cfdi.id}
                rotulo={caso.cfdis.length > 1 ? DETALLE.cfdis : DETALLE.cfdi}
                titulo={cfdi.nombreEmisor}
                monto={cfdi.total}
                moneda={cfdi.moneda}
                apoyo={[
                  cfdi.moneda,
                  folio === '' ? null : (
                    <>
                      {DETALLE.folio}{' '}
                      <span className={estilos.mono}>{folio}</span>
                    </>
                  ),
                ].filter((l) => l !== null)}
              />
            );
          })
        )}
      </div>

      <div className={estilos.dato}>
        <span className={estilos.rotulo}>{DETALLE.regla}</span>
        {regla === null ? null : (
          <span className={estilos.nombre}>{regla}</span>
        )}
        {caso.motivo === null ? null : (
          <span className={estilos.apoyo}>{caso.motivo}</span>
        )}
        {caso.confirmadaPor === null ? null : (
          <span className={estilos.apoyoTenue}>
            {DETALLE.confirmadaEnLote}{' '}
            <strong className={estilos.quien}>
              {confirmadaPorMi ? 'ti' : caso.confirmadaPor}
            </strong>
            {dia === null ? '' : ` ${DETALLE.el} ${dia}`}.
          </span>
        )}
      </div>

      <Verificacion
        caso={caso}
        permisoVerificar={permisoVerificar}
        confirmadaPorMi={confirmadaPorMi}
        cambiando={cambiando}
        enVuelo={enVuelo}
        error={error}
        onMarcar={onMarcar}
        onCambiar={onCambiar}
      />
      <Marcas marcas={caso.marcas} />
    </section>
  );
}
