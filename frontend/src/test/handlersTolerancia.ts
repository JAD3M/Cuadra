import Decimal from 'decimal.js';
import { http, HttpResponse } from 'msw';
import {
  CAMPO_TOLERANCIA,
  PATRON_TOLERANCIA,
  TOLERANCIA_MAXIMA,
} from '@/shared/dominio';
import { USUARIO } from '@/test/fixtures';
import {
  CAMBIOS_INICIALES,
  hace,
  idEvento,
  type EventoBitacora,
} from '@/test/fixturesTolerancia';

// Manejadores de la tolerancia (CU-25) con las reglas del backend:
//  - `GET /empresa/tolerancia`: `{ toleranciaMonto }` en texto NUMERIC(18,4).
//  - `PUT /empresa/tolerancia`: el cuerpo debe ser `{ toleranciaMonto: string }`
//    con el regex del servidor y a lo sumo 100; si no, 400 con las oraciones
//    de Nest (que nombran `toleranciaMonto`, para que una prueba compruebe que
//    nunca se muestran). Responde el valor normalizado a 4 decimales, lo
//    guarda y antepone una fila de bitácora `antes -> despues`.
//  - `GET /bitacora`: filtra por `entidad` y `accion`, respeta `limite` (por
//    defecto 50, máximo 200 como `LIMITE_MAXIMO`), más nuevo primero, y
//    responde `{ datos, pagina, limite, total }`.
// El estado vive en memoria: `reiniciar()` lo devuelve al de arranque y la
// preparación global de pruebas lo llama tras cada prueba. `peticiones()`
// registra lo que llegó (también lo que una compuerta retuvo) para probar
// presencia y ausencia de peticiones.

const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 200;

const ERROR_NEST = (status: number, mensaje: string | string[]) =>
  HttpResponse.json(
    { statusCode: status, error: 'Error', message: mensaje },
    { status },
  );

/** Una petición tal como la vio un manejador. */
export interface PeticionRecibida {
  metodo: string;
  ruta: string;
  consulta: Record<string, string>;
  /** El JSON del cuerpo tal como llegó; `null` si no había o no era JSON. */
  cuerpo: unknown;
}

/** Respuestas que esperan a que la prueba abra su compuerta. */
export interface Compuertas {
  valor?: Promise<void>;
  guardar?: Promise<void>;
  cambios?: Promise<void>;
}

/** Las oraciones que class-validator le pone a un cuerpo inválido. */
function oracionesInvalidas(cuerpo: unknown): string[] {
  const valor =
    typeof cuerpo === 'object' && cuerpo !== null
      ? (cuerpo as Record<string, unknown>).toleranciaMonto
      : undefined;
  if (typeof valor !== 'string') {
    return [
      'toleranciaMonto must match /^\\d+(\\.\\d{1,4})?$/ regular expression',
      'toleranciaMonto must be a string',
    ];
  }
  if (!PATRON_TOLERANCIA.test(valor)) {
    return [
      'toleranciaMonto must match /^\\d+(\\.\\d{1,4})?$/ regular expression',
    ];
  }
  if (new Decimal(valor).gt(TOLERANCIA_MAXIMA)) {
    return [`toleranciaMonto must not be greater than ${TOLERANCIA_MAXIMA}`];
  }
  return [];
}

export function crearHandlersTolerancia(
  valorInicial = '0.5000',
  cambiosIniciales: readonly EventoBitacora[] = CAMBIOS_INICIALES,
) {
  let valor = valorInicial;
  let eventos = [...cambiosIniciales];
  let peticiones: PeticionRecibida[] = [];
  let compuertas: Compuertas = {};
  let creados = 0;

  async function registrar(request: Request): Promise<void> {
    const url = new URL(request.url);
    let cuerpo: unknown = null;
    if (request.method !== 'GET') {
      try {
        cuerpo = await request.clone().json();
      } catch {
        cuerpo = null;
      }
    }
    peticiones.push({
      metodo: request.method,
      ruta: url.pathname,
      consulta: Object.fromEntries(url.searchParams),
      cuerpo,
    });
  }

  const leer = http.get('/api/empresa/tolerancia', async ({ request }) => {
    await registrar(request);
    await compuertas.valor;
    return HttpResponse.json({ toleranciaMonto: valor });
  });

  const guardar = http.put('/api/empresa/tolerancia', async ({ request }) => {
    await registrar(request);
    await compuertas.guardar;
    let cuerpo: unknown;
    try {
      cuerpo = await request.clone().json();
    } catch {
      cuerpo = null;
    }
    const oraciones = oracionesInvalidas(cuerpo);
    if (oraciones.length > 0) return ERROR_NEST(400, oraciones);

    const nuevo = new Decimal(
      (cuerpo as { toleranciaMonto: string }).toleranciaMonto,
    ).toFixed(4);
    const antes = valor;
    valor = nuevo;
    creados += 1;
    eventos = [
      {
        id: idEvento(500 + creados),
        entidad: 'companies',
        entidadId: idEvento(0),
        accion: 'actualizar',
        datos: { campo: CAMPO_TOLERANCIA, antes, despues: nuevo },
        // Siempre más nuevo que cualquier fila de arranque.
        createdAt: hace(-creados),
        usuario: { nombre: USUARIO.nombre, email: USUARIO.email },
        ip: '127.0.0.1',
        userAgent: 'vitest',
      },
      ...eventos,
    ];
    return HttpResponse.json({ toleranciaMonto: nuevo });
  });

  const bitacora = http.get('/api/bitacora', async ({ request }) => {
    await registrar(request);
    await compuertas.cambios;
    const consulta = new URL(request.url).searchParams;
    const limiteTexto = consulta.get('limite');
    const limite =
      limiteTexto === null ? LIMITE_POR_DEFECTO : Number(limiteTexto);
    if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) {
      return ERROR_NEST(400, [
        `limite must not be greater than ${LIMITE_MAXIMO}`,
      ]);
    }
    const entidad = consulta.get('entidad');
    const accion = consulta.get('accion');
    const coincidentes = [...eventos]
      .filter(
        (e) =>
          (entidad === null || e.entidad === entidad) &&
          (accion === null || e.accion === accion),
      )
      .sort((a, b) =>
        a.createdAt === b.createdAt
          ? b.id.localeCompare(a.id)
          : b.createdAt.localeCompare(a.createdAt),
      );
    return HttpResponse.json({
      datos: coincidentes.slice(0, limite),
      pagina: 1,
      limite,
      total: coincidentes.length,
    });
  });

  return {
    handlers: [leer, guardar, bitacora],
    /** El valor que sirve `GET /empresa/tolerancia` ahora. */
    valor: (): string => valor,
    /** Fija el valor que sirve el GET (no escribe bitácora). */
    establecer(nuevo: string) {
      valor = nuevo;
    },
    /** Los eventos de bitácora en memoria, en el orden en que se guardaron. */
    cambios: (): readonly EventoBitacora[] => eventos,
    /** Reemplaza los eventos que sirve `GET /bitacora`. */
    establecerCambios(nuevos: readonly EventoBitacora[]) {
      eventos = [...nuevos];
    },
    /** Cada petición que llegó, en orden, también las retenidas. */
    peticiones: (): readonly PeticionRecibida[] => peticiones,
    /** Retiene las respuestas indicadas hasta que su promesa se resuelva. */
    compuertas(nuevas: Compuertas) {
      compuertas = { ...compuertas, ...nuevas };
    },
    /** Devuelve valor, bitácora, registro y compuertas al arranque. */
    reiniciar() {
      valor = valorInicial;
      eventos = [...cambiosIniciales];
      peticiones = [];
      compuertas = {};
      creados = 0;
    },
  };
}

/** `GET /empresa/tolerancia` falla con `status`. */
export function valorFalla(status: number) {
  return http.get('/api/empresa/tolerancia', () =>
    ERROR_NEST(status, 'detalle del servidor'),
  );
}

/** Corta la conexión de `GET /empresa/tolerancia` (fallo de red). */
export function valorRedDeFallo() {
  return http.get('/api/empresa/tolerancia', () => HttpResponse.error());
}

/** `PUT /empresa/tolerancia` falla con `status`; el mensaje puede ser un arreglo. */
export function guardarFalla(
  status: number,
  mensaje: string | string[] = 'detalle del servidor',
) {
  return http.put('/api/empresa/tolerancia', () => ERROR_NEST(status, mensaje));
}

/** Corta la conexión de `PUT /empresa/tolerancia` (fallo de red). */
export function guardarRedDeFallo() {
  return http.put('/api/empresa/tolerancia', () => HttpResponse.error());
}

/** `PUT /empresa/tolerancia` responde 200 con un cuerpo que no cumple el contrato. */
export function guardarFueraDeContrato() {
  return http.put('/api/empresa/tolerancia', () =>
    HttpResponse.json({ toleranciaMonto: 0.5 }),
  );
}

/** `GET /bitacora` falla con `status`. */
export function cambiosFalla(status: number) {
  return http.get('/api/bitacora', () =>
    ERROR_NEST(status, 'detalle del servidor'),
  );
}

/** `GET /bitacora` responde 200 con un sobre sin el arreglo `datos`. */
export function cambiosFueraDeContrato() {
  return http.get('/api/bitacora', () =>
    HttpResponse.json({ pagina: 1, limite: 50, total: 0 }),
  );
}
