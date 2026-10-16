import { http, HttpResponse } from 'msw';
import type { UsuarioListado } from '@/shared/api/contratos/usuarios';
import { servidor } from './servidor';

const DIA_MS = 86_400_000;

/** Persona activa simulada: sin invitación ni fechas, como el servidor. */
export function personaActiva(
  datos: Partial<UsuarioListado> = {},
): UsuarioListado {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    email: 'ana.mendoza@ferreteria.mx',
    nombre: 'Ana Mendoza',
    roles: ['admin'],
    estado: 'activo',
    invitacionId: null,
    vencida: false,
    venceEn: null,
    creadaEn: null,
    invitadaPor: null,
    ...datos,
  };
}

/**
 * Persona con invitación pendiente simulada. `venceEnDias` positivo: vigente
 * con esos días por delante; no positivo: ya venció (`vencida: true`). `id` e
 * `invitacionId` coinciden, como en el servidor.
 */
export function personaPendiente(
  datos: Partial<UsuarioListado> & { venceEnDias?: number } = {},
): UsuarioListado {
  const { venceEnDias = 6, ...resto } = datos;
  const id =
    resto.invitacionId ?? resto.id ?? '11111111-1111-4111-8111-111111111111';
  return {
    id,
    email: 'marta.nunez@ferreteria.mx',
    nombre: null,
    roles: ['contador', 'revisor'],
    estado: 'pendiente',
    invitacionId: id,
    vencida: venceEnDias <= 0,
    venceEn: new Date(Date.now() + venceEnDias * DIA_MS).toISOString(),
    creadaEn: '2026-10-14T15:00:00.000Z',
    invitadaPor: 'Ana Mendoza',
    ...resto,
  };
}

/** Las ocho filas del mockup `Usuarios.dc.html`, ordenadas por correo. */
export function personasDelMockup(): UsuarioListado[] {
  return [
    personaPendiente(),
    personaPendiente({
      id: '22222222-2222-4222-8222-222222222222',
      email: 'camila.ortega@ferreteria.mx',
      roles: ['admin'],
      creadaEn: '2026-10-12T15:00:00.000Z',
      venceEnDias: 4,
      invitadaPor: null,
    }),
    personaPendiente({
      id: '33333333-3333-4333-8333-333333333333',
      email: 'luis.paredes@ferreteria.mx',
      roles: ['auditor'],
      creadaEn: '2026-10-10T15:00:00.000Z',
      venceEnDias: 2,
    }),
    personaPendiente({
      id: '44444444-4444-4444-8444-444444444444',
      email: 'rodrigo.salas@ferreteria.mx',
      roles: ['contador'],
      creadaEn: '2026-10-02T15:00:00.000Z',
      venceEnDias: -1,
    }),
    personaActiva(),
    personaActiva({
      id: '55555555-5555-4555-8555-555555555551',
      email: 'luis.reyes@ferreteria.mx',
      nombre: 'Luis Reyes',
      roles: ['contador'],
    }),
    personaActiva({
      id: '55555555-5555-4555-8555-555555555552',
      email: 'jorge.tapia@ferreteria.mx',
      nombre: 'Jorge Tapia',
      roles: ['revisor'],
    }),
    personaActiva({
      id: '55555555-5555-4555-8555-555555555553',
      email: 'sofia.cardenas@ferreteria.mx',
      nombre: 'Sofía Cárdenas',
      roles: ['auditor'],
    }),
  ].sort((a, b) => a.email.localeCompare(b.email));
}

/** Acción de fila recibida: `reenviar` o `cancelar` sobre este id. */
export interface AccionPendiente {
  accion: 'reenviar' | 'cancelar';
  id: string;
}

/** Acciones de fila recibidas desde el último `usarHandlersUsuarios`. */
export const accionesPendientesRecibidas: AccionPendiente[] = [];
/** Cuántas veces se pidió `GET /usuarios`. */
export const listadosUsuariosPedidos = { cuenta: 0 };

let personasServidor: UsuarioListado[] = [];

/** Cuerpo de `POST /usuarios/invitaciones` tal como llegó al servidor simulado. */
export interface CuerpoInvitarUsuario {
  email?: unknown;
  roles?: unknown;
}

/** Peticiones de invitar recibidas desde el último `usarHandlersUsuarios`. */
export const invitacionesUsuarioRecibidas: CuerpoInvitarUsuario[] = [];

const RUTA_LISTA = '/api/usuarios';
const RUTA = '/api/usuarios/invitaciones';
const RUTA_REENVIAR = `${RUTA}/:id/reenviar`;
const RUTA_CANCELAR = `${RUTA}/:id/cancelar`;

function cuerpoDeError(status: number) {
  return HttpResponse.json(
    { statusCode: status, error: 'Error', message: 'texto del servidor' },
    { status },
  );
}

function porCorreo(personas: UsuarioListado[]): UsuarioListado[] {
  return [...personas].sort((x, y) => x.email.localeCompare(y.email));
}

/**
 * Instala los manejadores felices y limpia lo recibido. El servidor simulado
 * se comporta como el backend: `GET /usuarios` entrega una fila por persona
 * ordenada por correo; invitar y reenviar dejan UNA pendiente viva por correo
 * (la fila nueva, con id nuevo y 7 días); cancelar la quita. Una persona
 * activa gana: invitar a su correo no agrega fila.
 */
export function usarHandlersUsuarios(personas: UsuarioListado[] = []): void {
  invitacionesUsuarioRecibidas.length = 0;
  accionesPendientesRecibidas.length = 0;
  listadosUsuariosPedidos.cuenta = 0;
  personasServidor = [...personas];
  servidor.use(
    http.get(RUTA_LISTA, () => {
      listadosUsuariosPedidos.cuenta += 1;
      return HttpResponse.json(porCorreo(personasServidor));
    }),
    http.post(RUTA_REENVIAR, ({ params }) => {
      const id = String(params['id']);
      accionesPendientesRecibidas.push({ accion: 'reenviar', id });
      const actual = personasServidor.find((p) => p.invitacionId === id);
      if (!actual) return cuerpoDeError(404);
      const nuevoId = `${id.slice(0, 24)}${String(Date.now()).slice(-12).padStart(12, '0')}`;
      const nueva: UsuarioListado = {
        ...actual,
        id: nuevoId,
        invitacionId: nuevoId,
        creadaEn: new Date().toISOString(),
        venceEn: new Date(Date.now() + 7 * DIA_MS).toISOString(),
        vencida: false,
      };
      personasServidor = [
        nueva,
        ...personasServidor.filter((p) => p.invitacionId !== id),
      ];
      return HttpResponse.json(
        { email: actual.email, roles: actual.roles },
        { status: 201 },
      );
    }),
    http.post(RUTA_CANCELAR, ({ params }) => {
      const id = String(params['id']);
      accionesPendientesRecibidas.push({ accion: 'cancelar', id });
      const actual = personasServidor.find((p) => p.invitacionId === id);
      if (!actual) return cuerpoDeError(404);
      personasServidor = personasServidor.filter((p) => p.invitacionId !== id);
      return HttpResponse.json({ email: actual.email }, { status: 200 });
    }),
    http.post(RUTA, async ({ request }) => {
      const cuerpo = (await request.json()) as CuerpoInvitarUsuario;
      invitacionesUsuarioRecibidas.push(cuerpo);
      const email = String(cuerpo.email);
      const hayActiva = personasServidor.some(
        (p) => p.email === email && p.estado === 'activo',
      );
      if (!hayActiva) {
        personasServidor = [
          personaPendiente({
            id: `99999999-9999-4999-8999-${String(Date.now()).slice(-12).padStart(12, '0')}`,
            email,
            roles: cuerpo.roles as UsuarioListado['roles'],
            creadaEn: new Date().toISOString(),
            venceEnDias: 7,
          }),
          ...personasServidor.filter((p) => p.email !== email),
        ];
      }
      return HttpResponse.json(
        { email: cuerpo.email, roles: cuerpo.roles },
        { status: 201 },
      );
    }),
  );
}

/** `GET /usuarios` responde `status`. */
export function listarUsuariosFalla(status: number): void {
  servidor.use(http.get(RUTA_LISTA, () => cuerpoDeError(status)));
}

/** `GET /usuarios` falla en la red. */
export function listarUsuariosRedDeFallo(): void {
  servidor.use(http.get(RUTA_LISTA, () => HttpResponse.error()));
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
