import { formatearInstante } from '@/features/caso/fecha';
import type { CambioTolerancia } from '@/shared/api/contratos';
import { formatearDecimalExacto } from '@/shared/dinero';
import { ROLES_QUE_EDITAN_TOLERANCIA } from '@/shared/dominio';
import type { EstadoCambios, FilaCambio } from './components/TarjetaCambios';
import type { EstadoValor } from './components/TarjetaValor';
import { clasificarErrorGuardado } from './errores';
import { SIN_AUTOR } from './textos';
import {
  esMismoValor,
  validarTolerancia,
  type MotivoInvalido,
} from './validarTolerancia';

// Derivación pura de lo que muestra la pantalla de Tolerancia. Nada se guarda:
// la vista sale siempre del borrador, del valor del servidor y de si hay un
// guardado en curso.

/**
 * Quién ve el formulario: basta un rol de los que cambian la tolerancia. Un
 * usuario con varios roles edita si uno de ellos sirve. Es comodidad: el
 * servidor decide, y un rol viejo se degrada al aviso de «sin permiso» cuando
 * el PUT responde 403.
 */
export const puedeEditar = (roles: readonly string[]): boolean =>
  ROLES_QUE_EDITAN_TOLERANCIA.some((rol) => roles.includes(rol));

export interface EntradaFormulario {
  /** Lo que escribió la persona; `null` mientras el campo siga sin tocar. */
  borrador: string | null;
  /** El valor vigente tal como lo dio el servidor ("0.5000"). */
  actual: string;
  guardando: boolean;
}

export interface FormularioDerivado {
  /** Lo que muestra el campo. */
  texto: string;
  /**
   * Qué ayuda acompaña al campo cuando no hay error: la normal, o «es el valor
   * actual» tras escribir uno igual al vigente.
   */
  ayuda: 'normal' | 'mismo_valor';
  /** Por qué el borrador no vale; `null` si vale (o si aún no se tocó). */
  invalido: MotivoInvalido | null;
  puedeGuardar: boolean;
  /** Lo que se envía en el PUT: el borrador recortado; `null` si no se puede guardar. */
  valorAGuardar: string | null;
}

/**
 * Estado del formulario. Prioridad: inválido, luego igual al vigente, luego la
 * ayuda normal. Con el campo sin tocar se muestra el vigente ya formateado, sin
 * error y sin poder guardar; «es el valor actual» solo sale cuando la persona
 * escribe un valor igual. Mientras guarda no se puede guardar otra vez.
 */
export function derivarFormulario({
  borrador,
  actual,
  guardando,
}: EntradaFormulario): FormularioDerivado {
  if (borrador === null) {
    return {
      // El contrato ya garantiza un decimal válido; el valor crudo es solo una red.
      texto: formatearDecimalExacto(actual) ?? actual,
      ayuda: 'normal',
      invalido: null,
      puedeGuardar: false,
      valorAGuardar: null,
    };
  }

  const resultado = validarTolerancia(borrador);
  if (!resultado.ok) {
    return {
      texto: borrador,
      ayuda: 'normal',
      invalido: resultado.motivo,
      puedeGuardar: false,
      valorAGuardar: null,
    };
  }
  if (esMismoValor(actual, resultado.decimal)) {
    return {
      texto: borrador,
      ayuda: 'mismo_valor',
      invalido: null,
      puedeGuardar: false,
      valorAGuardar: null,
    };
  }
  return {
    texto: borrador,
    ayuda: 'normal',
    invalido: null,
    puedeGuardar: !guardando,
    valorAGuardar: resultado.valor,
  };
}

export interface EntradaValor {
  data: { toleranciaMonto: string } | undefined;
  error: unknown;
}

/**
 * Qué muestra la tarjeta del valor. Con datos siempre hay algo que mostrar: un
 * fallo de segundo plano no esconde el valor ya cargado. Sin datos, el fallo se
 * clasifica como el de un guardado (red -> conexión, 403 -> sin permiso, lo
 * demás, incluida una respuesta fuera de contrato, el genérico); un 400 en una
 * lectura no tiene un copy propio y cae también en el genérico. Un 401 o una
 * cancelación no dicen nada: la capa de sesión los atiende y la tarjeta sigue
 * en carga.
 */
export function vistaValor({ data, error }: EntradaValor): EstadoValor {
  if (data !== undefined) return { tipo: 'listo', valor: data.toleranciaMonto };
  if (error === null || error === undefined) return { tipo: 'cargando' };
  const clase = clasificarErrorGuardado(error);
  if (clase === null) return { tipo: 'cargando' };
  return {
    tipo: 'error',
    clase: clase === 'rechazo' ? 'otro' : clase,
  };
}

/** `$` y el decimal exacto; el valor crudo es solo una red, el contrato ya lo valida. */
const montoExacto = (valor: string): string =>
  `$${formatearDecimalExacto(valor) ?? valor}`;

/**
 * Filas de la lista de cambios, en el orden que dio el servidor (más nuevo
 * primero). Los montos van exactos y sin redondear; sin usuario, el autor es
 * una raya; la fecha es `YYYY-MM-DD HH:mm` del instante (`zona` la inyectan las
 * pruebas). Solo la primera fila es la reciente.
 */
export function filasDeCambios(
  cambios: readonly CambioTolerancia[],
  zona?: string,
): FilaCambio[] {
  return cambios.map((cambio, indice) => ({
    id: cambio.id,
    antes: montoExacto(cambio.datos.antes),
    despues: montoExacto(cambio.datos.despues),
    quien: cambio.usuario?.nombre ?? SIN_AUTOR,
    fecha: formatearInstante(cambio.createdAt, zona),
    reciente: indice === 0,
  }));
}

export interface EntradaCambios {
  data: readonly CambioTolerancia[] | undefined;
  error: unknown;
}

/**
 * Qué muestra la tarjeta de cambios. Con datos siempre hay algo que mostrar: un
 * fallo de segundo plano no esconde la lista. Sin datos, el fallo se clasifica
 * como el del valor (red -> conexión, 403 -> sin permiso, lo demás el
 * genérico); un 401 o una cancelación no dicen nada y la tarjeta sigue en
 * carga. Una lista vacía tras filtrar es el estado vacío.
 */
export function vistaCambios(
  { data, error }: EntradaCambios,
  zona?: string,
): EstadoCambios {
  if (data !== undefined) {
    return data.length === 0
      ? { tipo: 'vacio' }
      : { tipo: 'lista', filas: filasDeCambios(data, zona) };
  }
  if (error === null || error === undefined) return { tipo: 'cargando' };
  const clase = clasificarErrorGuardado(error);
  if (clase === null) return { tipo: 'cargando' };
  return { tipo: 'error', clase: clase === 'rechazo' ? 'otro' : clase };
}
