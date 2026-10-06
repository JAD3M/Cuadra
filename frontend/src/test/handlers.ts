import { http, HttpResponse } from 'msw';
import { crearHandlersBandeja } from '@/test/handlersBandeja';
import { crearHandlersCargas } from '@/test/handlersCargas';
import { crearHandlersCaso } from '@/test/handlersCaso';
import {
  CONTEXTO_SESION,
  EMPRESAS_DISPONIBLES,
  RESPUESTA_LOGIN,
  RESPUESTA_TOKEN,
} from '@/test/fixtures';

// Manejadores por defecto: los caminos felices de CU-19 con los payloads de
// `fixtures.ts`, los de la bandeja (CU-22) con `fixturesBandeja.ts` y el detalle del caso
// (CU-23) con `fixturesCaso.ts` y las cargas (CU-24) con `fixturesCargas.ts`. Las pruebas que necesitan otra respuesta usan
// `servidor.use(...)`. Los caminos llevan el prefijo `/api` porque el
// cliente lo antepone (en desarrollo el proxy de Vite lo retira).
const bandeja = crearHandlersBandeja();
const caso = crearHandlersCaso(bandeja);
const cargas = crearHandlersCargas();

/**
 * Los almacenes en memoria de los manejadores por defecto, para que un flujo
 * fije los datos que sirven (`establecer`) o fuerce un fallo (`opciones`). Los
 * limpia `reiniciarHandlers` tras cada prueba.
 */
export const almacenes = { bandeja, caso, cargas };

export const handlers = [
  http.post('/api/auth/login', () => HttpResponse.json(RESPUESTA_LOGIN)),
  http.get('/api/auth/empresas', () => HttpResponse.json(EMPRESAS_DISPONIBLES)),
  http.post('/api/auth/empresa/:id', () => HttpResponse.json(RESPUESTA_TOKEN)),
  http.get('/api/auth/contexto', () => HttpResponse.json(CONTEXTO_SESION)),
  ...bandeja.handlers,
  ...caso.handlers,
  ...cargas.handlers,
];

/**
 * Devuelve al estado de arranque los datos en memoria de los manejadores por
 * defecto (bandeja, caso y cargas): una resolución en una prueba no se filtra a otra.
 */
export function reiniciarHandlers(): void {
  bandeja.reiniciar();
  caso.reiniciar();
  cargas.reiniciar();
}
