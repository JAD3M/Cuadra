import { http, HttpResponse } from 'msw';
import type {
  FilaBandeja,
  PropuestaCaso,
  RespuestaCaso,
  RespuestaHistorial,
  RespuestaResolucion,
} from '@/shared/api/contratos';
import { MOTIVO_MAXIMO } from '@/shared/dominio';
import { USUARIO } from '@/test/fixtures';
import { casoDeFila } from '@/test/fixturesCaso';
import { crearHandlersBandeja } from '@/test/handlersBandeja';

// Manejadores del detalle del caso (CU-23) con las reglas del backend:
//  - `GET /casos/:movimientoId`: 400 si el id no es un uuid, 404 si no existe.
//  - `GET /conciliaciones/:id/historial`: eventos por propuesta.
//  - `POST /conciliaciones/:id/confirmar|rechazar`: cambian a la vez el caso,
//    el historial y las filas de la bandeja que comparte el almacén, con el
//    orden de comprobaciones del servidor (400, 404, 409, 403).
// El estado vive en memoria: `reiniciar()` lo devuelve al de arranque y la
// preparación global de pruebas lo llama tras cada prueba.

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANTE = '2026-10-05T10:00:00.000Z';
const INSTANTE_CREACION = '2026-09-16T09:14:00.000Z';

const ERROR_NEST = (status: number, mensaje: string) =>
  HttpResponse.json(
    { statusCode: status, error: 'Error', message: mensaje },
    { status },
  );

type Evento = RespuestaHistorial['datos'][number];

export interface OpcionesCaso {
  /** Toda resolución responde 409 (otra persona resolvió el caso). */
  conflicto?: boolean;
  /** Confirmar responde 403 (quien subió el CFDI no puede confirmarlo). */
  segregacion?: boolean;
}

/** Almacén de la bandeja con el que el caso comparte datos. */
export type AlmacenBandeja = Pick<
  ReturnType<typeof crearHandlersBandeja>,
  'filas' | 'establecer'
>;

function filaConPropuesta(
  fila: FilaBandeja,
  propuestas: readonly PropuestaCaso[],
  estado: FilaBandeja['estado'],
): FilaBandeja {
  const mejor = propuestas[0];
  return {
    ...fila,
    estado,
    propuestasCount: estado === 'sugerencia' ? propuestas.length : 0,
    regla: estado === 'sugerencia' ? (mejor?.regla ?? null) : null,
    motivo: estado === 'sugerencia' ? (mejor?.motivo ?? null) : null,
    mejorPropuesta:
      mejor === undefined
        ? null
        : {
            conciliacionId: mejor.conciliacionId,
            diferenciaMonto: mejor.diferenciaMonto,
            cfdi: {
              id: mejor.cfdi.id,
              uuidFiscal: mejor.cfdi.uuidFiscal,
              serie: mejor.cfdi.serie,
              folio: mejor.cfdi.folio,
              total: mejor.cfdi.total,
              moneda: mejor.cfdi.moneda,
            },
          },
  };
}

export function crearHandlersCaso(
  bandeja: AlmacenBandeja = crearHandlersBandeja(),
) {
  /** Casos ya resueltos o fijados a mano; el resto se deriva de la bandeja. */
  let propios = new Map<string, RespuestaCaso>();
  let eventos = new Map<string, Evento[]>();
  let opciones: OpcionesCaso = {};

  function casos(): RespuestaCaso[] {
    const deFilas = bandeja
      .filas()
      .map((f) => propios.get(f.movimientoId) ?? casoDeFila(f));
    const ids = new Set(deFilas.map((c) => c.movimiento.id));
    return [
      ...deFilas,
      ...[...propios.values()].filter((c) => !ids.has(c.movimiento.id)),
    ];
  }

  function buscarCaso(movimientoId: string): RespuestaCaso | undefined {
    return casos().find((c) => c.movimiento.id === movimientoId);
  }

  function buscarPropuesta(conciliacionId: string) {
    for (const caso of casos()) {
      const propuesta = caso.propuestas.find(
        (p) => p.conciliacionId === conciliacionId,
      );
      if (propuesta) return { caso, propuesta };
    }
    return undefined;
  }

  function eventosPorDefecto(p: PropuestaCaso): Evento[] {
    const base: Evento[] = [
      {
        id: `${p.conciliacionId}-1`,
        accion: 'crear',
        createdAt: INSTANTE_CREACION,
        usuario: null,
      },
    ];
    if (p.estado === 'confirmada' && p.confirmadaAt !== null) {
      base.push({
        id: `${p.conciliacionId}-2`,
        accion: 'confirmar',
        createdAt: p.confirmadaAt,
        usuario: p.confirmadaPor,
      });
    }
    return base;
  }

  function eventosDe(conciliacionId: string): Evento[] | undefined {
    const guardados = eventos.get(conciliacionId);
    if (guardados) return guardados;
    const encontrada = buscarPropuesta(conciliacionId);
    if (!encontrada) return undefined;
    const nuevos = eventosPorDefecto(encontrada.propuesta);
    eventos.set(conciliacionId, nuevos);
    return nuevos;
  }

  function agregarEvento(
    conciliacionId: string,
    accion: string,
    quien: boolean,
  ) {
    const lista = eventosDe(conciliacionId) ?? [];
    lista.push({
      id: `${conciliacionId}-${lista.length + 1}`,
      accion,
      createdAt: INSTANTE,
      usuario: quien ? { nombre: USUARIO.nombre } : null,
    });
    eventos.set(conciliacionId, lista);
  }

  function guardar(caso: RespuestaCaso, estado: FilaBandeja['estado']) {
    propios.set(caso.movimiento.id, caso);
    bandeja.establecer(
      bandeja
        .filas()
        .map((f) =>
          f.movimientoId === caso.movimiento.id
            ? filaConPropuesta(f, caso.propuestas, estado)
            : f,
        ),
    );
  }

  const detalle = http.get('/api/casos/:movimientoId', ({ params }) => {
    const id = String(params.movimientoId);
    if (!GUID.test(id)) {
      return ERROR_NEST(400, 'Validation failed (uuid is expected)');
    }
    const caso = buscarCaso(id);
    return caso === undefined
      ? ERROR_NEST(404, 'Movimiento no encontrado')
      : HttpResponse.json(caso);
  });

  const historial = http.get(
    '/api/conciliaciones/:conciliacionId/historial',
    ({ params }) => {
      const id = String(params.conciliacionId);
      if (!GUID.test(id)) {
        return ERROR_NEST(400, 'Validation failed (uuid is expected)');
      }
      const lista = eventosDe(id);
      return lista === undefined
        ? ERROR_NEST(404, 'Conciliacion no encontrada')
        : HttpResponse.json({ datos: lista });
    },
  );

  const resolver = http.post(
    '/api/conciliaciones/:conciliacionId/:accion',
    async ({ params, request }) => {
      const accion = String(params.accion);
      if (accion !== 'confirmar' && accion !== 'rechazar') {
        return ERROR_NEST(404, 'Cannot POST');
      }
      const id = String(params.conciliacionId);
      if (!GUID.test(id)) {
        return ERROR_NEST(400, 'Validation failed (uuid is expected)');
      }

      let motivo: string | null = null;
      if (accion === 'rechazar') {
        const cuerpo: unknown = await request.json().catch(() => undefined);
        const crudo =
          cuerpo !== null && typeof cuerpo === 'object' && 'motivo' in cuerpo
            ? (cuerpo as { motivo: unknown }).motivo
            : undefined;
        if (crudo !== undefined) {
          if (typeof crudo !== 'string') {
            return ERROR_NEST(400, 'motivo must be a string');
          }
          const recortado = crudo.trim();
          if (Array.from(recortado).length > MOTIVO_MAXIMO) {
            return ERROR_NEST(
              400,
              `motivo must be shorter than or equal to ${MOTIVO_MAXIMO} characters`,
            );
          }
          motivo = recortado === '' ? null : recortado;
        }
      }

      const encontrada = buscarPropuesta(id);
      if (encontrada === undefined) {
        return ERROR_NEST(404, 'Conciliacion no encontrada');
      }
      const { caso, propuesta } = encontrada;
      if (
        opciones.conflicto === true ||
        caso.estado !== 'sugerencia' ||
        propuesta.estado !== 'propuesta'
      ) {
        return ERROR_NEST(409, 'La conciliacion ya no esta vigente');
      }
      if (accion === 'confirmar' && opciones.segregacion === true) {
        return ERROR_NEST(403, 'acceso_denegado');
      }

      let rechazadasAutomaticamente: string[] = [];
      if (accion === 'confirmar') {
        const hermanas = caso.propuestas.filter((p) => p.conciliacionId !== id);
        rechazadasAutomaticamente = hermanas.map((p) => p.conciliacionId);
        for (const hermana of hermanas) {
          agregarEvento(hermana.conciliacionId, 'rechazar', false);
        }
        agregarEvento(id, 'confirmar', true);
        guardar(
          {
            ...caso,
            estado: 'conciliado',
            propuestas: [
              {
                ...propuesta,
                estado: 'confirmada',
                confirmadaAt: INSTANTE,
                confirmadaPor: { nombre: USUARIO.nombre },
              },
            ],
          },
          'conciliado',
        );
      } else {
        agregarEvento(id, 'rechazar', true);
        const restantes = caso.propuestas.filter(
          (p) => p.conciliacionId !== id,
        );
        guardar(
          restantes.length > 0
            ? { ...caso, propuestas: restantes }
            : {
                ...caso,
                estado: 'sin_match',
                sinMatch: { regla: null, motivo: null },
                propuestas: [],
              },
          restantes.length > 0 ? 'sugerencia' : 'sin_match',
        );
      }

      const respuesta: RespuestaResolucion = {
        id,
        estado: accion === 'confirmar' ? 'confirmada' : 'rechazada',
        cfdiId: propuesta.cfdi.id,
        movimientoId: caso.movimiento.id,
        motivo,
        confirmadaAt: accion === 'confirmar' ? INSTANTE : null,
        rechazadasAutomaticamente,
      };
      return HttpResponse.json(respuesta);
    },
  );

  return {
    handlers: [detalle, historial, resolver],
    /** Reemplaza los casos que sirve la ruta. */
    establecer(nuevos: readonly RespuestaCaso[]) {
      propios = new Map(nuevos.map((c) => [c.movimiento.id, c]));
    },
    /** Activa o desactiva los fallos forzados de `conflicto` y `segregacion`. */
    opciones(nuevas: OpcionesCaso) {
      opciones = { ...opciones, ...nuevas };
    },
    /** Devuelve casos, historial y opciones al estado de arranque. */
    reiniciar() {
      propios = new Map();
      eventos = new Map();
      opciones = {};
    },
  };
}

/** Manejador de `GET /casos/:id` que falla con `status`. */
export function casoFalla(status: number) {
  return http.get('/api/casos/:movimientoId', () =>
    ERROR_NEST(status, 'detalle del servidor'),
  );
}

/** Corta la conexión de `GET /casos/:id` (fallo de red). */
export function casoRedDeFallo() {
  return http.get('/api/casos/:movimientoId', () => HttpResponse.error());
}

/** Manejador de `POST confirmar|rechazar` que falla con `status`. */
export function resolverFalla(status: number) {
  return http.post('/api/conciliaciones/:conciliacionId/:accion', () =>
    ERROR_NEST(status, 'detalle del servidor'),
  );
}

/** Corta la conexión de `POST confirmar|rechazar` (fallo de red). */
export function resolverRedDeFallo() {
  return http.post('/api/conciliaciones/:conciliacionId/:accion', () =>
    HttpResponse.error(),
  );
}
