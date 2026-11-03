import type { ReactNode } from 'react';
import { TEXTOS_BANCOS } from '@/features/plataforma/textos';
import { nombreDeBanco } from '@/features/plataforma/nombreDeBanco';
import { Button } from '@/shared/ui/Button';
import { EstadoChip } from '@/shared/ui/EstadoChip';
import { Tabla, Td, Th } from '@/shared/ui/Tabla';
import estilos from './TablaBancos.module.css';

/** Fila de la lista. Tipo propio: los componentes no importan la API. */
export interface FilaBanco {
  banco: string;
  aceptadas: number;
  /** Lo que pide el servidor para poder levantar; la pantalla no lo inventa. */
  minimoAceptadas: number;
  levantada: boolean;
  /** Instante ISO; `null` mientras la vista previa sigue obligatoria. */
  levantadaEn: string | null;
}

export interface TablaBancosProps {
  /** Los bancos; `null` mientras carga o si falló (ver `alerta`). */
  bancos: readonly FilaBanco[] | null;
  /** Alerta de fallo ya armada por el contenedor. */
  alerta?: ReactNode;
  /** Pulsó «Levantar vista previa» de un banco que ya cumple el mínimo. */
  onLevantar(banco: FilaBanco): void;
  /** Zona IANA para la fecha; sin ella, la del navegador (las pruebas la fijan). */
  zona?: string;
}

/** `3 nov 2026`. Un valor que no es un instante se muestra tal cual. */
export function formatearFechaCorta(iso: string, zona?: string): string {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return iso;
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: zona,
  })
    .format(instante)
    .replace(/\./g, '')
    .replace(/\s+de\s+/g, ' ');
}

/**
 * Lista «Bancos» del mockup: cargando (barras), con datos (tabla) o fallo
 * (alerta). La acción solo se habilita si las cargas aceptadas alcanzan el
 * mínimo que mandó el servidor; el servidor vuelve a decidirlo al levantar.
 */
export function TablaBancos({
  bancos,
  alerta,
  onLevantar,
  zona,
}: TablaBancosProps) {
  if (bancos === null) {
    const cargando = !alerta;
    return (
      <section
        aria-label={TEXTOS_BANCOS.lista}
        aria-busy={cargando}
        className={estilos.seccion}
      >
        {alerta}
        {cargando && (
          <div className={estilos.cargando} aria-hidden="true">
            <span className={estilos.barra} />
            <span className={estilos.barra} />
          </div>
        )}
      </section>
    );
  }

  return (
    <div className={estilos.tabla}>
      <Tabla titulo={TEXTOS_BANCOS.lista}>
        <thead>
          <tr>
            <Th>{TEXTOS_BANCOS.columnaBanco}</Th>
            <Th className={estilos.sinPartir}>
              {TEXTOS_BANCOS.columnaAceptadas}
            </Th>
            <Th>{TEXTOS_BANCOS.columnaEstado}</Th>
            <Th>{TEXTOS_BANCOS.columnaAcciones}</Th>
          </tr>
        </thead>
        <tbody>
          {bancos.map((fila) => {
            const nombre = nombreDeBanco(fila.banco);
            const faltan = fila.minimoAceptadas - fila.aceptadas;
            return (
              <tr key={fila.banco}>
                <Th scope="row" className={estilos.banco}>
                  {nombre}
                </Th>
                <Td className={estilos.cifra}>{fila.aceptadas}</Td>
                <Td>
                  {fila.levantada ? (
                    <EstadoChip tono="conciliado">
                      {TEXTOS_BANCOS.levantadaEl(
                        fila.levantadaEn === null
                          ? ''
                          : formatearFechaCorta(fila.levantadaEn, zona),
                      ).trim()}
                    </EstadoChip>
                  ) : (
                    <EstadoChip tono="sin_match">
                      {TEXTOS_BANCOS.obligatoria}
                    </EstadoChip>
                  )}
                </Td>
                <Td className={estilos.acciones}>
                  {fila.levantada ? (
                    <span className={estilos.apoyo}>
                      {TEXTOS_BANCOS.sinAcciones}
                    </span>
                  ) : (
                    <div className={estilos.accion}>
                      <Button
                        type="button"
                        variante="secundario"
                        disabled={faltan > 0}
                        aria-label={TEXTOS_BANCOS.etiquetaBoton(nombre)}
                        onClick={() => onLevantar(fila)}
                      >
                        {TEXTOS_BANCOS.boton}
                      </Button>
                      {faltan > 0 && (
                        <span className={estilos.apoyo}>
                          {TEXTOS_BANCOS.faltan(faltan)}
                        </span>
                      )}
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Tabla>
    </div>
  );
}
