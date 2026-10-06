import type { ReactNode } from 'react';
import { REGLA_REFERENCIA_MONTO_EXACTO } from '@/shared/dominio';
import { AlertaAccion } from '@/features/caso/components/AlertaAccion';
import { AvisoVarias } from '@/features/caso/components/AvisoVarias';
import { BannerResolucion } from '@/features/caso/components/BannerResolucion';
import { BloqueMovimiento } from '@/features/caso/components/BloqueMovimiento';
import {
  DetallePropuesta,
  type PropuestaDetalle,
} from '@/features/caso/components/DetallePropuesta';
import { EncabezadoCaso } from '@/features/caso/components/EncabezadoCaso';
import { ErrorCaso } from '@/features/caso/components/ErrorCaso';
import { EstadoCargaCaso } from '@/features/caso/components/EstadoCargaCaso';
import {
  Historial,
  type EventoDeHistorial,
} from '@/features/caso/components/Historial';
import {
  ListaPropuestas,
  type PropuestaFila,
} from '@/features/caso/components/ListaPropuestas';
import { PanelDecision } from '@/features/caso/components/PanelDecision';
import { TarjetaConciliado } from '@/features/caso/components/TarjetaConciliado';
import { TarjetaSinMatch } from '@/features/caso/components/TarjetaSinMatch';
import { PROPUESTAS } from '@/features/caso/textos';
import { bannerDe } from '@/features/caso/vista';
import estilos from './KitPage.module.css';

// La pantalla del caso con datos estáticos: sin API, sin consultas y sin
// estado de servidor. Cada `vista` de la maqueta aprobada se ve aquí con las
// mismas piezas que usa el contenedor.

const SIN_ACCION = () => {};
const TOLERANCIA = '0.5000';
const CONFIRMADA_AT = '2026-10-05T10:00:00.000Z';

const MOVIMIENTO = {
  fecha: '2026-09-16',
  descripcion: 'SPEI MATERIALES REYES',
  referencia: 'F-1044',
  monto: '18560.4000',
  moneda: 'MXN',
} as const;

function cfdi(folio: number) {
  return {
    uuidFiscal: `3F2A9C4D-0000-4000-8000-${String(folio).padStart(12, '0')}`,
    serie: 'A',
    folio: String(folio),
    nombreEmisor: 'Materiales Reyes SA de CV',
    fechaEmision: '2026-09-14',
    total: '18560.8000',
    moneda: 'MXN',
    metodoPago: 'PUE',
  };
}

const PROPUESTA: PropuestaDetalle = {
  regla: REGLA_REFERENCIA_MONTO_EXACTO,
  motivo:
    'La referencia coincide con el folio y el monto está dentro de la tolerancia.',
  diferenciaMonto: '0.4000',
  cfdi: cfdi(1044),
};

const FILAS: readonly PropuestaFila[] = [1044, 1045, 1046].map((folio, i) => ({
  conciliacionId: `kit-${i}`,
  regla: REGLA_REFERENCIA_MONTO_EXACTO,
  cfdi: cfdi(folio),
}));

const EVENTOS: readonly EventoDeHistorial[] = [
  {
    id: 'e1',
    accion: 'crear',
    createdAt: '2026-09-16T15:14:00.000Z',
    usuario: null,
  },
  {
    id: 'e2',
    accion: 'confirmar',
    createdAt: CONFIRMADA_AT,
    usuario: { nombre: 'Ana Torres' },
  },
];

const CASO_CONFIRMADO = {
  estado: 'conciliado',
  propuestas: [
    { confirmadaAt: CONFIRMADA_AT, confirmadaPor: { nombre: 'Ana Torres' } },
  ],
} as const;

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className={estilos.columna}>
      <h3 className={estilos.encabezadoTarjeta}>{titulo}</h3>
      {children}
    </div>
  );
}

function Movimiento({ coincide }: { coincide: boolean }) {
  return <BloqueMovimiento {...MOVIMIENTO} referenciaCoincide={coincide} />;
}

interface DecisionProps {
  enviando?: 'confirmar' | 'rechazar' | null;
  deshabilitado?: boolean;
  alerta?: ReactNode;
  motivoInicial?: string;
}

function Decision({
  enviando = null,
  deshabilitado,
  alerta,
  motivoInicial,
}: DecisionProps) {
  return (
    <PanelDecision
      etiquetaCfdi="A-1044"
      enviando={enviando}
      deshabilitado={deshabilitado}
      alerta={alerta}
      motivoInicial={motivoInicial}
      onConfirmar={SIN_ACCION}
      onRechazar={SIN_ACCION}
    />
  );
}

function Propuesta() {
  return (
    <>
      <h2 className={estilos.encabezadoTarjeta}>{PROPUESTAS.titulo}</h2>
      <DetallePropuesta propuesta={PROPUESTA} toleranciaMonto={TOLERANCIA} />
    </>
  );
}

/**
 * Sección «Caso» de la galería: cada estado de la pantalla de detalle (las 14
 * `vista` de la maqueta) y las tres formas del historial.
 */
export function SeccionCaso() {
  const confirmado = bannerDe(
    { accion: 'confirmar', conciliacionId: 'kit-0', rechazadas: 2 },
    CASO_CONFIRMADO,
  );
  const rechazado = bannerDe(
    { accion: 'rechazar', conciliacionId: 'kit-0', rechazadas: 0 },
    { estado: 'sin_match', propuestas: [] },
  );
  return (
    <>
      <Bloque titulo="Vista: sugerencia">
        <EncabezadoCaso
          estado="sugerencia"
          regla={PROPUESTA.regla}
          origen="regla"
          descripcion={MOVIMIENTO.descripcion}
        />
        <Movimiento coincide />
        <Propuesta />
        <Decision />
        <Historial
          eventos={EVENTOS.slice(0, 1)}
          etiquetaCfdi="A-1044"
          pendiente
        />
      </Bloque>
      <Bloque titulo="Vista: varias">
        <EncabezadoCaso
          estado="sugerencia"
          regla={PROPUESTA.regla}
          origen="regla"
          descripcion={MOVIMIENTO.descripcion}
        />
        <Movimiento coincide />
        <Propuesta />
        <AvisoVarias cantidad={FILAS.length} />
        <Decision />
        <ListaPropuestas
          propuestas={FILAS}
          seleccionadaId="kit-0"
          onSeleccionar={SIN_ACCION}
        />
      </Bloque>
      <Bloque titulo="Vista: sin_match">
        <EncabezadoCaso
          estado="sin_match"
          regla={null}
          origen={null}
          descripcion={MOVIMIENTO.descripcion}
        />
        <Movimiento coincide={false} />
        <TarjetaSinMatch
          regla="sin_candidato_monto"
          motivo="Ningún CFDI abierto coincide en referencia y monto dentro de la tolerancia."
        />
        <Historial eventos={[]} etiquetaCfdi={null} pendiente={false} />
      </Bloque>
      <Bloque titulo="Vista: conciliado">
        <EncabezadoCaso
          estado="conciliado"
          regla={PROPUESTA.regla}
          origen="regla"
          descripcion={MOVIMIENTO.descripcion}
        />
        <Movimiento coincide />
        <DetallePropuesta propuesta={PROPUESTA} toleranciaMonto={TOLERANCIA} />
        <TarjetaConciliado usuario="Ana Torres" confirmadaAt={CONFIRMADA_AT} />
        <Historial eventos={EVENTOS} etiquetaCfdi="A-1044" pendiente={false} />
      </Bloque>
      <Bloque titulo="Vista: cargando">
        <EstadoCargaCaso />
      </Bloque>
      <Bloque titulo="Vista: error">
        <ErrorCaso tipo="conexion" onReintentar={SIN_ACCION} />
      </Bloque>
      <Bloque titulo="Vista: no_encontrado">
        <ErrorCaso tipo="no_encontrado" />
      </Bloque>
      <Bloque titulo="Vista: contrato">
        <ErrorCaso tipo="contrato" onReintentar={SIN_ACCION} />
      </Bloque>
      <Bloque titulo="Vista: enviando">
        <Decision enviando="confirmar" />
      </Bloque>
      <Bloque titulo="Vista: conflicto">
        <Decision
          deshabilitado
          alerta={<AlertaAccion tipo="conflicto" onRecargar={SIN_ACCION} />}
        />
      </Bloque>
      <Bloque titulo="Vista: sin_permiso">
        <Decision alerta={<AlertaAccion tipo="segregacion" />} />
        <ErrorCaso tipo="sin_permiso" />
      </Bloque>
      <Bloque titulo="Vista: rechazo_largo">
        <Decision motivoInicial={'x'.repeat(512)} />
      </Bloque>
      <Bloque titulo="Vista: confirmado">
        <BannerResolucion {...confirmado} />
        <TarjetaConciliado usuario="Ana Torres" confirmadaAt={CONFIRMADA_AT} />
      </Bloque>
      <Bloque titulo="Vista: rechazado">
        <BannerResolucion {...rechazado} />
        <TarjetaSinMatch regla={null} motivo={null} />
      </Bloque>
      <Bloque titulo="Historial: con eventos">
        <Historial eventos={EVENTOS} etiquetaCfdi="A-1044" pendiente={false} />
      </Bloque>
      <Bloque titulo="Historial: vacío">
        <Historial eventos={[]} etiquetaCfdi={null} pendiente={false} />
      </Bloque>
      <Bloque titulo="Historial: con error">
        <Historial
          eventos={[]}
          etiquetaCfdi={null}
          pendiente={false}
          fallo
          onReintentar={SIN_ACCION}
        />
      </Bloque>
    </>
  );
}
