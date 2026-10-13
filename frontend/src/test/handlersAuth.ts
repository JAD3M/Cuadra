import { http, HttpResponse } from 'msw';
import {
  CONTEXTO_SESION,
  CONTEXTO_SESION_B,
  EMPRESAS_DISPONIBLES,
  RESPUESTA_LOGIN_UNA_EMPRESA,
} from '@/test/fixtures';
import {
  elegirEmpresaMock,
  empresaDeLaSesion,
  hayEmpresaElegida,
} from '@/test/sesionMock';
import { servidor } from '@/test/servidor';

// Respuestas alternas de la API de autenticación para las pruebas de flujo.
// Cada función se instala con `servidor.use(...)` y la limpia el `afterEach`
// global (`resetHandlers`). Los textos del servidor son a propósito distintos
// de cualquier copy de la interfaz: nunca deben llegar a la pantalla.

function cuerpoDeError(status: number) {
  return HttpResponse.json(
    { statusCode: status, error: 'x', message: 'texto del servidor' },
    { status },
  );
}

/** `POST /auth/login` responde `status` (por omisión 401). */
export function loginFalla(status = 401) {
  servidor.use(http.post('/api/auth/login', () => cuerpoDeError(status)));
}

/** `POST /auth/login` falla en la red (sin respuesta). */
export function loginRedDeFallo() {
  servidor.use(http.post('/api/auth/login', () => HttpResponse.error()));
}

/** `POST /auth/login` entrega un usuario con una sola empresa. */
export function loginUnaEmpresa() {
  servidor.use(
    http.post('/api/auth/login', () =>
      HttpResponse.json(RESPUESTA_LOGIN_UNA_EMPRESA),
    ),
  );
}

/** `GET /auth/empresas` entrega esta lista (por omisión las dos del fixture). */
export function empresasLista(
  empresas: readonly object[] = EMPRESAS_DISPONIBLES,
) {
  servidor.use(
    http.get('/api/auth/empresas', () => HttpResponse.json([...empresas])),
  );
}

/** `GET /auth/empresas` responde `status`. */
export function empresasFalla(status: number) {
  servidor.use(http.get('/api/auth/empresas', () => cuerpoDeError(status)));
}

/** `POST /auth/empresa/:id` responde `status`. */
export function seleccionFalla(status: number) {
  servidor.use(http.post('/api/auth/empresa/:id', () => cuerpoDeError(status)));
}

/** `GET /auth/contexto` responde `status`. */
export function contextoFalla(status: number) {
  servidor.use(http.get('/api/auth/contexto', () => cuerpoDeError(status)));
}

/** `GET /auth/contexto` falla en la red. */
export function contextoRedDeFallo() {
  servidor.use(http.get('/api/auth/contexto', () => HttpResponse.error()));
}

/**
 * `POST /auth/empresa/:id` recuerda la empresa elegida en la sesión simulada y
 * responde su contexto; `GET /auth/contexto` responde el de esa empresa: el de
 * la empresa B trae `CONTEXTO_SESION_B`; cualquier otra, `CONTEXTO_SESION`.
 * Sirve para probar que los datos de una empresa no aparecen bajo otra. Los
 * manejadores de datos leen la empresa con `empresaDeLaSesion()`.
 */
export function contextoPorEmpresa(idEmpresaB: string) {
  const contextoDe = (id: string | null) =>
    id === idEmpresaB ? CONTEXTO_SESION_B : CONTEXTO_SESION;
  servidor.use(
    http.post('/api/auth/empresa/:id', ({ params }) => {
      elegirEmpresaMock(String(params.id));
      return HttpResponse.json(contextoDe(String(params.id)));
    }),
    http.get('/api/auth/contexto', () =>
      hayEmpresaElegida()
        ? HttpResponse.json(contextoDe(empresaDeLaSesion()))
        : cuerpoDeError(401),
    ),
  );
}

export interface Solicitud {
  metodo: string;
  ruta: string;
  /** Cabecera `Authorization`: con cookies nunca debe viajar. */
  autorizacion: string | null;
  /** `credentials` de la petición: `include` manda la cookie de sesión. */
  credenciales: RequestCredentials;
  /** Empresa de la sesión simulada cuando llegó la petición. */
  empresa: string | null;
}

/**
 * Registra cada petición que llega al servidor de pruebas. `detener()` quita
 * solo este oyente. `ruta` filtra por camino exacto (sin la query).
 */
export function espiarSolicitudes() {
  const solicitudes: Solicitud[] = [];
  const oyente = ({ request }: { request: Request }) => {
    solicitudes.push({
      metodo: request.method,
      ruta: new URL(request.url).pathname,
      autorizacion: request.headers.get('Authorization'),
      credenciales: request.credentials,
      empresa: empresaDeLaSesion(),
    });
  };
  servidor.events.on('request:start', oyente);
  return {
    solicitudes,
    cuantas: (metodo: string, ruta: string) =>
      solicitudes.filter((s) => s.metodo === metodo && s.ruta === ruta).length,
    detener: () => servidor.events.removeListener('request:start', oyente),
  };
}
