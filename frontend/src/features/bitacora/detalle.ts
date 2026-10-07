import { formatearDecimalExacto } from '@/shared/dinero';
import {
  ACCION_ACCESO_DENEGADO,
  ACCION_ACTUALIZAR,
  ACCION_CONFIRMAR,
  ACCION_CREAR,
  ACCION_RECHAZAR,
  CAMPO_TOLERANCIA,
  MOTIVO_ROL_INSUFICIENTE,
  MOTIVO_SIN_MEMBRESIA,
} from '@/shared/dominio';
import type { AccionBitacora } from '@/shared/dominio';

// Texto de la columna «Detalle» de la bitácora (CU-26, D10). Es una función
// pura que lee SOLO `datos` y la acción; `datos` llega sin tipar porque el
// servidor lo guarda como JSON libre (filas heredadas, otras formas). Cada
// lectura se revisa con `typeof` y nunca lanza: lo que no cumple da «—». Los
// montos son cadenas decimales y pasan únicamente por `formatearDecimalExacto`
// (sin `Number`, sin redondeo): `0.0050` -> `$0.005`, `-60.0000` -> `-$60.00`.
// Las formas de `datos` están en los emisores del backend; ver detalle.test.ts.

/** Lo que sale cuando el evento no trae lo que su acción necesita. */
export const SIN_DETALLE = '—';

type Objeto = Record<string, unknown>;

const esObjeto = (valor: unknown): valor is Objeto =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/** Cadena no vacía, o `undefined`. */
const texto = (valor: unknown): string | undefined =>
  typeof valor === 'string' && valor !== '' ? valor : undefined;

/** `datos[clave].estado` si `datos[clave]` es un objeto con un estado de texto. */
function estadoDe(datos: Objeto, clave: string): string | undefined {
  const bloque = datos[clave];
  return esObjeto(bloque) ? texto(bloque.estado) : undefined;
}

/**
 * `$` + el decimal exacto. El signo va ANTES del símbolo: una diferencia
 * puede ser negativa (`-60.0000` -> `-$60.00`, nunca `$-60.00`). `null` si la
 * cadena no es un decimal válido.
 */
function conSimbolo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const exacto = formatearDecimalExacto(valor);
  if (exacto === null) return null;
  return exacto.startsWith('-') ? `-$${exacto.slice(1)}` : `$${exacto}`;
}

/** ` · diferencia $X`, o nada si `diferenciaMonto` falta o no es un decimal. */
function sufijoDiferencia(datos: Objeto): string {
  const monto = conSimbolo(datos.diferenciaMonto);
  return monto === null ? '' : ` · diferencia ${monto}`;
}

function detalleCrear(datos: Objeto): string {
  const estado = estadoDe(datos, 'despues');
  if (estado === undefined) return SIN_DETALLE;
  const origen = texto(datos.origen);
  const sufijoOrigen = origen === undefined ? '' : ` · origen ${origen}`;
  return `${estado}${sufijoOrigen}${sufijoDiferencia(datos)}`;
}

/** `antes → después`, o `undefined` si falta alguno de los dos estados. */
function flecha(datos: Objeto): string | undefined {
  const antes = estadoDe(datos, 'antes');
  const despues = estadoDe(datos, 'despues');
  return antes === undefined || despues === undefined
    ? undefined
    : `${antes} → ${despues}`;
}

function detalleConfirmar(datos: Objeto): string {
  const cambio = flecha(datos);
  return cambio === undefined ? SIN_DETALLE : cambio + sufijoDiferencia(datos);
}

/**
 * El motivo es texto de la persona (o fijo del sistema); se devuelve tal cual
 * y la tabla lo pinta como texto. Un rechazo causado por otra propuesta
 * confirmada (`datos.causa`) no lleva motivo (D20).
 */
function detalleRechazar(datos: Objeto): string {
  const cambio = flecha(datos);
  if (cambio === undefined) return SIN_DETALLE;
  if (esObjeto(datos.causa)) return cambio;
  const despues = datos.despues;
  const motivo = esObjeto(despues) ? texto(despues.motivo) : undefined;
  return motivo === undefined ? cambio : `${cambio} · motivo: ${motivo}`;
}

/** Solo el cambio de tolerancia tiene redacción (D21): otro campo da «—». */
function detalleActualizar(datos: Objeto): string {
  if (datos.campo !== CAMPO_TOLERANCIA) return SIN_DETALLE;
  const antes = conSimbolo(datos.antes);
  const despues = conSimbolo(datos.despues);
  if (antes === null || despues === null) return SIN_DETALLE;
  return `${CAMPO_TOLERANCIA}: ${antes} → ${despues}`;
}

/** Lista no vacía de roles de texto, o `undefined`. */
function roles(valor: unknown): string[] | undefined {
  if (!Array.isArray(valor) || valor.length === 0) return undefined;
  const lista: string[] = [];
  for (const rol of valor) {
    const nombre = texto(rol);
    if (nombre === undefined) return undefined;
    lista.push(nombre);
  }
  return lista;
}

function detalleAccesoDenegado(datos: Objeto): string {
  const metodo = texto(datos.metodo);
  const ruta = texto(datos.ruta);
  if (metodo === undefined || ruta === undefined) return SIN_DETALLE;
  const peticion = `${metodo} ${ruta}`;

  if (datos.motivo === MOTIVO_SIN_MEMBRESIA) {
    return `${peticion} · sin membresía en la empresa`;
  }
  if (datos.motivo !== MOTIVO_ROL_INSUFICIENTE) return SIN_DETALLE;

  const requeridos = roles(datos.rolesRequeridos);
  const delUsuario = roles(datos.rolesDelUsuario);
  if (requeridos === undefined || delUsuario === undefined) return SIN_DETALLE;
  // La denegación por segregación de funciones también se guarda como
  // `rol_insuficiente`, pero la persona SÍ tiene un rol requerido. Decir
  // «requiere admin o contador, tiene contador» sería falso: se muestra «—».
  if (requeridos.some((rol) => delUsuario.includes(rol))) return SIN_DETALLE;
  return `${peticion} · rol insuficiente: requiere ${requeridos.join(' o ')}, tiene ${delUsuario.join(' y ')}`;
}

/**
 * Detalle de un evento de la bitácora. `eliminar` y `cargar` no se emiten
 * hoy y no tienen redacción: dan «—», igual que cualquier `datos` nulo, que no
 * sea un objeto o al que le falte lo que su acción necesita.
 */
export function detalleEvento({
  accion,
  datos,
}: {
  accion: AccionBitacora;
  datos: unknown;
}): string {
  if (!esObjeto(datos)) return SIN_DETALLE;
  switch (accion) {
    case ACCION_CREAR:
      return detalleCrear(datos);
    case ACCION_CONFIRMAR:
      return detalleConfirmar(datos);
    case ACCION_RECHAZAR:
      return detalleRechazar(datos);
    case ACCION_ACTUALIZAR:
      return detalleActualizar(datos);
    case ACCION_ACCESO_DENEGADO:
      return detalleAccesoDenegado(datos);
    default:
      return SIN_DETALLE;
  }
}

export interface SegmentoDetalle {
  texto: string;
  /** `true` cuando el segmento es un monto (`$0.50`, `-$60.00`). */
  monto: boolean;
}

/** Un monto con símbolo: signo opcional, `$`, dígitos y fracción opcional. */
const MONTO_EN_TEXTO = /(-?\$\d+(?:\.\d+)?)/;

/**
 * Parte el detalle en texto y montos. La tabla pinta cada monto en un `span`
 * sin salto de línea: aunque el detalle se parta por una palabra larga
 * (`overflow-wrap: anywhere`), una cantidad nunca se corta en dos renglones.
 */
export function segmentosDeDetalle(detalle: string): SegmentoDetalle[] {
  return detalle
    .split(MONTO_EN_TEXTO)
    .map((parte, indice) => ({ texto: parte, monto: indice % 2 === 1 }))
    .filter((segmento) => segmento.texto !== '');
}
