import { BANCOS_PDF } from '@/shared/dominio';
import { RESUMEN } from '@/features/vista-previa/textos';
import { saldoVista } from '@/features/vista-previa/dinero';
import { AvisoInformativo } from './AvisoInformativo';
import estilos from './ResumenLectura.module.css';

export interface ResumenLecturaProps {
  archivo: string;
  /** El id del banco (`bbva`); `null` no se muestra. */
  banco: string | null;
  total: number;
  /** Decimal en cadena tal como lo envía la API; `null` en cargas anteriores a la 3.4. */
  saldoInicial: string | null;
  saldoFinal: string | null;
}

const nombreDeBanco = (id: string): string =>
  BANCOS_PDF.find((b) => b.id === id)?.nombre ?? id.toUpperCase();

/**
 * Lo que Cuadra leyó: archivo y banco, cuántos movimientos y los dos saldos.
 * Los saldos faltantes van «—» y, sin ellos, no se afirma que cuadran. Las
 * cifras no se parten y la caja crece con el número.
 */
export function ResumenLectura({
  archivo,
  banco,
  total,
  saldoInicial,
  saldoFinal,
}: ResumenLecturaProps) {
  const sinSaldos = saldoInicial === null || saldoFinal === null;
  return (
    <section className={estilos.tarjeta} aria-label={RESUMEN.nombre}>
      <div className={estilos.cabecera}>
        <span className={estilos.rotulo}>{RESUMEN.rotulo}</span>
        <span className={estilos.archivo}>
          {banco === null ? archivo : `${archivo} · ${nombreDeBanco(banco)}`}
        </span>
      </div>
      <div className={estilos.cifras}>
        <div className={estilos.dato}>
          <span className={estilos.pista}>{RESUMEN.movimientos}</span>
          <span className={estilos.cifra}>{total}</span>
        </div>
        <div className={estilos.dato}>
          <span className={estilos.pista}>{RESUMEN.saldoInicial}</span>
          <span className={estilos.cifra}>{saldoVista(saldoInicial)}</span>
        </div>
        <div className={estilos.dato}>
          <span className={estilos.pista}>{RESUMEN.saldoFinal}</span>
          <span className={estilos.cifra}>{saldoVista(saldoFinal)}</span>
        </div>
      </div>
      {sinSaldos ? (
        <AvisoInformativo>
          <span>{RESUMEN.sinSaldos}</span>
        </AvisoInformativo>
      ) : (
        <span className={estilos.cuadran}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l3 3 5-6" />
          </svg>
          {RESUMEN.cuadran}
        </span>
      )}
    </section>
  );
}
