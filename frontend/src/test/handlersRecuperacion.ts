import { http, HttpResponse } from 'msw';
import { servidor } from '@/test/servidor';

// Respuestas simuladas de las rutas públicas de recuperación
// (`/auth/recuperacion`). El servidor simulado se comporta como el backend:
// pedir responde siempre 200 con el mismo texto; el GET es siempre 200; el
// POST de restablecer responde 410 con `motivo` si el enlace no vale, 404 si
// no existe, 403 con la cuenta desactivada y 400 si la contraseña es corta
// (el enlace sigue vivo). Restablecer bien consume el enlace.

export const TOKEN_RECUPERACION = 'tok-recuperacion-de-prueba';
export const MENSAJE_SOLICITUD =
  'Si el correo corresponde a una cuenta activa, te enviamos un enlace para restablecer la contraseña. Vence en 1 hora.';

export type EstadoServidorRecuperacion =
  | { tipo: 'vigente' }
  | {
      tipo: 'invalida';
      motivo: 'usada' | 'caducada' | 'reemplazada' | 'desconocida';
    }
  | { tipo: 'desactivada' };

let estado: EstadoServidorRecuperacion = { tipo: 'vigente' };

/** Correos recibidos por `POST /auth/recuperacion`, en orden. */
export const correosPedidos: string[] = [];
/** Contraseñas recibidas por `POST /auth/recuperacion/:token`, en orden. */
export const contrasenasRecibidas: string[] = [];
/** Tokens con los que se pidió `GET` y `POST`, en orden. */
export const tokensPedidos: string[] = [];

function cuerpoDeError(status: number, extra: object = {}) {
  return HttpResponse.json(
    { statusCode: status, error: 'x', message: 'texto del servidor', ...extra },
    { status },
  );
}

export function crearHandlersRecuperacion() {
  return [
    http.post('/api/auth/recuperacion', async ({ request }) => {
      const cuerpo = (await request.json()) as { email?: unknown };
      correosPedidos.push(String(cuerpo.email));
      return HttpResponse.json({ mensaje: MENSAJE_SOLICITUD });
    }),
    http.get('/api/auth/recuperacion/:token', ({ params }) => {
      tokensPedidos.push(String(params['token']));
      if (estado.tipo === 'invalida') {
        return HttpResponse.json({ estado: 'invalida', motivo: estado.motivo });
      }
      return HttpResponse.json({ estado: 'vigente', motivo: null });
    }),
    http.post('/api/auth/recuperacion/:token', async ({ request, params }) => {
      tokensPedidos.push(String(params['token']));
      const { password } = (await request.json()) as { password?: unknown };
      contrasenasRecibidas.push(String(password));
      if (estado.tipo === 'invalida') {
        return estado.motivo === 'desconocida'
          ? cuerpoDeError(404, { motivo: 'desconocida' })
          : cuerpoDeError(410, { motivo: estado.motivo });
      }
      if (estado.tipo === 'desactivada') return cuerpoDeError(403);
      if (typeof password !== 'string' || password.length < 12) {
        return cuerpoDeError(400);
      }
      estado = { tipo: 'invalida', motivo: 'usada' };
      return HttpResponse.json({
        mensaje: 'Tu contraseña se actualizó. Inicia sesión con la nueva.',
      });
    }),
  ];
}

/** Instala los manejadores y deja el enlace en el estado dado. */
export function usarHandlersRecuperacion(
  inicial: EstadoServidorRecuperacion = { tipo: 'vigente' },
): void {
  estado = inicial;
  correosPedidos.length = 0;
  contrasenasRecibidas.length = 0;
  tokensPedidos.length = 0;
  servidor.use(...crearHandlersRecuperacion());
}

/** El enlace pasa a este estado sin reinstalar manejadores. */
export function cambiarEstadoRecuperacion(
  nuevo: EstadoServidorRecuperacion,
): void {
  estado = nuevo;
}

/** `POST /auth/recuperacion` responde `status`. */
export function pedirRecuperacionFalla(status: number) {
  servidor.use(
    http.post('/api/auth/recuperacion', () => cuerpoDeError(status)),
  );
}

/** `GET /auth/recuperacion/:token` responde `status`. */
export function consultarRecuperacionFalla(status: number) {
  servidor.use(
    http.get('/api/auth/recuperacion/:token', () => cuerpoDeError(status)),
  );
}

/** `POST /auth/recuperacion/:token` responde `status`. */
export function restablecerFalla(status: number) {
  servidor.use(
    http.post('/api/auth/recuperacion/:token', () => cuerpoDeError(status)),
  );
}
