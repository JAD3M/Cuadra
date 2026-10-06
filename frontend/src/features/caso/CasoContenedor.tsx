import { useState } from 'react';
import { REGLA_REFERENCIA_MONTO_EXACTO } from '@/shared/dominio';
import { AvisoVarias } from './components/AvisoVarias';
import { BloqueMovimiento } from './components/BloqueMovimiento';
import { DetallePropuesta } from './components/DetallePropuesta';
import { EncabezadoCaso } from './components/EncabezadoCaso';
import { ListaPropuestas } from './components/ListaPropuestas';
import { TarjetaConciliado } from './components/TarjetaConciliado';
import { TarjetaSinMatch } from './components/TarjetaSinMatch';
import estilos from './CasoContenedor.module.css';
import { CARGANDO_CASO, PROPUESTAS } from './textos';
import { useCaso } from './useCaso';
import { derivarVista, propuestaSeleccionada, vistaDeLectura } from './vista';

export interface CasoContenedorProps {
  movimientoId: string;
}

/**
 * Contenedor del detalle: lee el caso, deriva la vista del estado que devolvió
 * el servidor y compone los componentes de presentación. Por ahora cubre la
 * carga y las variantes con propuestas; las demás vistas se agregan por
 * rebanadas.
 */
export function CasoContenedor({ movimientoId }: CasoContenedorProps) {
  const consulta = useCaso(movimientoId);
  const [seleccion, setSeleccion] = useState<string | null>(null);

  if (vistaDeLectura(consulta) === 'cargando') {
    return (
      <div role="status" aria-busy="true">
        <span className="solo-lectores">{CARGANDO_CASO}</span>
      </div>
    );
  }
  const caso = consulta.data;
  if (caso === undefined) return null;

  const vista = derivarVista(caso);
  const expandida = propuestaSeleccionada(caso.propuestas, seleccion);
  const conPropuestas = vista === 'sugerencia' || vista === 'varias';

  return (
    <div className={estilos.pagina}>
      <EncabezadoCaso
        estado={caso.estado}
        regla={expandida?.regla ?? null}
        origen={expandida?.origen ?? null}
        descripcion={caso.movimiento.descripcion}
      />
      <BloqueMovimiento
        fecha={caso.movimiento.fecha}
        descripcion={caso.movimiento.descripcion}
        referencia={caso.movimiento.referencia}
        monto={caso.movimiento.monto}
        moneda={caso.movimiento.moneda}
        referenciaCoincide={expandida?.regla === REGLA_REFERENCIA_MONTO_EXACTO}
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
  );
}
