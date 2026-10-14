import { http, HttpResponse } from 'msw';
import { normalizarRfc, validarRfc } from '@/shared/dominio';
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

export interface CuerpoCrearEmpresa {
  razonSocial?: unknown;
  rfc?: unknown;
}

interface EmpresaSimulada {
  id: string;
  razonSocial: string;
  rfc: string;
}

/** Empresas que tiene el servidor simulado; la lista y el alta comparten esto. */
const empresasSimuladas: EmpresaSimulada[] = [];

/** Cuerpos recibidos por `POST /plataforma/empresas`, en orden. */
export const cuerposCrearEmpresa: CuerpoCrearEmpresa[] = [];

export interface CuerpoInvitar {
  email?: unknown;
}

/** Invitaciones recibidas por `POST /plataforma/empresas/:id/invitaciones`. */
export const invitacionesRecibidas: {
  empresaId: string;
  cuerpo: CuerpoInvitar;
}[] = [];

/** Deja en el servidor simulado estas empresas (y nada más). */
export function sembrarEmpresasPlataforma(
  empresas: readonly EmpresaSimulada[],
): void {
  empresasSimuladas.length = 0;
  empresasSimuladas.push(...empresas);
}

let contador = 0;

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
      haySesionPlataforma()
        ? HttpResponse.json([...empresasSimuladas])
        : rechazoDeSesion(),
    ),
    // Como el backend: razón social sin espacios en los bordes y no vacía, RFC
    // normalizado; 400 si el formato no vale o es genérico; 409 si ya existe.
    http.post('/api/plataforma/empresas', async ({ request }) => {
      if (!haySesionPlataforma()) return rechazoDeSesion();
      const cuerpo = (await request.json()) as CuerpoCrearEmpresa;
      cuerposCrearEmpresa.push(cuerpo);
      if (typeof cuerpo.razonSocial !== 'string') return cuerpoDeError(400);
      if (typeof cuerpo.rfc !== 'string') return cuerpoDeError(400);
      const razonSocial = cuerpo.razonSocial.trim();
      if (razonSocial === '' || razonSocial.length > 255) {
        return cuerpoDeError(400);
      }
      const rfc = normalizarRfc(cuerpo.rfc);
      if (!validarRfc(rfc).valido) return cuerpoDeError(400);
      if (empresasSimuladas.some((e) => e.rfc === rfc)) {
        return cuerpoDeError(409);
      }
      contador += 1;
      const empresa = {
        id: `00000000-0000-4000-8000-${String(contador).padStart(12, '0')}`,
        razonSocial,
        rfc,
      };
      empresasSimuladas.push(empresa);
      return HttpResponse.json(empresa, { status: 201 });
    }),
    // Como el backend: 404 si la empresa no existe, 400 sin correo, 201 con
    // `{ email }` exista o no la cuenta (el cuerpo no distingue).
    http.post(
      '/api/plataforma/empresas/:id/invitaciones',
      async ({ request, params }) => {
        if (!haySesionPlataforma()) return rechazoDeSesion();
        const cuerpo = (await request.json()) as CuerpoInvitar;
        const empresaId = String(params['id']);
        invitacionesRecibidas.push({ empresaId, cuerpo });
        if (!empresasSimuladas.some((e) => e.id === empresaId)) {
          return cuerpoDeError(404);
        }
        if (typeof cuerpo.email !== 'string') return cuerpoDeError(400);
        return HttpResponse.json({ email: cuerpo.email }, { status: 201 });
      },
    ),
  ];
}

/** Instala los manejadores de plataforma y limpia el estado de la sesión. */
export function usarHandlersPlataforma(): void {
  reiniciarSesionPlataforma();
  cuerposLogin.length = 0;
  cuerposCrearEmpresa.length = 0;
  invitacionesRecibidas.length = 0;
  empresasSimuladas.length = 0;
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

/** `POST /plataforma/empresas` responde `status`. */
export function crearEmpresaPlataformaFalla(status: number) {
  servidor.use(
    http.post('/api/plataforma/empresas', () => cuerpoDeError(status)),
  );
}

/** `POST /plataforma/empresas` falla en la red. */
export function crearEmpresaPlataformaRedDeFallo() {
  servidor.use(
    http.post('/api/plataforma/empresas', () => HttpResponse.error()),
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

/** `POST /plataforma/empresas/:id/invitaciones` responde `status`. */
export function invitarPlataformaFalla(status: number) {
  servidor.use(
    http.post('/api/plataforma/empresas/:id/invitaciones', () =>
      cuerpoDeError(status),
    ),
  );
}

/** `POST /plataforma/empresas/:id/invitaciones` falla en la red. */
export function invitarPlataformaRedDeFallo() {
  servidor.use(
    http.post('/api/plataforma/empresas/:id/invitaciones', () =>
      HttpResponse.error(),
    ),
  );
}

/** `POST /plataforma/empresas/:id/invitaciones` devuelve este cuerpo con 201. */
export function invitarPlataformaResponde(cuerpo: object) {
  servidor.use(
    http.post('/api/plataforma/empresas/:id/invitaciones', () =>
      HttpResponse.json(cuerpo, { status: 201 }),
    ),
  );
}
