import { TEXTOS_MEDICION_PLATAFORMA as T } from '@/features/plataforma/textos';
import { Tabla, Td, Th } from '@/shared/ui/Tabla';
import estilos from './MedicionPlataforma.module.css';

export interface FraccionFila {
  /** Porcentaje ya formateado («25.00 %»); `null` si el total es 0. */
  porcentaje: string | null;
  n: number;
  de: number;
}

/** Fila de la tabla. Tipo propio: los componentes no importan la API. */
export interface FilaFracciones {
  companyId: string;
  razonSocial: string;
  ppd: FraccionFila;
  parcialidades: FraccionFila;
  comisiones: FraccionFila;
}

export interface TablaFraccionesProps {
  filas: readonly FilaFracciones[];
}

function Celda({
  fraccion,
  conteo,
  sinTotal,
}: {
  fraccion: FraccionFila;
  conteo: (n: number, de: number) => string;
  sinTotal: string;
}) {
  return (
    <Td numerica>
      {fraccion.porcentaje === null ? (
        <>
          <span className={`${estilos.cifra} ${estilos.ausente}`}>
            {T.sinTasa}
          </span>
          <span className={estilos.apoyo}>{sinTotal}</span>
        </>
      ) : (
        <>
          <span className={`${estilos.cifra} ${estilos.porcentaje}`}>
            {fraccion.porcentaje}
          </span>
          <span className={`${estilos.cifra} ${estilos.apoyo}`}>
            {conteo(fraccion.n, fraccion.de)}
          </span>
        </>
      )}
    </Td>
  );
}

/**
 * «Casos difíciles por empresa»: las tres fracciones de cada empresa, cada una
 * con el conteo «N de M» del que sale. Sin total, «—» y qué falta.
 */
export function TablaFracciones({ filas }: TablaFraccionesProps) {
  return (
    <div className={estilos.tabla}>
      <Tabla titulo={T.fraccionesTabla}>
        <thead>
          <tr>
            <Th>{T.columnaEmpresa}</Th>
            <Th numerica>
              {T.columnaPpd}
              <span className={estilos.explicacion}>
                {T.columnaPpdExplicacion}
              </span>
            </Th>
            <Th numerica>{T.columnaParcialidades}</Th>
            <Th numerica>{T.columnaComisiones}</Th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.companyId}>
              <Td>{fila.razonSocial}</Td>
              <Celda
                fraccion={fila.ppd}
                conteo={T.deFacturas}
                sinTotal={T.sinFacturas}
              />
              <Celda
                fraccion={fila.parcialidades}
                conteo={T.deMovimientos}
                sinTotal={T.sinMovimientos}
              />
              <Celda
                fraccion={fila.comisiones}
                conteo={T.deMovimientos}
                sinTotal={T.sinMovimientos}
              />
            </tr>
          ))}
        </tbody>
      </Tabla>
    </div>
  );
}
