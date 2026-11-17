import { nombreDeBanco } from '@/features/plataforma/nombreDeBanco';
import { TEXTOS_MEDICION_PLATAFORMA as T } from '@/features/plataforma/textos';
import { Tabla, Td, Th } from '@/shared/ui/Tabla';
import estilos from './MedicionPlataforma.module.css';

/** Fila de la tabla. Tipo propio: los componentes no importan la API. */
export interface FilaDesacuerdo {
  clave: string;
  razonSocial: string;
  /** Id del banco; `null` si no se conoce. */
  banco: string | null;
  propuestas: number;
  tratadas: number;
  desacuerdos: number;
  /** Tasa ya formateada («4.00 %»); `null` si no hay propuestas tratadas. */
  tasa: string | null;
}

export interface TablaDesacuerdoProps {
  filas: readonly FilaDesacuerdo[];
}

/**
 * «Tasa de desacuerdo» por empresa y banco. La muestra se enseña con las
 * columnas «Propuestas» y «Tratadas», para que un porcentaje alto con pocos
 * casos no engañe; la pantalla no fija ningún umbral.
 */
export function TablaDesacuerdo({ filas }: TablaDesacuerdoProps) {
  return (
    <div className={estilos.tabla}>
      <Tabla titulo={T.desacuerdoTabla}>
        <thead>
          <tr>
            <Th>{T.columnaEmpresa}</Th>
            <Th>{T.columnaBanco}</Th>
            <Th numerica>{T.columnaPropuestas}</Th>
            <Th numerica>{T.columnaTratadas}</Th>
            <Th numerica>{T.columnaDesacuerdos}</Th>
            <Th numerica>{T.columnaTasa}</Th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.clave}>
              <Td>{fila.razonSocial}</Td>
              <Td>
                {fila.banco === null ? T.sinBanco : nombreDeBanco(fila.banco)}
              </Td>
              <Td numerica className={estilos.cifra}>
                {fila.propuestas}
              </Td>
              <Td numerica className={estilos.cifra}>
                {fila.tratadas}
              </Td>
              <Td numerica className={estilos.cifra}>
                {fila.desacuerdos}
              </Td>
              <Td numerica className={estilos.cifra}>
                {fila.tasa === null ? (
                  <span className={estilos.ausente} title={T.sinTasaTitulo}>
                    {T.sinTasa}
                  </span>
                ) : (
                  <span className={estilos.porcentaje}>{fila.tasa}</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    </div>
  );
}
