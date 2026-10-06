import Decimal from 'decimal.js';
import { http, HttpResponse } from 'msw';
import type { FilaBandeja } from '@/shared/api/contratos';
import {
  ESTADOS_BANDEJA,
  ESTADOS_POR_DEFECTO,
  LIMITE_MAXIMO,
  LIMITE_POR_DEFECTO,
} from '@/shared/dominio/bandeja';
import { FILAS_DEMO, resumenDe } from '@/test/fixturesBandeja';

// Manejadores de `GET /bandeja` y `GET /bandeja/resumen` que sirven UN solo
// conjunto de datos a las dos rutas, con las reglas del backend: 400 con un
// estado, página o límite inválidos, orden `monto desc, id`, `total` sin
// paginar y un resumen siempre coherente con la lista.

function rechazo(mensajes: string[]) {
  return HttpResponse.json(
    { statusCode: 400, error: 'Bad Request', message: mensajes },
    { status: 400 },
  );
}

function enteroPositivo(valor: string): number | null {
  if (!/^\d+$/.test(valor)) return null;
  const n = Number.parseInt(valor, 10);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

function porMontoDesc(a: FilaBandeja, b: FilaBandeja): number {
  const orden = new Decimal(b.monto).comparedTo(a.monto);
  if (orden !== 0) return orden;
  return a.movimientoId < b.movimientoId ? -1 : 1;
}

export function crearHandlersBandeja(
  inicial: readonly FilaBandeja[] = FILAS_DEMO,
) {
  let filas = [...inicial];

  const lista = http.get('/api/bandeja', ({ request }) => {
    const { searchParams } = new URL(request.url);
    const errores: string[] = [];

    const pedidos = searchParams.getAll('estado');
    const validos = new Set<string>(ESTADOS_BANDEJA);
    if (pedidos.some((e) => !validos.has(e))) {
      errores.push('each value in estado must be a valid enum value');
    }
    if (new Set(pedidos).size !== pedidos.length) {
      errores.push("All estado's elements must be unique");
    }

    const paginaPedida = searchParams.get('pagina');
    const pagina = paginaPedida === null ? 1 : enteroPositivo(paginaPedida);
    if (pagina === null) errores.push('pagina must not be less than 1');

    const limitePedido = searchParams.get('limite');
    const limite =
      limitePedido === null ? LIMITE_POR_DEFECTO : enteroPositivo(limitePedido);
    if (limite === null || limite > LIMITE_MAXIMO) {
      errores.push(`limite must not be greater than ${LIMITE_MAXIMO}`);
    }
    if (errores.length > 0 || pagina === null || limite === null) {
      return rechazo(errores);
    }

    const estados: readonly string[] =
      pedidos.length > 0 ? pedidos : ESTADOS_POR_DEFECTO;
    const filtradas = filas
      .filter((f) => estados.includes(f.estado))
      .sort(porMontoDesc);
    const desde = (pagina - 1) * limite;
    return HttpResponse.json({
      datos: filtradas.slice(desde, desde + limite),
      pagina,
      limite,
      total: filtradas.length,
    });
  });

  const resumen = http.get('/api/bandeja/resumen', () =>
    HttpResponse.json(resumenDe(filas)),
  );

  return {
    handlers: [lista, resumen],
    /** Reemplaza el conjunto de datos que sirven las dos rutas. */
    establecer(nuevas: readonly FilaBandeja[]) {
      filas = [...nuevas];
    },
    /** Devuelve el conjunto de datos al que tenía al crearse. */
    reiniciar() {
      filas = [...inicial];
    },
    filas: () => [...filas],
  };
}
