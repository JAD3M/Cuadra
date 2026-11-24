import type {
  CondicionCierrePlataforma,
  DesacuerdoPlataforma,
  FraccionesPlataforma,
} from '@/shared/api/contratos/plataforma';
import { formatearPuntos, formatearTasa } from '@/features/medicion/formato';
import { TEXTOS_MEDICION_PLATAFORMA as T } from './textos';

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

export interface CriterioVista {
  clave: 'propuestas' | 'empresas' | 'meses' | 'tasa';
  nombre: string;
  nota: string;
  /** «≥ 1,000» o «≤ 0.50 %». */
  pide: string;
  hoy: string;
  /** Cuánto falta, o «Dentro del límite» / «Sin casos todavía» en la tasa. */
  falta: string;
  /** Lo dice el servidor; aquí no se recalcula. */
  cumple: boolean;
}

export interface MedidaTasaVista {
  /** «4.95 %», o «—» si no hay tasa. */
  tasa: string;
  detalle: string;
  /** El servidor dice que la condición usa esta medida. */
  usada: boolean;
}

export interface CondicionVista {
  cumple: boolean;
  /** Qué falta, en una frase; vacío si se cumple. */
  resumen: string;
  criterios: CriterioVista[];
  registradas: MedidaTasaVista;
  muestra: MedidaTasaVista;
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
      condicion: CondicionVista;
    };

interface Lectura<T> {
  cargando: boolean;
  error: boolean;
  datos: readonly T[] | undefined;
}

interface LecturaUnica<T> {
  cargando: boolean;
  error: boolean;
  datos: T | undefined;
}

export interface EntradaVistaPlataforma {
  desacuerdo: Lectura<DesacuerdoPlataforma>;
  fracciones: Lectura<FraccionesPlataforma>;
  condicion: LecturaUnica<CondicionCierrePlataforma>;
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

const SIN_TASA = '—';

/** Entero con comas de millar («1,240»). Son conteos, no dinero. */
function entero(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function plural(n: number, [uno, varios]: readonly [string, string]): string {
  return `${entero(n)} ${n === 1 ? uno : varios}`;
}

function tasaTexto(tasa: string | null): string {
  return (tasa === null ? null : formatearTasa(tasa)) ?? SIN_TASA;
}

function medida(
  m: CondicionCierrePlataforma['tasa']['registradas'],
  unidad: readonly [string, string],
  sinCasos: string,
  usada: boolean,
): MedidaTasaVista {
  return {
    tasa: tasaTexto(m.tasa),
    detalle:
      m.casos === 0
        ? sinCasos
        : `${plural(m.desacuerdos, T.unidadDesacuerdo)} en ${plural(m.casos, unidad)}`,
    usada,
  };
}

/**
 * Da forma a lo que el servidor decidió: ni umbrales ni comparaciones propias.
 * Todo texto sale de los campos de la API; las tasas se desplazan como texto.
 */
function condicionVista(c: CondicionCierrePlataforma): CondicionVista {
  const { criterios, tasa } = c;
  const supera = tasa.exceso !== null && tasa.exceso !== '0.0000';
  const maxima = tasaTexto(tasa.maxima);
  const fila = (
    clave: 'propuestas' | 'empresas' | 'meses',
    nombre: string,
    nota: string,
  ): CriterioVista => ({
    clave,
    nombre,
    nota,
    pide: `≥ ${entero(criterios[clave].pide)}`,
    hoy: entero(criterios[clave].hoy),
    falta: entero(criterios[clave].falta),
    cumple: criterios[clave].cumple,
  });
  let faltaTasa: string = T.faltaSinCasos;
  if (tasa.cumple) faltaTasa = T.faltaDentroDelLimite;
  else if (supera)
    faltaTasa = T.deMas(formatearPuntos(tasa.exceso ?? '') ?? SIN_TASA);

  const faltan = [
    criterios.propuestas.cumple
      ? null
      : plural(criterios.propuestas.falta, T.unidadPropuesta),
    criterios.empresas.cumple
      ? null
      : plural(criterios.empresas.falta, T.unidadEmpresa),
    criterios.meses.cumple ? null : plural(criterios.meses.falta, T.unidadMes),
  ].filter((p): p is string => p !== null);
  const partes: string[] = [];
  if (faltan.length > 0) {
    const ultimo = faltan[faltan.length - 1] ?? '';
    const lista =
      faltan.length === 1
        ? ultimo
        : `${faltan.slice(0, -1).join(', ')} y ${ultimo}`;
    partes.push(T.resumenFalta(lista));
  }
  if (!tasa.cumple) {
    partes.push(supera ? T.resumenSupera(maxima) : T.resumenSinTasa);
  }
  const sinNada =
    criterios.propuestas.hoy === 0 &&
    tasa.registradas.casos === 0 &&
    tasa.muestra.casos === 0;
  let resumen = '';
  if (!c.cumple) {
    if (sinNada) resumen = T.resumenSinDatos;
    else {
      const frase = partes.join(', y ');
      resumen = `${frase.charAt(0).toUpperCase()}${frase.slice(1)}.`;
    }
  }
  return {
    cumple: c.cumple,
    resumen,
    criterios: [
      fila('propuestas', T.criterioPropuestas, T.criterioPropuestasNota),
      fila('empresas', T.criterioEmpresas, T.criterioEmpresasNota),
      fila('meses', T.criterioMeses, T.criterioMesesNota),
      {
        clave: 'tasa',
        nombre: T.criterioTasa,
        nota: T.criterioTasaNota,
        pide: `≤ ${maxima}`,
        hoy: tasaTexto(tasa.tasaUsada),
        falta: faltaTasa,
        cumple: tasa.cumple,
      },
    ],
    registradas: medida(
      tasa.registradas,
      T.unidadPropuestaTratada,
      T.sinPropuestasTratadas,
      tasa.usada === 'registradas',
    ),
    muestra: medida(
      tasa.muestra,
      T.unidadCasoVerificado,
      T.sinCasosVerificados,
      tasa.usada === 'muestra',
    ),
  };
}

/**
 * Deriva la vista de las tres lecturas. Un fallo de cualquiera gana sobre la
 * carga de las otras; hasta que las tres llegan, la pantalla está cargando. Solo
 * da forma: ni umbrales ni estados propios, el servidor decide.
 */
export function vistaMedicionPlataforma({
  desacuerdo,
  fracciones,
  condicion,
}: EntradaVistaPlataforma): VistaMedicionPlataforma {
  if (desacuerdo.error || fracciones.error || condicion.error)
    return { tipo: 'error' };
  if (
    desacuerdo.cargando ||
    fracciones.cargando ||
    condicion.cargando ||
    desacuerdo.datos === undefined ||
    fracciones.datos === undefined ||
    condicion.datos === undefined
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
    condicion: condicionVista(condicion.datos),
  };
}
