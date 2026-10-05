/**
 * Destino de retorno tras iniciar sesión. Viaja solo en el estado del
 * enrutador (nunca en la URL ni en un token) y se valida cada vez que se lee:
 * el estado del historial puede venir de una entrada fabricada.
 */
export interface DestinoGuardado {
  pathname: string;
  search?: string;
  hash?: string;
}

/** Lo que las guardas ponen y leen en `location.state`. */
export interface EstadoAcceso {
  from?: DestinoGuardado;
  foco?: 'correo';
}

const DESTINO_POR_DEFECTO: DestinoGuardado = { pathname: '/bandeja' };
const LARGO_MAXIMO = 2048;
// Empieza con una sola barra; sin espacios, barras invertidas ni controles.
const RUTA_INTERNA = /^\/(?![/\\])[^\s\\\p{Cc}]*$/u;
// Sin espacios ni controles; la barra invertida aquí tampoco tiene sentido.
const COMPLEMENTO = /^[^\s\\\p{Cc}]*$/u;
const PANTALLAS_DE_ACCESO = ['/login', '/empresa'];

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function esSegmentoDePunto(segmento: string): boolean {
  const limpio = segmento.toLowerCase().replaceAll('%2e', '.');
  return limpio === '.' || limpio === '..';
}

function esPantallaDeAcceso(pathname: string): boolean {
  const minuscula = pathname.toLowerCase();
  return PANTALLAS_DE_ACCESO.some(
    (ruta) => minuscula === ruta || minuscula.startsWith(`${ruta}/`),
  );
}

/**
 * Devuelve un destino interno y seguro, o `null`. Solo se aceptan rutas de la
 * propia aplicación: nada externo (`//`, `\`, esquemas), sin caracteres de
 * control, sin segmentos `.`/`..` y nunca `/login` ni `/empresa`. `search` y
 * `hash` inválidos se descartan; el largo total está acotado.
 */
export function destinoSeguro(valor: unknown): DestinoGuardado | null {
  if (!esObjeto(valor)) return null;
  const { pathname, search, hash } = valor;
  if (typeof pathname !== 'string' || !RUTA_INTERNA.test(pathname)) return null;
  if (pathname.split('/').some(esSegmentoDePunto)) return null;
  if (esPantallaDeAcceso(pathname)) return null;

  const destino: DestinoGuardado = { pathname };
  if (
    typeof search === 'string' &&
    search.startsWith('?') &&
    COMPLEMENTO.test(search)
  ) {
    destino.search = search;
  }
  if (
    typeof hash === 'string' &&
    hash.startsWith('#') &&
    COMPLEMENTO.test(hash)
  ) {
    destino.hash = hash;
  }
  const largo =
    pathname.length +
    (destino.search?.length ?? 0) +
    (destino.hash?.length ?? 0);
  return largo > LARGO_MAXIMO ? null : destino;
}

/** Lee `location.state` y devuelve solo lo que se reconoce y es seguro. */
export function estadoAcceso(state: unknown): EstadoAcceso {
  if (!esObjeto(state)) return {};
  const acceso: EstadoAcceso = {};
  const from = destinoSeguro(state.from);
  if (from) acceso.from = from;
  if (state.foco === 'correo') acceso.foco = 'correo';
  return acceso;
}

/**
 * A dónde ir cuando ya hay sesión: el destino guardado, o `/bandeja`. Solo se
 * restaura el origen si la sesión lo permite (`restaurarOrigen`: tras una
 * expiración, la misma empresa); con otra empresa siempre es `/bandeja`.
 */
export function destinoTrasAcceso(
  state: unknown,
  { restaurarOrigen }: { restaurarOrigen: boolean },
): DestinoGuardado {
  if (!restaurarOrigen) return DESTINO_POR_DEFECTO;
  return estadoAcceso(state).from ?? DESTINO_POR_DEFECTO;
}
