import { http, HttpResponse } from 'msw';
import type { VistaPreviaCarga } from '@/shared/api/contratos';

// Apoyo de las pruebas de la vista previa (historia 3.4): el cuerpo que
// responde el backend y manejadores de MSW por escenario. Solo lo importan
// archivos `.test`.

export const ID_CARGA = '0192a3f4-0000-7000-8000-0000000000c1';

const MOVIMIENTOS: VistaPreviaCarga['movimientos'] = [
  {
    fecha: '2026-09-01',
    monto: '1500.0000',
    referencia: 'SPEI RECIBIDO 4471 ABARROTES DEL NORTE',
  },
  { fecha: '2026-09-02', monto: '-250.0000', referencia: 'COMPRA OXXO 0231' },
  { fecha: '2026-09-03', monto: '-3820.4000', referencia: null },
];

/** Una vista previa con saldos, como la responde `GET /cargas/:id/vista-previa`. */
export function vistaPrevia(
  o: Partial<VistaPreviaCarga> = {},
): VistaPreviaCarga {
  return {
    cargaId: ID_CARGA,
    archivo: 'estado-sep-2026.pdf',
    banco: 'bbva',
    total: 3,
    saldoInicial: '10000.0000',
    saldoFinal: '11250.5000',
    movimientos: MOVIMIENTOS.map((m) => ({ ...m })),
    ...o,
  };
}

const ERROR_NEST = (status: number, mensaje: string) =>
  HttpResponse.json(
    { statusCode: status, error: 'Error', message: mensaje },
    { status },
  );

export const RUTA_VISTA_PREVIA = '/api/cargas/:id/vista-previa';
export const RUTA_ACEPTAR = '/api/cargas/:id/aceptar';
export const RUTA_RECHAZAR = '/api/cargas/:id/rechazar';

export const leerVistaPrevia = (cuerpo: VistaPreviaCarga = vistaPrevia()) =>
  http.get(RUTA_VISTA_PREVIA, () => HttpResponse.json(cuerpo));

export const leerVistaPreviaFalla = (status: number) =>
  http.get(RUTA_VISTA_PREVIA, () => ERROR_NEST(status, 'error'));

export const aceptarResponde = (movimientos = 3) =>
  http.post(RUTA_ACEPTAR, ({ params }) =>
    HttpResponse.json({
      cargaId: String(params.id),
      estado: 'procesada',
      movimientos,
    }),
  );

export const rechazarResponde = () =>
  http.post(RUTA_RECHAZAR, ({ params }) =>
    HttpResponse.json({ cargaId: String(params.id), estado: 'rechazada' }),
  );

export const aceptarFalla = (status: number) =>
  http.post(RUTA_ACEPTAR, () => ERROR_NEST(status, 'error'));

export const rechazarFalla = (status: number) =>
  http.post(RUTA_RECHAZAR, () => ERROR_NEST(status, 'error'));
