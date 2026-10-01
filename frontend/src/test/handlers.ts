import { http, HttpResponse } from 'msw';
import {
  CONTEXTO_SESION,
  EMPRESAS_DISPONIBLES,
  RESPUESTA_LOGIN,
  RESPUESTA_TOKEN,
} from '@/test/fixtures';

// Manejadores por defecto: los caminos felices de CU-19 con los payloads de
// `fixtures.ts`. Las pruebas que necesitan otra respuesta usan
// `servidor.use(...)`. Los caminos llevan el prefijo `/api` porque el
// cliente lo antepone (en desarrollo el proxy de Vite lo retira).
export const handlers = [
  http.post('/api/auth/login', () => HttpResponse.json(RESPUESTA_LOGIN)),
  http.get('/api/auth/empresas', () => HttpResponse.json(EMPRESAS_DISPONIBLES)),
  http.post('/api/auth/empresa/:id', () => HttpResponse.json(RESPUESTA_TOKEN)),
  http.get('/api/auth/contexto', () => HttpResponse.json(CONTEXTO_SESION)),
];
