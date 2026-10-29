import { formatearDecimalExacto } from '@/shared/dinero';
import {
  ACCION_ACCESO_DENEGADO,
  ACCION_ACTUALIZAR,
  ACCION_CONFIRMAR,
  ACCION_CREAR,
  ACCION_RECHAZAR,
  CAMPO_TOLERANCIA,
  ETIQUETAS_ROL,
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
/** Entero no negativo, o `undefined`. */
const contador = (valor: unknown): number | undefined =>
  typeof valor === 'number' && Number.isInteger(valor) && valor >= 0
    ? valor
    : undefined;

/**
 * Rechazo de un PDF de estado de cuenta (historia 3.3): no es un cambio de
 * estado, así que no hay flecha; lo que hay es archivo, banco, motivo y los
 * conteos de lo leído. Solo habla con un `motivo` de texto.
 */
function detalleRechazoPdf(datos: Objeto): string {
  const motivo = texto(datos.motivo);
  if (motivo === undefined) return SIN_DETALLE;
  const banco = texto(datos.banco);
  const movimientos = contador(datos.movimientosLeidos);
  const lineas = contador(datos.lineasNoLeidas);
  return unir([
    texto(datos.archivo),
    banco === undefined ? undefined : `banco: ${banco}`,
    `motivo: ${motivo}`,
    movimientos === undefined ? undefined : `${movimientos} movimientos leídos`,
    lineas === undefined ? undefined : `${lineas} líneas no leídas`,
  ]);
}

function detalleRechazar(datos: Objeto): string {
  const cambio = flecha(datos);
  if (cambio === undefined) return detalleRechazoPdf(datos);
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

/** ` · permiso: p` si `datos.permiso` es texto; nada si falta o no lo es. */
function sufijoPermiso(datos: Objeto): string {
  const permiso = texto(datos.permiso);
  return permiso === undefined ? '' : ` · permiso: ${permiso}`;
}

function detalleAccesoDenegado(datos: Objeto): string {
  const metodo = texto(datos.metodo);
  const ruta = texto(datos.ruta);
  if (metodo === undefined || ruta === undefined) return SIN_DETALLE;
  const peticion = `${metodo} ${ruta}`;
  const permiso = sufijoPermiso(datos);

  if (datos.motivo === MOTIVO_SIN_MEMBRESIA) {
    return `${peticion} · sin membresía en la empresa${permiso}`;
  }
  if (datos.motivo !== MOTIVO_ROL_INSUFICIENTE) return SIN_DETALLE;

  const requeridos = roles(datos.rolesRequeridos);
  const delUsuario = roles(datos.rolesDelUsuario);
  if (requeridos === undefined || delUsuario === undefined) return SIN_DETALLE;
  // La denegación por segregación de funciones también se guarda como
  // `rol_insuficiente`, pero la persona SÍ tiene un rol requerido. Decir
  // «requiere admin o contador, tiene contador» sería falso: se conserva la
  // petición (y el permiso) sin afirmar nada sobre los roles.
  if (requeridos.some((rol) => delUsuario.includes(rol))) {
    return `${peticion}${permiso}`;
  }
  return `${peticion} · rol insuficiente: requiere ${requeridos.join(' o ')}, tiene ${delUsuario.join(' y ')}${permiso}`;
}

// Acciones de administración (historia 2.7). El correo y los roles salen de
// `datos`; lo que falta o viene mal formado se omite y, sin nada utilizable,
// el detalle es «—». Nunca se inventa un dato (p. ej. el vencimiento de una
// invitación no se guarda en `datos`, así que no se muestra).

/** Roles de texto (la lista puede ir vacía), o `undefined` si no es una lista válida. */
function listaDeRoles(valor: unknown): string[] | undefined {
  if (!Array.isArray(valor)) return undefined;
  const lista: string[] = [];
  for (const rol of valor) {
    const nombre = texto(rol);
    if (nombre === undefined) return undefined;
    lista.push(nombre);
  }
  return lista;
}

/** Etiqueta del rol; un valor que no es un rol conocido sale tal cual vino. */
function etiquetaRol(rol: string): string {
  return Object.hasOwn(ETIQUETAS_ROL, rol)
    ? ETIQUETAS_ROL[rol as keyof typeof ETIQUETAS_ROL]
    : rol;
}

/** `A`, `A y B`, `A, B y C`; «ninguno» si la lista está vacía. */
function unirRoles(lista: string[]): string {
  const nombres = lista.map(etiquetaRol);
  const ultimo = nombres.pop();
  if (ultimo === undefined) return 'ninguno';
  return nombres.length === 0 ? ultimo : `${nombres.join(', ')} y ${ultimo}`;
}

/** Une los fragmentos presentes; «—» si no queda ninguno. */
function unir(partes: Array<string | undefined>): string {
  const presentes = partes.filter((p): p is string => p !== undefined);
  return presentes.length === 0 ? SIN_DETALLE : presentes.join(' · ');
}

/** `roles: A y B`, o `undefined` si faltan o la lista está vacía. */
function fragmentoRoles(valor: unknown, rotulo = 'roles'): string | undefined {
  const lista = listaDeRoles(valor);
  return lista === undefined || lista.length === 0
    ? undefined
    : `${rotulo}: ${unirRoles(lista)}`;
}

function conCorreo(datos: Objeto): string | undefined {
  const email = texto(datos.email);
  return email === undefined ? undefined : `correo: ${email}`;
}

function detalleInvitar(datos: Objeto): string {
  return unir([conCorreo(datos), fragmentoRoles(datos.roles)]);
}

function detalleReenviar(datos: Objeto): string {
  const correo = conCorreo(datos);
  const rolesTexto = fragmentoRoles(datos.roles);
  if (correo === undefined && rolesTexto === undefined) return SIN_DETALLE;
  return unir([correo, 'enlace anterior invalidado', rolesTexto]);
}

function detalleCancelar(datos: Objeto): string {
  return unir([conCorreo(datos)]);
}

function detalleCambiarRol(datos: Objeto): string {
  const antes = listaDeRoles(datos.antes);
  const despues = listaDeRoles(datos.despues);
  const cambio =
    antes === undefined || despues === undefined
      ? undefined
      : `roles: ${unirRoles(antes)} → ${unirRoles(despues)}`;
  return unir([texto(datos.email), cambio]);
}

function detalleQuitarRol(datos: Objeto): string {
  return unir([
    texto(datos.email),
    fragmentoRoles(datos.roles, 'roles quitados'),
  ]);
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
    case 'invitar':
      return detalleInvitar(datos);
    case 'reenviar_invitacion':
      return detalleReenviar(datos);
    case 'cancelar_invitacion':
      return detalleCancelar(datos);
    case 'cambiar_rol':
      return detalleCambiarRol(datos);
    case 'quitar_rol':
      return detalleQuitarRol(datos);
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
