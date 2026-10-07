import type { ReactNode } from 'react';
import { EstadoVacio } from '@/features/bandeja/components/EstadoVacio';
import { ErrorBandeja } from '@/features/bandeja/components/ErrorBandeja';
import { FiltrosEstado } from '@/features/bandeja/components/FiltrosEstado';
import { KpiBandeja } from '@/features/bandeja/components/KpiBandeja';
import {
  TablaBandeja,
  type FilaTabla,
} from '@/features/bandeja/components/TablaBandeja';
import { PREFIJO_MOTIVO_SIMULADO } from '@/features/bandeja/ia';
import { ERROR_CONEXION, ERROR_SIN_PERMISO } from '@/features/bandeja/textos';
import { Paginacion } from '@/shared/ui/Paginacion';
import estilos from './KitPage.module.css';

const SIN_ACCION = () => {};

const CONTEOS = { conciliado: 41, sugerencia: 26, sin_match: 13 } as const;
const MONTO_UNA_MONEDA = [{ moneda: 'MXN', monto: '138990.4000' }] as const;
const MONTO_VARIAS_MONEDAS = [
  { moneda: 'MXN', monto: '136840.4000' },
  { moneda: 'USD', monto: '2150.0000' },
] as const;

function cfdi(n: number, serie: string | null, folio: string | null) {
  return {
    uuidFiscal: `3F2A9C4D-0000-4000-8000-${String(n).padStart(12, '0')}`,
    serie,
    folio,
  };
}

/** Filas de ejemplo: cada estado, otra moneda, un centavo de diferencia y la IA. */
const FILAS: readonly FilaTabla[] = [
  {
    movimientoId: 'kit-1',
    fecha: '2026-09-28',
    descripcion: 'SPEI recibido Ferretería Industrial del Centro',
    referencia: 'F-2291',
    monto: '18450.0000',
    moneda: 'MXN',
    estado: 'sugerencia',
    regla: 'referencia_monto_exacto',
    motivo: null,
    mejorPropuesta: { diferenciaMonto: '-40.0000', cfdi: cfdi(1, 'A', '1042') },
  },
  {
    movimientoId: 'kit-2',
    fecha: '2026-09-27',
    descripcion: 'Cargo sin identificar',
    referencia: null,
    monto: '9800.0000',
    moneda: 'MXN',
    estado: 'sin_match',
    regla: 'sin_candidato_monto',
    motivo: null,
    mejorPropuesta: null,
  },
  {
    movimientoId: 'kit-3',
    fecha: '2026-09-26',
    descripcion: 'Liquidación de contrato marco',
    referencia: 'REF-77',
    monto: '5200.0000',
    moneda: 'MXN',
    estado: 'conciliado',
    regla: null,
    motivo: null,
    mejorPropuesta: { diferenciaMonto: '0.0000', cfdi: cfdi(3, 'B', '88') },
  },
  {
    movimientoId: 'kit-4',
    fecha: '2026-09-25',
    descripcion: 'Pago de proveedor extranjero',
    referencia: 'INV-204',
    monto: '2150.0000',
    moneda: 'USD',
    estado: 'sugerencia',
    regla: 'monto_unico',
    motivo: null,
    mejorPropuesta: { diferenciaMonto: '0.0000', cfdi: cfdi(4, null, null) },
  },
  {
    movimientoId: 'kit-5',
    fecha: '2026-09-24',
    descripcion: 'Depósito con diferencia menor a un centavo',
    referencia: null,
    monto: '1160.0000',
    moneda: 'MXN',
    estado: 'sugerencia',
    regla: 'monto_unico',
    motivo: null,
    mejorPropuesta: { diferenciaMonto: '0.0040', cfdi: cfdi(5, 'A', '1043') },
  },
  {
    movimientoId: 'kit-6',
    fecha: '2026-09-23',
    descripcion: 'Sugerencia de un modelo de lenguaje',
    referencia: null,
    monto: '860.0000',
    moneda: 'MXN',
    estado: 'sugerencia',
    regla: 'llm_sugerencia',
    motivo: 'Sugerencia de IA: El importe y el concepto coinciden con el CFDI.',
    mejorPropuesta: { diferenciaMonto: '0.0000', cfdi: cfdi(6, 'A', '1044') },
  },
  {
    movimientoId: 'kit-7',
    fecha: '2026-09-22',
    descripcion: 'Sugerencia del proveedor simulado',
    referencia: null,
    monto: '430.0000',
    moneda: 'MXN',
    estado: 'sugerencia',
    regla: 'llm_sugerencia',
    motivo: `${PREFIJO_MOTIVO_SIMULADO} Coincide el monto y la fecha.`,
    mejorPropuesta: { diferenciaMonto: '0.0000', cfdi: cfdi(7, 'A', '1045') },
  },
];

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className={estilos.columna}>
      <h3 className={estilos.encabezadoTarjeta}>{titulo}</h3>
      {children}
    </div>
  );
}

/**
 * Sección «Bandeja» de la galería: las piezas de la pantalla con datos
 * estáticos, sin API. Cada estado de la maqueta se ve aquí sin pasar por el
 * servidor.
 */
export function SeccionBandeja() {
  return (
    <>
      <Bloque titulo="Indicadores: listos">
        <KpiBandeja
          estado="listo"
          conteos={CONTEOS}
          montoPorRevisar={MONTO_UNA_MONEDA}
          onReintentar={SIN_ACCION}
        />
        <KpiBandeja
          estado="listo"
          conteos={CONTEOS}
          montoPorRevisar={MONTO_VARIAS_MONEDAS}
          onReintentar={SIN_ACCION}
        />
      </Bloque>
      <Bloque titulo="Indicadores: cargando y con fallo">
        <KpiBandeja estado="cargando" onReintentar={SIN_ACCION} />
        <KpiBandeja estado="error" onReintentar={SIN_ACCION} />
      </Bloque>
      <Bloque titulo="Filtros: por defecto y último chip activo">
        <FiltrosEstado
          estados={['sugerencia', 'sin_match']}
          onAlternar={SIN_ACCION}
        />
        <FiltrosEstado estados={['conciliado']} onAlternar={SIN_ACCION} />
      </Bloque>
      <Bloque titulo="Tabla de movimientos">
        <TablaBandeja filas={FILAS} />
      </Bloque>
      <Bloque titulo="Tabla: cargando">
        <TablaBandeja filas={[]} cargando />
      </Bloque>
      <Bloque titulo="Paginación: primera, intermedia y última">
        <Paginacion pagina={1} total={100} limite={20} onIr={SIN_ACCION} />
        <Paginacion pagina={3} total={100} limite={20} onIr={SIN_ACCION} />
        <Paginacion pagina={5} total={100} limite={20} onIr={SIN_ACCION} />
      </Bloque>
      <Bloque titulo="Vacío, error y permiso denegado">
        <EstadoVacio conFiltros onRestablecer={SIN_ACCION} />
        <EstadoVacio conFiltros={false} onRestablecer={SIN_ACCION} />
        <ErrorBandeja
          titulo={ERROR_CONEXION.titulo}
          detalle={ERROR_CONEXION.detalle}
          onReintentar={SIN_ACCION}
        />
        <ErrorBandeja
          titulo={ERROR_SIN_PERMISO.titulo}
          detalle={ERROR_SIN_PERMISO.detalle}
        />
      </Bloque>
    </>
  );
}
