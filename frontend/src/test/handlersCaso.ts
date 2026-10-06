import { http, HttpResponse } from 'msw';
import type { FilaBandeja, RespuestaCaso } from '@/shared/api/contratos';
import { FILAS_DEMO } from '@/test/fixturesBandeja';
import { casoDeFila } from '@/test/fixturesCaso';

// Manejador de `GET /casos/:movimientoId` con las reglas del backend: 400 si
// el id no es un uuid, 404 si no existe. Sirve el caso de cada fila de la
// bandeja de demostración y puede reemplazarse por casos propios.

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ERROR_NEST = (status: number, mensaje: string) =>
  HttpResponse.json(
    { statusCode: status, error: 'Error', message: mensaje },
    { status },
  );

export function crearHandlersCaso(
  inicial: readonly FilaBandeja[] = FILAS_DEMO,
) {
  let casos = new Map<string, RespuestaCaso>(
    inicial.map((f) => [f.movimientoId, casoDeFila(f)]),
  );

  const detalle = http.get('/api/casos/:movimientoId', ({ params }) => {
    const id = String(params.movimientoId);
    if (!GUID.test(id)) {
      return ERROR_NEST(400, 'Validation failed (uuid is expected)');
    }
    const caso = casos.get(id);
    return caso === undefined
      ? ERROR_NEST(404, 'Movimiento no encontrado')
      : HttpResponse.json(caso);
  });

  return {
    handlers: [detalle],
    /** Reemplaza los casos que sirve la ruta. */
    establecer(nuevos: readonly RespuestaCaso[]) {
      casos = new Map(nuevos.map((c) => [c.movimiento.id, c]));
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
