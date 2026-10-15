import { http, HttpResponse } from 'msw';
import { ID_EMPRESA_B, sesionConEmpresa } from '@/test/sesionMock';
import { servidor } from '@/test/servidor';

// Respuestas simuladas de las rutas públicas de invitación
// (`/auth/invitaciones/:token`). El servidor simulado se comporta como el
// backend: el GET es siempre 200 con la misma forma; el POST responde 410 con
// `motivo` si el enlace no vale, 404 si no existe, 403 con la cuenta inactiva
// y 400 si falta nombre o la contraseña es corta (la invitación sigue viva).

export const TOKEN_INVITACION = 'tok-invitacion-de-prueba';
export const EMPRESA_INVITACION = 'Ferretería Aurora S.A. de C.V.';

export type EstadoServidorInvitacion =
  | { tipo: 'vigente'; requierePassword: boolean }
  | {
      tipo: 'invalida';
      motivo:
        'usada' | 'caducada' | 'reemplazada' | 'cancelada' | 'desconocida';
    }
  | { tipo: 'inactiva' };

let estado: EstadoServidorInvitacion = {
  tipo: 'vigente',
  requierePassword: true,
};

export interface CuerpoAceptar {
  nombre?: unknown;
  password?: unknown;
}

/** Cuerpos recibidos por `POST /auth/invitaciones/:token/aceptar`. */
export const cuerposAceptar: CuerpoAceptar[] = [];
/** Tokens con los que se pidió `GET` y `POST`, en orden. */
export const tokensPedidos: string[] = [];

function cuerpoDeError(status: number, extra: object = {}) {
  return HttpResponse.json(
    { statusCode: status, error: 'x', message: 'texto del servidor', ...extra },
    { status },
  );
}

const MOTIVO_DEL_ESTADO = (e: EstadoServidorInvitacion) =>
  e.tipo === 'invalida' ? e.motivo : null;

export function crearHandlersInvitaciones() {
  return [
    http.get('/api/auth/invitaciones/:token', ({ params }) => {
      tokensPedidos.push(String(params['token']));
      if (estado.tipo === 'invalida') {
        return HttpResponse.json({
          estado: 'invalida',
          motivo: estado.motivo,
          empresa: null,
          requierePassword: null,
        });
      }
      return HttpResponse.json({
        estado: 'vigente',
        motivo: null,
        empresa: EMPRESA_INVITACION,
        requierePassword:
          estado.tipo === 'vigente' ? estado.requierePassword : false,
      });
    }),
    http.post(
      '/api/auth/invitaciones/:token/aceptar',
      async ({ request, params }) => {
        tokensPedidos.push(String(params['token']));
        const cuerpo = (await request.json()) as CuerpoAceptar;
        cuerposAceptar.push(cuerpo);
        const motivo = MOTIVO_DEL_ESTADO(estado);
        if (motivo === 'desconocida') return cuerpoDeError(404);
        if (motivo) return cuerpoDeError(410, { motivo });
        if (estado.tipo === 'inactiva') return cuerpoDeError(403);
        if (estado.tipo === 'vigente' && estado.requierePassword) {
          const { nombre, password } = cuerpo;
          if (typeof nombre !== 'string' || nombre.trim() === '') {
            return cuerpoDeError(400);
          }
          if (typeof password !== 'string' || password.length < 12) {
            return cuerpoDeError(400);
          }
        }
        // Como el backend: acepta, consume el enlace y abre la sesión.
        estado = { tipo: 'invalida', motivo: 'usada' };
        sesionConEmpresa(ID_EMPRESA_B);
        return HttpResponse.json({
          companyId: ID_EMPRESA_B,
          razonSocial: EMPRESA_INVITACION,
          cuentaNueva: true,
        });
      },
    ),
  ];
}

/** Instala los manejadores y deja el enlace en el estado dado. */
export function usarHandlersInvitaciones(
  inicial: EstadoServidorInvitacion = {
    tipo: 'vigente',
    requierePassword: true,
  },
): void {
  estado = inicial;
  cuerposAceptar.length = 0;
  tokensPedidos.length = 0;
  servidor.use(...crearHandlersInvitaciones());
}

/** El enlace pasa a este estado sin reinstalar manejadores. */
export function cambiarEstadoInvitacion(nuevo: EstadoServidorInvitacion): void {
  estado = nuevo;
}

/** `GET /auth/invitaciones/:token` responde `status`. */
export function consultarInvitacionFalla(status: number) {
  servidor.use(
    http.get('/api/auth/invitaciones/:token', () => cuerpoDeError(status)),
  );
}

/** `POST /auth/invitaciones/:token/aceptar` responde `status`. */
export function aceptarInvitacionFalla(status: number) {
  servidor.use(
    http.post('/api/auth/invitaciones/:token/aceptar', () =>
      cuerpoDeError(status),
    ),
  );
}
