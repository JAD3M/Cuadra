import { http, HttpResponse } from 'msw';
import { servidor } from './servidor';

/** Cuerpo de `POST /usuarios/invitaciones` tal como llegó al servidor simulado. */
export interface CuerpoInvitarUsuario {
  email?: unknown;
  roles?: unknown;
}

/** Peticiones de invitar recibidas desde el último `usarHandlersUsuarios`. */
export const invitacionesUsuarioRecibidas: CuerpoInvitarUsuario[] = [];

const RUTA = '/api/usuarios/invitaciones';

function cuerpoDeError(status: number) {
  return HttpResponse.json(
    { statusCode: status, error: 'Error', message: 'texto del servidor' },
    { status },
  );
}

/** Instala el manejador feliz (201 con el mismo cuerpo) y limpia lo recibido. */
export function usarHandlersUsuarios(): void {
  invitacionesUsuarioRecibidas.length = 0;
  servidor.use(
    http.post(RUTA, async ({ request }) => {
      const cuerpo = (await request.json()) as CuerpoInvitarUsuario;
      invitacionesUsuarioRecibidas.push(cuerpo);
      return HttpResponse.json(
        { email: cuerpo.email, roles: cuerpo.roles },
        { status: 201 },
      );
    }),
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
