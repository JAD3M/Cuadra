import { http, HttpResponse } from 'msw';
import type {
  DetalleCarga,
  ItemCarga,
  PerfilBancario,
  RespuestaCarga,
} from '@/shared/api/contratos';
import {
  LIMITES_CARGA,
  PERFIL_POR_DEFECTO,
  TIPO_CFDI,
  TIPO_ESTADO_CUENTA,
  type EstadoCarga,
} from '@/shared/dominio';
import { LISTA_DE_VEINTE, PERFILES, hace } from '@/test/fixturesCargas';

// Manejadores de las cargas (CU-24) con las reglas del backend:
//  - `GET /cargas`: las 20 más recientes, más nueva primero, `{ datos }`.
//  - `GET /cargas/:id`: 400 si el id no es un uuid, 404 si no existe.
//  - `GET /bancos/perfiles`: arreglo sin envoltorio.
//  - `POST /cargas/cfdi` y `POST /cargas/estado-cuenta`: leen el multipart,
//    validan como el servidor (400), responden 202 con una carga `pendiente` o
//    200 con `yaExistia` si el mismo lote ya se subió, y la carga nueva
//    aparece en la lista.
// El estado vive en memoria: `reiniciar()` lo devuelve al de arranque y la
// preparación global de pruebas lo llama tras cada prueba. Una prueba mueve
// una carga de estado con `avanzar` y retiene respuestas con `compuertas`.

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_LISTA = 20;

const ERROR_NEST = (status: number, mensaje: string | string[]) =>
  HttpResponse.json(
    { statusCode: status, error: 'Error', message: mensaje },
    { status },
  );

/** Un archivo del multipart tal como lo vio el manejador. */
export interface ArchivoRecibido {
  campo: string;
  nombre: string;
  tamano: number;
}

/** Lo que recibió un POST de subida, para que la prueba lo inspeccione. */
export interface SubidaRecibida {
  ruta: 'cfdi' | 'estado-cuenta';
  archivos: ArchivoRecibido[];
  /** Campos de texto del multipart, en orden de llegada. */
  campos: Array<[string, string]>;
  autorizacion: string | null;
  contentType: string | null;
}

/** Respuestas que esperan a que la prueba abra su compuerta. */
export interface Compuertas {
  lista?: Promise<void>;
  detalle?: Promise<void>;
  perfiles?: Promise<void>;
  subida?: Promise<void>;
}

/** Datos de una carga que `avanzar` puede reemplazar. */
export type ParcheDeCarga = Partial<
  Pick<
    DetalleCarga,
    | 'totalRegistros'
    | 'registrosOk'
    | 'registrosExistentes'
    | 'registrosError'
    | 'resultados'
    | 'errorMensaje'
  >
>;

function detalleDeItem(item: ItemCarga): DetalleCarga {
  return {
    id: item.id,
    estado: item.estado,
    totalRegistros: item.registrosOk + item.registrosError,
    registrosOk: item.registrosOk,
    registrosExistentes: 0,
    registrosError: item.registrosError,
    resultados: [],
    errorMensaje: null,
  };
}

/** Un id nuevo y determinista: 9500 + orden de creación. */
function idNuevo(orden: number): string {
  return `00000000-0000-4000-8000-${String(9500 + orden).padStart(12, '0')}`;
}

export function crearHandlersCargas(
  inicial: readonly ItemCarga[] = LISTA_DE_VEINTE,
  perfilesIniciales: readonly PerfilBancario[] = PERFILES,
) {
  let items = [...inicial];
  let detalles = new Map<string, DetalleCarga>();
  /** Huella del lote -> id: el mismo lote responde `yaExistia`. */
  let lotes = new Map<string, string>();
  let subidas: SubidaRecibida[] = [];
  let perfiles = [...perfilesIniciales];
  let compuertas: Compuertas = {};
  let creadas = 0;

  const detalleDe = (id: string): DetalleCarga | undefined => {
    const propio = detalles.get(id);
    if (propio) return propio;
    const item = items.find((i) => i.id === id);
    return item ? detalleDeItem(item) : undefined;
  };

  const lista = http.get('/api/cargas', async () => {
    await compuertas.lista;
    return HttpResponse.json({
      datos: [...items]
        .sort((a, b) =>
          a.createdAt === b.createdAt
            ? b.id.localeCompare(a.id)
            : b.createdAt.localeCompare(a.createdAt),
        )
        .slice(0, LIMITE_LISTA),
    });
  });

  const detalle = http.get('/api/cargas/:id', async ({ params }) => {
    const id = String(params.id);
    if (!GUID.test(id)) {
      return ERROR_NEST(400, 'Validation failed (uuid is expected)');
    }
    await compuertas.detalle;
    const encontrada = detalleDe(id);
    return encontrada === undefined
      ? ERROR_NEST(404, 'Not Found')
      : HttpResponse.json(encontrada);
  });

  const listaDePerfiles = http.get('/api/bancos/perfiles', async () => {
    await compuertas.perfiles;
    return HttpResponse.json(perfiles);
  });

  function registrar(
    tipo: ItemCarga['tipo'],
    nombreArchivo: string,
    huella: string,
  ): Response {
    const existente = lotes.get(huella);
    if (existente !== undefined) {
      // Como el backend: resubir un lote fallido lo reencola desde cero.
      if (detalleDe(existente)?.estado === 'fallida') {
        items = items.map((i) =>
          i.id === existente
            ? { ...i, estado: 'pendiente', registrosOk: 0, registrosError: 0 }
            : i,
        );
        detalles.set(existente, {
          ...(detalleDe(existente) as DetalleCarga),
          estado: 'pendiente',
          totalRegistros: 0,
          registrosOk: 0,
          registrosExistentes: 0,
          registrosError: 0,
          resultados: [],
          errorMensaje: null,
        });
      }
      const actual = detalleDe(existente);
      if (actual) {
        const cuerpo: RespuestaCarga = { ...actual, yaExistia: true };
        return HttpResponse.json(cuerpo, { status: 200 });
      }
    }
    creadas += 1;
    const id = idNuevo(creadas);
    const item: ItemCarga = {
      id,
      tipo,
      nombreArchivo,
      estado: 'pendiente',
      registrosOk: 0,
      registrosError: 0,
      subidoPor: 'Luis Mendoza',
      // Siempre más nueva que cualquier fila de arranque.
      createdAt: hace(-creadas),
    };
    items = [item, ...items];
    const nuevo = detalleDeItem(item);
    detalles.set(id, nuevo);
    lotes.set(huella, id);
    const cuerpo: RespuestaCarga = { ...nuevo, yaExistia: false };
    return HttpResponse.json(cuerpo, { status: 202 });
  }

  const subirCfdi = http.post('/api/cargas/cfdi', async ({ request }) => {
    const recibida = await leerSubida(request, 'cfdi');
    subidas.push(recibida);
    await compuertas.subida;
    const { archivos } = recibida;
    if (archivos.length === 0) {
      return ERROR_NEST(
        400,
        'Falta al menos un archivo en el campo "archivos"',
      );
    }
    const ajeno = archivos.find(
      (a) =>
        !a.nombre.toLowerCase().endsWith(LIMITES_CARGA.cfdi.extension) ||
        a.campo !== 'archivos',
    );
    if (ajeno) {
      return ERROR_NEST(
        400,
        `Solo se aceptan archivos ${LIMITES_CARGA.cfdi.extension}: "${ajeno.nombre}"`,
      );
    }
    const nombre =
      archivos.length === 1
        ? (archivos[0]?.nombre ?? '')
        : `${archivos.length} archivos: ${archivos.map((a) => a.nombre).join(', ')}`;
    const huella = archivos
      .map((a) => `${a.nombre}:${a.tamano}`)
      .sort()
      .join('|');
    return registrar(TIPO_CFDI, nombre, `${TIPO_CFDI}|${huella}`);
  });

  const subirEstadoCuenta = http.post(
    '/api/cargas/estado-cuenta',
    async ({ request }) => {
      const recibida = await leerSubida(request, 'estado-cuenta');
      subidas.push(recibida);
      await compuertas.subida;
      const [archivo] = recibida.archivos;
      if (archivo === undefined || archivo.campo !== 'archivo') {
        return ERROR_NEST(400, 'Falta el archivo en el campo "archivo"');
      }
      if (
        !archivo.nombre
          .toLowerCase()
          .endsWith(LIMITES_CARGA.estadoCuenta.extension)
      ) {
        return ERROR_NEST(
          400,
          `Solo se aceptan archivos ${LIMITES_CARGA.estadoCuenta.extension}: "${archivo.nombre}"`,
        );
      }
      const campo = (nombre: string) =>
        recibida.campos.find(([n]) => n === nombre)?.[1];
      const perfil = campo('perfil') ?? PERFIL_POR_DEFECTO;
      if (!perfiles.some((p) => p.id === perfil)) {
        return ERROR_NEST(
          400,
          `Perfil de banco desconocido: "${perfil}". Disponibles: ${perfiles.map((p) => p.id).join(', ')}`,
        );
      }
      const huella = `${archivo.nombre}:${archivo.tamano}`;
      return registrar(TIPO_ESTADO_CUENTA, archivo.nombre, huella);
    },
  );

  return {
    handlers: [lista, detalle, listaDePerfiles, subirCfdi, subirEstadoCuenta],
    /** Las cargas que sirve la lista, en el orden en que se guardaron. */
    filas: (): readonly ItemCarga[] => items,
    /** Reemplaza las cargas de la lista (y descarta los detalles propios). */
    establecer(nuevas: readonly ItemCarga[]) {
      items = [...nuevas];
      detalles = new Map();
      lotes = new Map();
    },
    /** Fija el detalle que sirve `GET /cargas/:id`. */
    establecerDetalle(nuevo: DetalleCarga) {
      detalles.set(nuevo.id, nuevo);
    },
    /**
     * Mueve una carga a otro estado: lista y detalle cambian a la vez, como
     * cuando el worker avanza. Los contadores de la lista siguen al detalle.
     */
    avanzar(id: string, estado: EstadoCarga, parche: ParcheDeCarga = {}) {
      const actual = detalleDe(id);
      if (actual === undefined) throw new Error(`No existe la carga ${id}`);
      const siguiente: DetalleCarga = { ...actual, ...parche, estado };
      detalles.set(id, siguiente);
      items = items.map((i) =>
        i.id === id
          ? {
              ...i,
              estado,
              registrosOk: siguiente.registrosOk,
              registrosError: siguiente.registrosError,
            }
          : i,
      );
    },
    /** Cada POST de subida que llegó, con sus archivos y campos. */
    subidas: (): readonly SubidaRecibida[] => subidas,
    /** Perfiles que sirve `GET /bancos/perfiles`. */
    establecerPerfiles(nuevos: readonly PerfilBancario[]) {
      perfiles = [...nuevos];
    },
    /** Retiene las respuestas indicadas hasta que su promesa se resuelva. */
    compuertas(nuevas: Compuertas) {
      compuertas = { ...compuertas, ...nuevas };
    },
    /** Devuelve lista, detalles, subidas, perfiles y compuertas al arranque. */
    reiniciar() {
      items = [...inicial];
      detalles = new Map();
      lotes = new Map();
      subidas = [];
      perfiles = [...perfilesIniciales];
      compuertas = {};
      creadas = 0;
    },
  };
}

async function leerSubida(
  request: Request,
  ruta: SubidaRecibida['ruta'],
): Promise<SubidaRecibida> {
  const archivos: ArchivoRecibido[] = [];
  const campos: Array<[string, string]> = [];
  const formulario = await request.formData();
  for (const [campo, valor] of formulario.entries()) {
    if (typeof valor === 'string') campos.push([campo, valor]);
    else archivos.push({ campo, nombre: valor.name, tamano: valor.size });
  }
  return {
    ruta,
    archivos,
    campos,
    autorizacion: request.headers.get('Authorization'),
    contentType: request.headers.get('Content-Type'),
  };
}

/** Manejador de `GET /cargas` que falla con `status`. */
export function listaFalla(status: number) {
  return http.get('/api/cargas', () =>
    ERROR_NEST(status, 'detalle del servidor'),
  );
}

/** Corta la conexión de `GET /cargas` (fallo de red). */
export function listaRedDeFallo() {
  return http.get('/api/cargas', () => HttpResponse.error());
}

/** Manejador de `GET /cargas/:id` que falla con `status`. */
export function detalleFalla(status: number) {
  return http.get('/api/cargas/:id', () =>
    ERROR_NEST(status, 'detalle del servidor'),
  );
}

/** Manejador de `GET /bancos/perfiles` que falla con `status`. */
export function perfilesFalla(status: number) {
  return http.get('/api/bancos/perfiles', () =>
    ERROR_NEST(status, 'detalle del servidor'),
  );
}

type RutaDeSubida = 'cfdi' | 'estado-cuenta';
const RUTAS_DE_SUBIDA: readonly RutaDeSubida[] = ['cfdi', 'estado-cuenta'];

/** Los dos POST de subida responden `status` con un cuerpo de Nest (400, 403, 500). */
export function subidaFalla(status: number, mensaje = 'detalle del servidor') {
  return RUTAS_DE_SUBIDA.map((ruta) =>
    http.post(`/api/cargas/${ruta}`, () => ERROR_NEST(status, mensaje)),
  );
}

/** 413 con el cuerpo HTML de un proxy: la clasificación es por estado. */
export function subida413Html() {
  return RUTAS_DE_SUBIDA.map((ruta) =>
    http.post(
      `/api/cargas/${ruta}`,
      () =>
        new HttpResponse(
          '<html><body>413 Request Entity Too Large</body></html>',
          {
            status: 413,
            headers: { 'Content-Type': 'text/html' },
          },
        ),
    ),
  );
}

/** Corta la conexión de los dos POST de subida (fallo de red). */
export function subidaRedDeFallo() {
  return RUTAS_DE_SUBIDA.map((ruta) =>
    http.post(`/api/cargas/${ruta}`, () => HttpResponse.error()),
  );
}

/** Los dos POST responden 2xx con un cuerpo que no cumple el contrato. */
export function subidaFueraDeContrato() {
  return RUTAS_DE_SUBIDA.map((ruta) =>
    http.post(`/api/cargas/${ruta}`, () =>
      HttpResponse.json({ id: 'no-es-una-carga' }, { status: 202 }),
    ),
  );
}
