import { Button } from '@/shared/ui/Button';
import { Monto } from '@/shared/ui/Monto';
import type { EstadoBandeja } from '@/shared/dominio/bandeja';
import { MONEDA_BASE } from '@/features/bandeja/constantes';
import {
  KPI,
  KPI_MONTO,
  KPI_MONTO_UNA_MONEDA,
  KPI_MONTO_VARIAS_MONEDAS,
  KPI_NO_DISPONIBLE,
  KPI_NO_DISPONIBLE_OCULTO,
  REINTENTAR,
} from '@/features/bandeja/textos';
import estilos from './KpiBandeja.module.css';

export interface MontoPorMoneda {
  moneda: string;
  /** Decimal en cadena tal como lo envía la API. Nunca un `number`. */
  monto: string;
}

export interface KpiBandejaProps {
  estado: 'cargando' | 'error' | 'listo';
  /** Solo con `estado="listo"`. */
  conteos?: Readonly<Record<EstadoBandeja, number>>;
  /** Solo con `estado="listo"`; vacío significa que no hay nada por revisar. */
  montoPorRevisar?: readonly MontoPorMoneda[];
  onReintentar: () => void;
}

/** Los tres conteos, en el orden del mockup. */
const TILES: readonly EstadoBandeja[] = [
  'sugerencia',
  'sin_match',
  'conciliado',
];

function NoDisponible() {
  return (
    <>
      <span aria-hidden="true">{KPI_NO_DISPONIBLE}</span>
      <span className="solo-lectores">{KPI_NO_DISPONIBLE_OCULTO}</span>
    </>
  );
}

/**
 * Indicadores resumen de la bandeja: tres conteos y el monto por revisar.
 * Presentacional y sin landmark propio. Nunca inventa un cero: en carga muestra
 * un esqueleto y en error un guion con «No disponible» y un solo «Reintentar».
 */
export function KpiBandeja({
  estado,
  conteos,
  montoPorRevisar,
  onReintentar,
}: KpiBandejaProps) {
  const cargando = estado === 'cargando';
  const error = estado === 'error';

  return (
    <div className={estilos.cuadricula} aria-busy={cargando || undefined}>
      {TILES.map((clave) => (
        <div key={clave} className={`${estilos.tile} ${estilos[clave]}`}>
          <span className={estilos.etiqueta}>{KPI[clave].etiqueta}</span>
          {cargando ? (
            <span className={estilos.esqueleto} />
          ) : (
            <span className={estilos.numero}>
              {error || conteos === undefined ? (
                <NoDisponible />
              ) : (
                String(conteos[clave])
              )}
            </span>
          )}
          <span className={estilos.detalle}>{KPI[clave].detalle}</span>
        </div>
      ))}
      <TileMonto
        cargando={cargando}
        error={error}
        montos={montoPorRevisar}
        onReintentar={onReintentar}
      />
    </div>
  );
}

interface TileMontoProps {
  cargando: boolean;
  error: boolean;
  montos: readonly MontoPorMoneda[] | undefined;
  onReintentar: () => void;
}

function TileMonto({ cargando, error, montos, onReintentar }: TileMontoProps) {
  return (
    <div className={`${estilos.tile} ${estilos.tileMonto}`}>
      <span className={estilos.etiqueta}>{KPI_MONTO}</span>
      {cargando ? (
        <span className={estilos.esqueleto} />
      ) : error || montos === undefined ? (
        <>
          <span className={`${estilos.lineaMonto} ${estilos.apagado}`}>
            <NoDisponible />
          </span>
          <Button
            variante="fantasma"
            className={estilos.reintentar}
            onClick={onReintentar}
          >
            {REINTENTAR}
          </Button>
        </>
      ) : (
        <LineasDeMonto montos={montos} />
      )}
    </div>
  );
}

function LineasDeMonto({ montos }: { montos: readonly MontoPorMoneda[] }) {
  const solo =
    montos.length <= 1 && (montos[0]?.moneda ?? MONEDA_BASE) === MONEDA_BASE;
  const lineas =
    montos.length === 0 ? [{ moneda: MONEDA_BASE, monto: '0' }] : montos;
  const variasOExtranjera = !solo;
  return (
    <>
      {lineas.map(({ moneda, monto }) => (
        <span
          key={moneda}
          className={`${estilos.lineaMonto} ${lineas.length > 1 ? estilos.variasLineas : ''}`}
        >
          <Monto
            valor={monto}
            codigoMoneda={variasOExtranjera ? moneda : undefined}
          />
        </span>
      ))}
      <span className={estilos.detalle}>
        {solo ? KPI_MONTO_UNA_MONEDA : KPI_MONTO_VARIAS_MONEDAS}
      </span>
    </>
  );
}
