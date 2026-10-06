import { useState } from 'react';
import { REGLA_REFERENCIA_MONTO_EXACTO } from '@/shared/dominio';
import { etiquetaCfdi } from '@/features/bandeja/etiquetaCfdi';
import { AvisoVarias } from './components/AvisoVarias';
import { BloqueMovimiento } from './components/BloqueMovimiento';
import { DetallePropuesta } from './components/DetallePropuesta';
import { EncabezadoCaso } from './components/EncabezadoCaso';
import { Historial } from './components/Historial';
import { ListaPropuestas } from './components/ListaPropuestas';
import { TarjetaConciliado } from './components/TarjetaConciliado';
import { TarjetaSinMatch } from './components/TarjetaSinMatch';
import estilos from './CasoContenedor.module.css';
import { CARGANDO_CASO, PROPUESTAS } from './textos';
import { useCaso } from './useCaso';
import { useHistorial } from './useHistorial';
import { derivarVista, propuestaSeleccionada, vistaDeLectura } from './vista';

export interface CasoContenedorProps {
  movimientoId: string;
}

/**
 * Contenedor del detalle: lee el caso, deriva la vista del estado que devolvió
 * el servidor y compone los componentes de presentación. Por ahora cubre la
 * carga, las variantes con propuestas, las de solo lectura y el historial; las
 * demás vistas se agregan por rebanadas.
 */
export function CasoContenedor({ movimientoId }: CasoContenedorProps) {
  const consulta = useCaso(movimientoId);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const caso = consulta.data;
  const expandida =
    caso === undefined
      ? null
      : propuestaSeleccionada(caso.propuestas, seleccion);
  // El historial es el de la propuesta mostrada; un sin_match no tiene.
  const historial = useHistorial(expandida?.conciliacionId ?? null);

  if (vistaDeLectura(consulta) === 'cargando') {
    return (
      <div role="status" aria-busy="true">
        <span className="solo-lectores">{CARGANDO_CASO}</span>
      </div>
    );
  }
  if (caso === undefined) return null;

  const vista = derivarVista(caso);
  const conPropuestas = vista === 'sugerencia' || vista === 'varias';

  return (
    <div className={estilos.pagina}>
      <EncabezadoCaso
        estado={caso.estado}
        regla={expandida?.regla ?? null}
        origen={expandida?.origen ?? null}
        descripcion={caso.movimiento.descripcion}
      />
      <div className={estilos.columnas}>
        <div className={estilos.principal}>
          <BloqueMovimiento
            fecha={caso.movimiento.fecha}
            descripcion={caso.movimiento.descripcion}
            referencia={caso.movimiento.referencia}
            monto={caso.movimiento.monto}
            moneda={caso.movimiento.moneda}
            referenciaCoincide={
              expandida?.regla === REGLA_REFERENCIA_MONTO_EXACTO
            }
          />
          {conPropuestas && expandida !== null ? (
            <div className={estilos.propuestas}>
              <h2 className={estilos.titulo}>{PROPUESTAS.titulo}</h2>
              <AvisoVarias cantidad={caso.propuestas.length} />
              <DetallePropuesta
                propuesta={expandida}
                toleranciaMonto={caso.toleranciaMonto}
              />
              <ListaPropuestas
                propuestas={caso.propuestas}
                seleccionadaId={expandida.conciliacionId}
                onSeleccionar={setSeleccion}
              />
            </div>
          ) : null}
          {vista === 'sin_match' ? (
            <TarjetaSinMatch
              regla={caso.sinMatch?.regla ?? null}
              motivo={caso.sinMatch?.motivo ?? null}
            />
          ) : null}
          {vista === 'conciliado' && expandida !== null ? (
            <>
              <DetallePropuesta
                propuesta={expandida}
                toleranciaMonto={caso.toleranciaMonto}
              />
              <TarjetaConciliado
                usuario={expandida.confirmadaPor?.nombre ?? null}
                confirmadaAt={expandida.confirmadaAt}
              />
            </>
          ) : null}
        </div>
        <Historial
          eventos={historial.data?.datos ?? []}
          etiquetaCfdi={
            expandida === null ? null : etiquetaCfdi(expandida.cfdi)
          }
          pendiente={caso.estado === 'sugerencia'}
          cargando={historial.isLoading}
          fallo={historial.isError && historial.data === undefined}
          onReintentar={() => void historial.refetch()}
        />
      </div>
    </div>
  );
}
