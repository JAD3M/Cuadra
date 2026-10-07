import { http, HttpResponse } from 'msw';
import { ACCIONES_BITACORA } from '@/shared/dominio';
import {
  USUARIOS_BITACORA,
  type PersonaBitacora,
} from '@/test/fixturesBitacora';
import type { EventoBitacora } from '@/test/fixturesTolerancia';

// Manejadores de la bitácora (CU-26) con las reglas del backend
// (src/bitacora/bitacora.controller.ts y dto/bitacora.dto.ts):
//  - `GET /bitacora`: `entidad` (texto de hasta 64, sin lista), `entidadId` y
//    `userId` (uuid), `accion` (de la lista, si no 400), `desde`/`hasta`
//    (ISO 8601 estricto; el rango es [desde, hasta) y 400 si desde > hasta),
//    `pagina` (entero >= 1) y `limite` (entero 1..200, por defecto 50). Orden
//    `createdAt DESC, id DESC`; responde `{ datos, pagina, limite, total }` y
//    los eventos traen `ip`, `userAgent` y el correo, como la API.
//  - `GET /bitacora/usuarios`: `{ datos: [{ id, nombre }] }`, sin correo. Se
//    sirve en el orden en que se fijan las personas.
// Los eventos de la API no traen el id de quien los hizo: el filtro `userId`
// busca a la persona en la lista de usuarios y compara por correo.
// El estado vive en memoria: `reiniciar()` lo devuelve al de arranque y la
// preparación global de pruebas lo llama tras cada prueba. `peticiones()`
// registra lo que llegó (también lo que una compuerta retuvo) para probar
// presencia y ausencia de peticiones.
//
// El almacén también lo usa el mock de la tolerancia (`handlersTolerancia`):
// su `GET /bitacora` delega en `responderLista` y su `PUT` antepone el evento
// con `anteponer`, de modo que hay UN solo almacén y UN solo `GET /bitacora`
// registrado (el primero que coincide gana, uno repetido taparía al otro).

const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 200;
const LONGITUD_MAXIMA_ENTIDAD = 64;

const ERROR_NEST = (status: number, mensaje: string | string[]) =>
  HttpResponse.json(
    { statusCode: status, error: 'Error', message: mensaje },
    { status },
  );

/** Cualquier versión de uuid, como `@IsUUID()`. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

/** Cantidad de días de un mes (febrero según el año). */
function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** ISO 8601 estricto: el calendario y la hora existen (`2026-02-31` no). */
function esIsoEstricto(texto: string): boolean {
  const partes = ISO.exec(texto);
  if (partes === null) return false;
  const [, a, m, d, h, min, s] = partes;
  const [anio, mes, dia] = [Number(a), Number(m), Number(d)];
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) {
    return false;
  }
  if (h !== undefined && Number(h) > 23) return false;
  if (min !== undefined && Number(min) > 59) return false;
  if (s !== undefined && Number(s) > 59) return false;
  return !Number.isNaN(Date.parse(texto));
}

/** Entero con el mismo criterio de `@Type(() => Number) @IsInt()`. */
function entero(texto: string): number | null {
  const valor = Number(texto);
  return Number.isInteger(valor) ? valor : null;
}

/** Una petición tal como la vio un manejador. */
export interface PeticionBitacora {
  metodo: string;
  ruta: string;
  consulta: Record<string, string>;
}

/** Respuestas que esperan a que la prueba abra su compuerta. */
export interface CompuertasBitacora {
  lista?: Promise<void>;
  usuarios?: Promise<void>;
}

/** Las oraciones de Nest para una consulta inválida; vacío si es válida. */
function oracionesInvalidas(consulta: URLSearchParams): string[] {
  const oraciones: string[] = [];
  const entidad = consulta.get('entidad');
  if (entidad !== null && entidad.length > LONGITUD_MAXIMA_ENTIDAD) {
    oraciones.push(
      `entidad must be shorter than or equal to ${LONGITUD_MAXIMA_ENTIDAD} characters`,
    );
  }
  for (const clave of ['entidadId', 'userId']) {
    const valor = consulta.get(clave);
    if (valor !== null && !UUID.test(valor)) {
      oraciones.push(`${clave} must be a UUID`);
    }
  }
  const accion = consulta.get('accion');
  if (
    accion !== null &&
    !(ACCIONES_BITACORA as readonly string[]).includes(accion)
  ) {
    oraciones.push(
      `accion must be one of the following values: ${ACCIONES_BITACORA.join(', ')}`,
    );
  }
  for (const clave of ['desde', 'hasta']) {
    const valor = consulta.get(clave);
    if (valor !== null && !esIsoEstricto(valor)) {
      oraciones.push(`${clave} must be a valid ISO 8601 date string`);
    }
  }
  const pagina = consulta.get('pagina');
  if (pagina !== null) {
    const n = entero(pagina);
    if (n === null || n < 1) {
      oraciones.push('pagina must not be less than 1');
    }
  }
  const limite = consulta.get('limite');
  if (limite !== null) {
    const n = entero(limite);
    if (n === null || n < 1) {
      oraciones.push('limite must not be less than 1');
    } else if (n > LIMITE_MAXIMO) {
      oraciones.push(`limite must not be greater than ${LIMITE_MAXIMO}`);
    }
  }
  if (oraciones.length === 0) {
    const desde = consulta.get('desde');
    const hasta = consulta.get('hasta');
    if (
      desde !== null &&
      hasta !== null &&
      Date.parse(desde) > Date.parse(hasta)
    ) {
      oraciones.push('desde no puede ser posterior a hasta');
    }
  }
  return oraciones;
}

export function crearHandlersBitacora(
  eventosIniciales: readonly EventoBitacora[] = [],
  usuariosIniciales: readonly PersonaBitacora[] = USUARIOS_BITACORA,
) {
  let eventos = [...eventosIniciales];
  let usuarios = [...usuariosIniciales];
  let peticiones: PeticionBitacora[] = [];
  let compuertas: CompuertasBitacora = {};

  function registrar(request: Request): void {
    const url = new URL(request.url);
    peticiones.push({
      metodo: request.method,
      ruta: url.pathname,
      consulta: Object.fromEntries(url.searchParams),
    });
  }

  /** Atiende un `GET /bitacora`: registra, espera la compuerta y responde. */
  async function responderLista(request: Request): Promise<Response> {
    registrar(request);
    await compuertas.lista;
    const consulta = new URL(request.url).searchParams;
    const oraciones = oracionesInvalidas(consulta);
    if (oraciones.length > 0) return ERROR_NEST(400, oraciones);

    const pagina = entero(consulta.get('pagina') ?? '1') ?? 1;
    const limiteTexto = consulta.get('limite');
    const limite =
      limiteTexto === null ? LIMITE_POR_DEFECTO : (entero(limiteTexto) ?? 1);
    const entidad = consulta.get('entidad');
    const entidadId = consulta.get('entidadId');
    const accion = consulta.get('accion');
    const userId = consulta.get('userId');
    const desde = consulta.get('desde');
    const hasta = consulta.get('hasta');
    const persona =
      userId === null ? undefined : usuarios.find((u) => u.id === userId);

    const coincidentes = [...eventos]
      .filter(
        (e) =>
          (entidad === null || e.entidad === entidad) &&
          (entidadId === null || e.entidadId === entidadId) &&
          (accion === null || e.accion === accion) &&
          (userId === null ||
            (persona !== undefined && e.usuario?.email === persona.email)) &&
          (desde === null || Date.parse(e.createdAt) >= Date.parse(desde)) &&
          (hasta === null || Date.parse(e.createdAt) < Date.parse(hasta)),
      )
      .sort((a, b) =>
        a.createdAt === b.createdAt
          ? b.id.localeCompare(a.id)
          : b.createdAt.localeCompare(a.createdAt),
      );
    const inicio = (pagina - 1) * limite;
    return HttpResponse.json({
      datos: coincidentes.slice(inicio, inicio + limite),
      pagina,
      limite,
      total: coincidentes.length,
    });
  }

  const lista = http.get('/api/bitacora', ({ request }) =>
    responderLista(request),
  );

  const listaUsuarios = http.get(
    '/api/bitacora/usuarios',
    async ({ request }) => {
      registrar(request);
      await compuertas.usuarios;
      return HttpResponse.json({
        datos: usuarios.map(({ id, nombre }) => ({ id, nombre })),
      });
    },
  );

  return {
    /** `GET /bitacora` y `GET /bitacora/usuarios`. */
    handlers: [lista, listaUsuarios],
    /** Solo `GET /bitacora/usuarios`: el listado lo registra otro (la tolerancia). */
    handlersUsuarios: [listaUsuarios],
    responderLista,
    /** Los eventos en memoria, tal como se fijaron (la lista los ordena al servir). */
    eventos: (): readonly EventoBitacora[] => eventos,
    /** Reemplaza los eventos que sirve `GET /bitacora`. */
    establecer(nuevos: readonly EventoBitacora[]) {
      eventos = [...nuevos];
    },
    /** Agrega un evento al principio, como un emisor que acaba de escribir. */
    anteponer(evento: EventoBitacora) {
      eventos = [evento, ...eventos];
    },
    /** Las personas que sirve `GET /bitacora/usuarios`, en su orden. */
    usuarios: (): readonly PersonaBitacora[] => usuarios,
    /** Reemplaza las personas del filtro (y las que resuelve `userId`). */
    establecerUsuarios(nuevos: readonly PersonaBitacora[]) {
      usuarios = [...nuevos];
    },
    /** Cada petición que llegó, en orden, también las retenidas o rechazadas. */
    peticiones: (): readonly PeticionBitacora[] => peticiones,
    /** Retiene las respuestas indicadas hasta que su promesa se resuelva. */
    compuertas(nuevas: CompuertasBitacora) {
      compuertas = { ...compuertas, ...nuevas };
    },
    /** Devuelve solo los eventos al arranque (lo usa la tolerancia al reiniciar). */
    reiniciarEventos() {
      eventos = [...eventosIniciales];
    },
    /** Devuelve eventos, personas, registro y compuertas al arranque. */
    reiniciar() {
      eventos = [...eventosIniciales];
      usuarios = [...usuariosIniciales];
      peticiones = [];
      compuertas = {};
    },
  };
}

export type AlmacenBitacora = ReturnType<typeof crearHandlersBitacora>;

/** `GET /bitacora` falla con `status` (el mensaje del servidor no debe mostrarse). */
export function listaFalla(status: number, mensaje = 'boom') {
  return http.get('/api/bitacora', () => ERROR_NEST(status, mensaje));
}

/** Corta la conexión de `GET /bitacora` (fallo de red). */
export function listaRedDeFallo() {
  return http.get('/api/bitacora', () => HttpResponse.error());
}

/** `GET /bitacora` responde 200 con un sobre al que le falta `total`. */
export function listaFueraDeContrato() {
  return http.get('/api/bitacora', () =>
    HttpResponse.json({ datos: [], pagina: 1, limite: 50 }),
  );
}

/** `GET /bitacora/usuarios` falla con `status`. */
export function usuariosFalla(status: number, mensaje = 'boom') {
  return http.get('/api/bitacora/usuarios', () => ERROR_NEST(status, mensaje));
}

/** Corta la conexión de `GET /bitacora/usuarios` (fallo de red). */
export function usuariosRedDeFallo() {
  return http.get('/api/bitacora/usuarios', () => HttpResponse.error());
}

/** `GET /bitacora/usuarios` responde 200 con un elemento sin `nombre`. */
export function usuariosFueraDeContrato() {
  return http.get('/api/bitacora/usuarios', () =>
    HttpResponse.json({ datos: [{ id: 'sin-nombre' }] }),
  );
}
