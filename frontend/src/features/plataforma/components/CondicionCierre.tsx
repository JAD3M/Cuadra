import { TEXTOS_MEDICION_PLATAFORMA as T } from '@/features/plataforma/textos';
import type {
  CondicionVista,
  MedidaTasaVista,
} from '@/features/plataforma/vistaMedicionPlataforma';
import { Tabla, Td, Th } from '@/shared/ui/Tabla';
import estilos from './MedicionPlataforma.module.css';

export interface CondicionCierreProps {
  condicion: CondicionVista;
}

function IconoCumple() {
  return (
    <svg
      width="20"
      height="20"
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
  );
}

function IconoAdvertencia() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </svg>
  );
}

function IconoInfo() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </svg>
  );
}

function Medida({
  id,
  nombre,
  medida,
}: {
  id: string;
  nombre: string;
  medida: MedidaTasaVista;
}) {
  return (
    <div role="group" aria-labelledby={id} className={estilos.medida}>
      <span id={id} className={estilos.medidaNombre}>
        {nombre}
      </span>
      <span className={estilos.medidaTasa}>{medida.tasa}</span>
      <span className={`${estilos.apoyo} ${estilos.apoyoLibre}`}>
        {medida.detalle}
      </span>
      {medida.usada && (
        <span className={estilos.medidaUsada}>{T.medidaUsada}</span>
      )}
    </div>
  );
}

/**
 * Contenido de «Condición para considerar el cierre automático» (historia 9.5).
 * Solo pinta lo que el servidor decidió: no recalcula umbrales ni tasas, y no
 * ofrece ninguna acción, porque el cierre automático no existe en la v2.
 */
export function CondicionCierre({ condicion }: CondicionCierreProps) {
  return (
    <>
      {condicion.cumple ? (
        <div
          role="status"
          className={`${estilos.avisoCondicion} ${estilos.cumple}`}
        >
          <IconoCumple />
          <div className={estilos.avisoTexto}>
            <strong>{T.condicionCumpleTitulo}</strong>
            <span className={estilos.avisoDetalle}>
              {T.condicionCumpleDetalle}
            </span>
          </div>
        </div>
      ) : (
        <div
          role="status"
          className={`${estilos.avisoCondicion} ${estilos.noCumple}`}
        >
          <IconoAdvertencia />
          <div className={estilos.avisoTexto}>
            <strong>{T.condicionNoCumpleTitulo}</strong>
            <span className={estilos.avisoDetalle}>{condicion.resumen}</span>
          </div>
        </div>
      )}

      <div className={estilos.tabla}>
        <Tabla titulo={T.condicionTabla}>
          <thead>
            <tr>
              <Th>{T.columnaCriterio}</Th>
              <Th numerica>{T.columnaSePide}</Th>
              <Th numerica>{T.columnaHoy}</Th>
              <Th numerica>{T.columnaFalta}</Th>
              <Th>{T.columnaEstado}</Th>
            </tr>
          </thead>
          <tbody>
            {condicion.criterios.map((c) => (
              <tr key={c.clave}>
                <Td>
                  {c.nombre}
                  <span className={`${estilos.apoyo} ${estilos.apoyoLibre}`}>
                    {c.nota}
                  </span>
                </Td>
                <Td numerica className={estilos.cifra}>
                  {c.pide}
                </Td>
                <Td numerica className={estilos.cifra}>
                  <span className={estilos.porcentaje}>{c.hoy}</span>
                </Td>
                <Td numerica className={estilos.cifra}>
                  {c.falta}
                </Td>
                <Td
                  className={`${estilos.estado} ${c.cumple ? estilos.estadoCumple : estilos.estadoNoCumple}`}
                >
                  {c.cumple ? T.estadoCumple : T.estadoNoCumple}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </div>

      <div className={estilos.titulos}>
        <h3 className={estilos.subtitulo}>{T.tasasTitulo}</h3>
        <p className={estilos.texto}>{T.tasasDescripcion}</p>
      </div>
      <div className={estilos.tasas}>
        <Medida
          id="medida-registradas"
          nombre={T.medidaRegistradas}
          medida={condicion.registradas}
        />
        <Medida
          id="medida-muestra"
          nombre={T.medidaMuestra}
          medida={condicion.muestra}
        />
      </div>
      <p className={estilos.nota}>{T.notaSinCasos}</p>

      <div
        role="note"
        className={`${estilos.avisoCondicion} ${estilos.informa}`}
      >
        <IconoInfo />
        <div className={estilos.avisoTexto}>
          <strong>{T.soloInformaTitulo}</strong>
          <span className={estilos.avisoDetalle}>{T.soloInformaDetalle}</span>
        </div>
      </div>
    </>
  );
}
