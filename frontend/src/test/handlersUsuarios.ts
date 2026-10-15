import { http, HttpResponse } from 'msw';
import type { InvitacionPendiente } from '@/shared/api/contratos/usuarios';
import { servidor } from './servidor';

const DIA_MS = 86_400_000;

/**
 * Invitación pendiente simulada. `venceEnDias` positivo: vigente con esos días
 * por delante; no positivo: ya venció (`vencida: true`).
 */
export function invitacionPendiente(
  datos: Partial<InvitacionPendiente> & { venceEnDias?: number } = {},
): InvitacionPendiente {
  const { venceEnDias = 6, ...resto } = datos;
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'marta.nunez@ferreteria.mx',
    roles: ['contador', 'revisor'],
    creadaEn: '2026-10-14T15:00:00.000Z',
    venceEn: new Date(Date.now() + venceEnDias * DIA_MS).toISOString(),
    vencida: venceEnDias <= 0,
    invitadaPor: 'Ana Mendoza',
    ...resto,
  };
}

/** Las cuatro filas del mockup `Usuarios.dc.html`, la más reciente primero. */
export function pendientesDelMockup(): InvitacionPendiente[] {
  return [
    invitacionPendiente(),
    invitacionPendiente({
      id: '22222222-2222-4222-8222-222222222222',
      email: 'camila.ortega@ferreteria.mx',
      roles: ['admin'],
      creadaEn: '2026-10-12T15:00:00.000Z',
      venceEnDias: 4,
      invitadaPor: null,
    }),
    invitacionPendiente({
      id: '33333333-3333-4333-8333-333333333333',
      email: 'luis.paredes@ferreteria.mx',
      roles: ['auditor'],
      creadaEn: '2026-10-10T15:00:00.000Z',
      venceEnDias: 2,
    }),
    invitacionPendiente({
      id: '44444444-4444-4444-8444-444444444444',
      email: 'rodrigo.salas@ferreteria.mx',
      roles: ['contador'],
      creadaEn: '2026-10-02T15:00:00.000Z',
      venceEnDias: -1,
    }),
  ];
}

/** Acción de fila recibida: `reenviar` o `cancelar` sobre este id. */
export interface AccionPendiente {
  accion: 'reenviar' | 'cancelar';
  id: string;
}

/** Acciones de fila recibidas desde el último `usarHandlersUsuarios`. */
export const accionesPendientesRecibidas: AccionPendiente[] = [];
/** Cuántas veces se pidió `GET /usuarios/invitaciones`. */
export const listadosPendientesPedidos = { cuenta: 0 };

let pendientesServidor: InvitacionPendiente[] = [];

/** Cuerpo de `POST /usuarios/invitaciones` tal como llegó al servidor simulado. */
export interface CuerpoInvitarUsuario {
  email?: unknown;
  roles?: unknown;
}

/** Peticiones de invitar recibidas desde el último `usarHandlersUsuarios`. */
export const invitacionesUsuarioRecibidas: CuerpoInvitarUsuario[] = [];

const RUTA = '/api/usuarios/invitaciones';
const RUTA_REENVIAR = `${RUTA}/:id/reenviar`;
const RUTA_CANCELAR = `${RUTA}/:id/cancelar`;

function cuerpoDeError(status: number) {
  return HttpResponse.json(
    { statusCode: status, error: 'Error', message: 'texto del servidor' },
    { status },
  );
}

/**
 * Instala los manejadores felices y limpia lo recibido. El servidor simulado
 * se comporta como el backend: invitar y reenviar dejan UNA pendiente viva por
 * correo (la fila nueva, con id nuevo y 7 días); cancelar la quita.
 */
export function usarHandlersUsuarios(
  pendientes: InvitacionPendiente[] = [],
): void {
  invitacionesUsuarioRecibidas.length = 0;
  accionesPendientesRecibidas.length = 0;
  listadosPendientesPedidos.cuenta = 0;
  pendientesServidor = [...pendientes];
  servidor.use(
    http.get(RUTA, () => {
      listadosPendientesPedidos.cuenta += 1;
      return HttpResponse.json(pendientesServidor);
    }),
    http.post(RUTA_REENVIAR, ({ params }) => {
      const id = String(params['id']);
      accionesPendientesRecibidas.push({ accion: 'reenviar', id });
      const actual = pendientesServidor.find((p) => p.id === id);
      if (!actual) return cuerpoDeError(404);
      const nueva: InvitacionPendiente = {
        ...actual,
        id: `${id.slice(0, 24)}${String(Date.now()).slice(-12).padStart(12, '0')}`,
        creadaEn: new Date().toISOString(),
        venceEn: new Date(Date.now() + 7 * DIA_MS).toISOString(),
        vencida: false,
      };
      pendientesServidor = [
        nueva,
        ...pendientesServidor.filter((p) => p.id !== id),
      ];
      return HttpResponse.json(
        { email: actual.email, roles: actual.roles },
        { status: 201 },
      );
    }),
    http.post(RUTA_CANCELAR, ({ params }) => {
      const id = String(params['id']);
      accionesPendientesRecibidas.push({ accion: 'cancelar', id });
      const actual = pendientesServidor.find((p) => p.id === id);
      if (!actual) return cuerpoDeError(404);
      pendientesServidor = pendientesServidor.filter((p) => p.id !== id);
      return HttpResponse.json({ email: actual.email }, { status: 200 });
    }),
    http.post(RUTA, async ({ request }) => {
      const cuerpo = (await request.json()) as CuerpoInvitarUsuario;
      invitacionesUsuarioRecibidas.push(cuerpo);
      const email = String(cuerpo.email);
      pendientesServidor = [
        invitacionPendiente({
          id: `99999999-9999-4999-8999-${String(Date.now()).slice(-12).padStart(12, '0')}`,
          email,
          roles: cuerpo.roles as InvitacionPendiente['roles'],
          creadaEn: new Date().toISOString(),
          venceEnDias: 7,
        }),
        ...pendientesServidor.filter((p) => p.email !== email),
      ];
      return HttpResponse.json(
        { email: cuerpo.email, roles: cuerpo.roles },
        { status: 201 },
      );
    }),
  );
}

/** `GET /usuarios/invitaciones` responde `status`. */
export function listarPendientesFalla(status: number): void {
  servidor.use(http.get(RUTA, () => cuerpoDeError(status)));
}

/** `GET /usuarios/invitaciones` falla en la red. */
export function listarPendientesRedDeFallo(): void {
  servidor.use(http.get(RUTA, () => HttpResponse.error()));
}

/** Reenviar o cancelar responde `status` con este `mensaje` de Nest. */
export function accionPendienteFalla(
  accion: 'reenviar' | 'cancelar',
  status: number,
  mensaje = 'texto del servidor',
): void {
  servidor.use(
    http.post(
      accion === 'reenviar' ? RUTA_REENVIAR : RUTA_CANCELAR,
      ({ params }) => {
        accionesPendientesRecibidas.push({ accion, id: String(params['id']) });
        return HttpResponse.json(
          { statusCode: status, error: 'Error', message: mensaje },
          { status },
        );
      },
    ),
  );
}

/** Reenviar o cancelar falla en la red. */
export function accionPendienteRedDeFallo(
  accion: 'reenviar' | 'cancelar',
): void {
  servidor.use(
    http.post(accion === 'reenviar' ? RUTA_REENVIAR : RUTA_CANCELAR, () =>
      HttpResponse.error(),
    ),
  );
}

/** `POST /usuarios/invitaciones` responde `status`. */
export function invitarUsuarioFalla(status: number): void {
  servidor.use(
    http.post(RUTA, async ({ request }) => {
      invitacionesUsuarioRecibidas.push(
        (await request.json()) as CuerpoInvitarUsuario,
      );
      return cuerpoDeError(status);
    }),
  );
}

/** `POST /usuarios/invitaciones` falla en la red. */
export function invitarUsuarioRedDeFallo(): void {
  servidor.use(http.post(RUTA, () => HttpResponse.error()));
}

/** `POST /usuarios/invitaciones` espera a la compuerta y luego responde 201. */
export function invitarUsuarioConCompuerta(espera: Promise<void>): void {
  servidor.use(
    http.post(RUTA, async ({ request }) => {
      const cuerpo = (await request.json()) as CuerpoInvitarUsuario;
      invitacionesUsuarioRecibidas.push(cuerpo);
      await espera;
      return HttpResponse.json(
        { email: cuerpo.email, roles: cuerpo.roles },
        { status: 201 },
      );
    }),
  );
}

/** `POST /usuarios/invitaciones` devuelve este cuerpo con 201. */
export function invitarUsuarioResponde(cuerpo: object): void {
  servidor.use(
    http.post(RUTA, () => HttpResponse.json(cuerpo, { status: 201 })),
  );
}
