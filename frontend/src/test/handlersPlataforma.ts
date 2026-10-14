import { http, HttpResponse } from 'msw';
import { servidor } from '@/test/servidor';

// Respuestas simuladas de la API de plataforma (`/plataforma/...`). Se instalan
// con `servidor.use(...)`: no forman parte de los manejadores por defecto, que
// son los de la empresa. La sesión del servidor simulado vive aquí (la cookie
// real es `httpOnly`); `reiniciarSesionPlataforma()` la limpia entre pruebas.

export const DUENO = {
  id: '5d8f3c1e-7a4b-4f6d-9c2e-1b3a5c7d9e0f',
  correo: 'dueno@cuadra.mx',
} as const;

export const CLAVE_DUENO = 'una-clave-larga-12';

type SesionServidor = 'ninguna' | 'plataforma' | 'empresa';

let sesion: SesionServidor = 'ninguna';

/** Sin cookie: un navegador que nunca inició sesión. */
export function reiniciarSesionPlataforma(): void {
  sesion = 'ninguna';
}

/** Hay una sesión de plataforma viva, como tras iniciar sesión antes. */
export function sesionPlataformaAbierta(): void {
  sesion = 'plataforma';
}

/** El navegador trae la cookie de una sesión de empresa (cruce de mundos). */
export function sesionDeEmpresaEnPlataforma(): void {
  sesion = 'empresa';
}

export function haySesionPlataforma(): boolean {
  return sesion === 'plataforma';
}

function cuerpoDeError(status: number) {
  return HttpResponse.json(
    { statusCode: status, error: 'x', message: 'texto del servidor' },
    { status },
  );
}

/** 401 sin sesión, 403 con la cookie de otro mundo. */
function rechazoDeSesion() {
  return cuerpoDeError(sesion === 'empresa' ? 403 : 401);
}

export interface SolicitudLoginPlataforma {
  email?: unknown;
  password?: unknown;
}

/** Cuerpos recibidos por `POST /plataforma/auth/login`, en orden. */
export const cuerposLogin: SolicitudLoginPlataforma[] = [];

export function crearHandlersPlataforma() {
  return [
    http.post('/api/plataforma/auth/login', async ({ request }) => {
      const cuerpo = (await request.json()) as SolicitudLoginPlataforma;
      cuerposLogin.push(cuerpo);
      // Como el backend: el campo es `email`; sin él es 400.
      if (typeof cuerpo.email !== 'string') return cuerpoDeError(400);
      if (cuerpo.email !== DUENO.correo || cuerpo.password !== CLAVE_DUENO) {
        return cuerpoDeError(401);
      }
      sesion = 'plataforma';
      return HttpResponse.json({ usuario: { ...DUENO } });
    }),
    http.get('/api/plataforma/auth/me', () =>
      haySesionPlataforma()
        ? HttpResponse.json({ usuario: { ...DUENO } })
        : rechazoDeSesion(),
    ),
    http.post('/api/plataforma/auth/logout', () => {
      sesion = 'ninguna';
      return new HttpResponse(null, { status: 204 });
    }),
    http.get('/api/plataforma/empresas', () =>
      haySesionPlataforma() ? HttpResponse.json([]) : rechazoDeSesion(),
    ),
  ];
}

/** Instala los manejadores de plataforma y limpia el estado de la sesión. */
export function usarHandlersPlataforma(): void {
  reiniciarSesionPlataforma();
  cuerposLogin.length = 0;
  servidor.use(...crearHandlersPlataforma());
}

/** `POST /plataforma/auth/login` responde `status`. */
export function loginPlataformaFalla(status: number) {
  servidor.use(
    http.post('/api/plataforma/auth/login', () => cuerpoDeError(status)),
  );
}

/** `POST /plataforma/auth/login` falla en la red. */
export function loginPlataformaRedDeFallo() {
  servidor.use(
    http.post('/api/plataforma/auth/login', () => HttpResponse.error()),
  );
}

/** `GET /plataforma/empresas` responde `status`. */
export function empresasPlataformaFalla(status: number) {
  servidor.use(
    http.get('/api/plataforma/empresas', () => cuerpoDeError(status)),
  );
}

/** `GET /plataforma/empresas` entrega esta lista. */
export function empresasPlataformaLista(empresas: readonly object[]) {
  servidor.use(
    http.get('/api/plataforma/empresas', () =>
      HttpResponse.json([...empresas]),
    ),
  );
}
