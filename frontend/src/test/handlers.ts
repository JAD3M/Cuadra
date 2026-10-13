import { http, HttpResponse } from 'msw';
import { crearHandlersBandeja } from '@/test/handlersBandeja';
import { crearHandlersBitacora } from '@/test/handlersBitacora';
import { crearHandlersCargas } from '@/test/handlersCargas';
import { crearHandlersCaso } from '@/test/handlersCaso';
import { crearHandlersTolerancia } from '@/test/handlersTolerancia';
import { CAMBIOS_INICIALES } from '@/test/fixturesTolerancia';
import {
  CONTEXTO_SESION,
  EMPRESAS_DISPONIBLES,
  RESPUESTA_LOGIN,
} from '@/test/fixtures';
import {
  abrirSesion,
  cerrarSesionMock,
  elegirEmpresaMock,
  hayEmpresaElegida,
  haySesion,
  reiniciarSesionMock,
} from '@/test/sesionMock';

// Manejadores por defecto: los caminos felices de CU-19 con los payloads de
// `fixtures.ts`, los de la bandeja (CU-22) con `fixturesBandeja.ts` y el detalle del caso
// (CU-23) con `fixturesCaso.ts`, las cargas (CU-24) con `fixturesCargas.ts` y la
// tolerancia con su bitácora (CU-25) con `fixturesTolerancia.ts`, y la pantalla
// de la bitácora (CU-26) con `fixturesBitacora.ts`. Las pruebas que necesitan
// otra respuesta usan `servidor.use(...)`. Los caminos llevan el prefijo `/api` porque el
// cliente lo antepone (en desarrollo el proxy de Vite lo retira).
const bandeja = crearHandlersBandeja();
const caso = crearHandlersCaso(bandeja);
const cargas = crearHandlersCargas();
// UN almacén de eventos de bitácora para toda la app: lo escribe el PUT de la
// tolerancia y lo lee la pantalla de la bitácora. `GET /api/bitacora` se
// registra UNA vez (el de la tolerancia, que registra la petición en su
// historial y delega en el almacén); el primer manejador que coincide gana, así
// que registrar también el de `bitacora.handlers` lo taparía o sería tapado.
// Arranca con los eventos de la tolerancia (`CAMBIOS_INICIALES`); los flujos de
// la bitácora fijan los suyos con `almacenes.bitacora.establecer(...)`.
const bitacora = crearHandlersBitacora(CAMBIOS_INICIALES);
const tolerancia = crearHandlersTolerancia('0.5000', undefined, bitacora);

/**
 * Los almacenes en memoria de los manejadores por defecto, para que un flujo
 * fije los datos que sirven (`establecer`) o fuerce un fallo (`opciones`). Los
 * limpia `reiniciarHandlers` tras cada prueba.
 */
export const almacenes = { bandeja, caso, cargas, tolerancia, bitacora };

function sinSesion() {
  return HttpResponse.json(
    { statusCode: 401, error: 'Unauthorized', message: 'No autorizado' },
    { status: 401 },
  );
}

// Autenticación por cookie: el servidor simulado recuerda la sesión
// (`sesionMock.ts`). Sin sesión con empresa, `GET /auth/contexto` es 401, igual
// que el backend, de modo que una app recién montada arranca en el login. Las
// pruebas que parten de una sesión ya abierta usan `sesionConEmpresa()`.
export const handlers = [
  http.post('/api/auth/login', () => {
    abrirSesion();
    return HttpResponse.json(RESPUESTA_LOGIN);
  }),
  // El backend de la historia 1.1 solo lista empresas a una sesión sin empresa
  // elegida (con empresa responde 401). El simulado también las lista con
  // empresa para poder ejercitar el cambio de empresa que prevé AD-6.
  http.get('/api/auth/empresas', () =>
    haySesion() ? HttpResponse.json(EMPRESAS_DISPONIBLES) : sinSesion(),
  ),
  http.post('/api/auth/empresa/:id', ({ params }) => {
    elegirEmpresaMock(String(params.id));
    return HttpResponse.json(CONTEXTO_SESION);
  }),
  http.post('/api/auth/logout', () => {
    cerrarSesionMock();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('/api/auth/contexto', () =>
    hayEmpresaElegida() ? HttpResponse.json(CONTEXTO_SESION) : sinSesion(),
  ),
  ...bandeja.handlers,
  ...caso.handlers,
  ...cargas.handlers,
  ...bitacora.handlersUsuarios,
  ...tolerancia.handlers,
];

/**
 * Devuelve al estado de arranque los datos en memoria de los manejadores por
 * defecto (bandeja, caso, cargas, tolerancia y bitácora): una resolución en una prueba no se filtra a otra.
 */
export function reiniciarHandlers(): void {
  reiniciarSesionMock();
  bandeja.reiniciar();
  caso.reiniciar();
  cargas.reiniciar();
  tolerancia.reiniciar();
  bitacora.reiniciar();
}
