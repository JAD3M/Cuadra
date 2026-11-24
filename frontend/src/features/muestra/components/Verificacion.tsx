import { Link } from 'react-router';
import type { CasoMuestra, ResultadoMuestra } from '@/features/muestra/tipos';
import { AlertaError } from '@/shared/ui/AlertaError';
import { Button } from '@/shared/ui/Button';
import type { ErrorMarca } from '@/features/muestra/errores';
import { instanteCorto } from '@/features/muestra/formato';
import { ERRORES_MARCA, VERIFICACION } from '@/features/muestra/textos';
import { Aviso } from './Aviso';
import estilos from './DetalleCaso.module.css';
import { IconoCruz, IconoPalomita } from './iconos';

export interface VerificacionProps {
  caso: CasoMuestra;
  /** La persona tiene `muestra.verificar` (capacidad de sección). */
  permisoVerificar: boolean;
  /** El caso lo confirmó quien consulta (por el nombre que da la API). */
  confirmadaPorMi: boolean;
  /** «Cambiar marca» está abierto para este caso. */
  cambiando: boolean;
  enVuelo: boolean;
  error: ErrorMarca | null;
  onMarcar: (resultado: ResultadoMuestra) => void;
  onCambiar: () => void;
}

function Botones({
  deshabilitados,
  onMarcar,
}: {
  deshabilitados: boolean;
  onMarcar: (resultado: ResultadoMuestra) => void;
}) {
  return (
    <div className={estilos.botones}>
      <button
        type="button"
        className={estilos.bok}
        disabled={deshabilitados}
        onClick={() => onMarcar('conforme')}
      >
        <IconoPalomita />
        {VERIFICACION.conforme}
      </button>
      <button
        type="button"
        className={estilos.bmal}
        disabled={deshabilitados}
        onClick={() => onMarcar('desacuerdo')}
      >
        <IconoCruz />
        {VERIFICACION.desacuerdo}
      </button>
    </div>
  );
}

/**
 * «Tu verificación». El servidor decide si se puede marcar (`puedeMarcar`); la
 * pantalla solo lo refleja. Un caso reabierto no se marca: una sola línea.
 */
export function Verificacion({
  caso,
  permisoVerificar,
  confirmadaPorMi,
  cambiando,
  enVuelo,
  error,
  onMarcar,
  onCambiar,
}: VerificacionProps) {
  const marcado = caso.marca !== 'pendiente';
  const cuando =
    caso.marcadaPor !== null && caso.marcadaAt !== null
      ? `${caso.marcadaPor} · ${instanteCorto(caso.marcadaAt)}`
      : null;

  let cuerpo;
  if (caso.reabierta) {
    cuerpo = <span className={estilos.apoyo}>{VERIFICACION.reabierta}</span>;
  } else {
    cuerpo = (
      <>
        {marcado && caso.marca === 'conforme' ? (
          <Aviso
            tono="ok"
            titulo={VERIFICACION.marcadoConforme}
            detalles={cuando === null ? [] : [cuando]}
          />
        ) : null}
        {marcado && caso.marca === 'desacuerdo' ? (
          <>
            <Aviso
              tono="ambar"
              icono="desacuerdo"
              titulo={VERIFICACION.marcadoDesacuerdo}
              detalles={[
                ...(cuando === null ? [] : [cuando]),
                VERIFICACION.desacuerdoNoReabre,
              ]}
            />
            <Link
              className={estilos.enlace}
              to={`/casos/${encodeURIComponent(caso.movimientoId)}`}
            >
              {VERIFICACION.enlaceDetalle}
            </Link>
          </>
        ) : null}
        {caso.puedeMarcar && (!marcado || cambiando) ? (
          <>
            <Botones deshabilitados={enVuelo} onMarcar={onMarcar} />
            <span className={estilos.apoyo}>{VERIFICACION.nota}</span>
          </>
        ) : null}
        {caso.puedeMarcar && marcado && !cambiando ? (
          <div>
            <Button variante="secundario" onClick={onCambiar}>
              {VERIFICACION.cambiar}
            </Button>
          </div>
        ) : null}
        {!caso.puedeMarcar && !marcado && !permisoVerificar ? (
          <span className={estilos.apoyo}>{VERIFICACION.soloVer}</span>
        ) : null}
        {!caso.puedeMarcar && !marcado && permisoVerificar ? (
          <>
            {confirmadaPorMi ? (
              <Aviso
                tono="ambar"
                titulo={VERIFICACION.propia.titulo}
                detalles={[VERIFICACION.propia.detalle]}
              />
            ) : null}
            <Botones deshabilitados onMarcar={onMarcar} />
          </>
        ) : null}
      </>
    );
  }

  const aviso = error === null ? null : ERRORES_MARCA[error];
  return (
    <div className={estilos.verificacion}>
      <span className={estilos.rotulo}>{VERIFICACION.titulo}</span>
      {cuerpo}
      {aviso === null ? null : (
        <AlertaError titulo={aviso.titulo} detalle={aviso.detalle} />
      )}
    </div>
  );
}
