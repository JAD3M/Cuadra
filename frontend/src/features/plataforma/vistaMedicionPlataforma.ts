import type {
  DesacuerdoPlataforma,
  FraccionesPlataforma,
} from '@/shared/api/contratos/plataforma';
import { formatearTasa } from '@/features/medicion/formato';

export interface FilaDesacuerdoVista {
  /** Identifica la fila: empresa y banco (o ninguno). */
  clave: string;
  razonSocial: string;
  /** Id del banco tal como lo manda la API; `null` si no se conoce. */
  banco: string | null;
  propuestas: number;
  tratadas: number;
  desacuerdos: number;
  /** «4.00 %», o `null` si no hay tasa que mostrar. */
  tasa: string | null;
}

export interface FraccionVista {
  /** Porcentaje ya formateado, o `null` si el total es 0. */
  porcentaje: string | null;
  n: number;
  de: number;
}

export interface FilaFraccionesVista {
  companyId: string;
  razonSocial: string;
  ppd: FraccionVista;
  parcialidades: FraccionVista;
  comisiones: FraccionVista;
}

/** Lo que muestra la pantalla de medición de la plataforma. */
export type VistaMedicionPlataforma =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | {
      tipo: 'listo';
      /** Vacía si ninguna empresa tiene propuestas: sale el aviso «sin datos». */
      desacuerdo: FilaDesacuerdoVista[];
      fracciones: FilaFraccionesVista[];
    };

interface Lectura<T> {
  cargando: boolean;
  error: boolean;
  datos: readonly T[] | undefined;
}

export interface EntradaVistaPlataforma {
  desacuerdo: Lectura<DesacuerdoPlataforma>;
  fracciones: Lectura<FraccionesPlataforma>;
}

function fraccion(texto: string | null, n: number, de: number): FraccionVista {
  // Un valor que no es una fracción válida se trata como ausente: nunca se
  // inventa ni se pasa por flotante.
  return {
    porcentaje: texto === null ? null : formatearTasa(texto),
    n,
    de,
  };
}

/**
 * Deriva la vista de las dos lecturas. Un fallo de cualquiera gana sobre la
 * carga de la otra; hasta que las dos llegan, la pantalla está cargando. Solo
 * da forma: ni umbrales ni estados propios, el servidor decide.
 */
export function vistaMedicionPlataforma({
  desacuerdo,
  fracciones,
}: EntradaVistaPlataforma): VistaMedicionPlataforma {
  if (desacuerdo.error || fracciones.error) return { tipo: 'error' };
  if (
    desacuerdo.cargando ||
    fracciones.cargando ||
    desacuerdo.datos === undefined ||
    fracciones.datos === undefined
  ) {
    return { tipo: 'cargando' };
  }
  return {
    tipo: 'listo',
    desacuerdo: desacuerdo.datos.map((f) => ({
      clave: `${f.companyId}/${f.banco ?? ''}`,
      razonSocial: f.razonSocial,
      banco: f.banco,
      propuestas: f.propuestas,
      tratadas: f.tratadas,
      desacuerdos: f.desacuerdos,
      tasa: f.tasa === null ? null : formatearTasa(f.tasa),
    })),
    fracciones: fracciones.datos.map((f) => ({
      companyId: f.companyId,
      razonSocial: f.razonSocial,
      ppd: fraccion(f.fraccionPpd, f.facturas.ppd, f.facturas.total),
      parcialidades: fraccion(
        f.fraccionParcialidades,
        f.movimientos.parcialidades,
        f.movimientos.total,
      ),
      comisiones: fraccion(
        f.fraccionComisiones,
        f.movimientos.comisiones,
        f.movimientos.total,
      ),
    })),
  };
}
