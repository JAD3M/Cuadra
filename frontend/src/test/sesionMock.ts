import { CONTEXTO_SESION, CONTEXTO_SESION_B } from '@/test/fixtures';

// Sesión del servidor simulado. La real vive en la cookie `httpOnly`
// `cuadra_sesion`, que el navegador manda solo y JavaScript no ve; aquí el
// "servidor" recuerda qué sesión hay para que los manejadores respondan como
// el backend: sin sesión, 401; con sesión sin empresa, solo la lista de
// empresas; con empresa, el contexto. Sin imports del servidor MSW para que
// `handlers.ts` y `handlersAuth.ts` lo compartan sin ciclos.

export const ID_EMPRESA_A = CONTEXTO_SESION.empresa.id;
export const ID_EMPRESA_B = CONTEXTO_SESION_B.empresa.id;

interface SesionServidor {
  /** ¿Hay una fila de sesión viva? */
  viva: boolean;
  /** Empresa elegida; `null` mientras la sesión no tiene una. */
  empresaId: string | null;
}

let sesion: SesionServidor = { viva: false, empresaId: null };

/** Sin sesión: como un navegador sin cookie (estado de arranque). */
export function reiniciarSesionMock(): void {
  sesion = { viva: false, empresaId: null };
}

/** Hay una sesión con esta empresa elegida, como tras iniciar sesión antes. */
export function sesionConEmpresa(empresaId: string = ID_EMPRESA_A): void {
  sesion = { viva: true, empresaId };
}

/** Hay una sesión sin empresa elegida (pasó el login, falta el paso 2). */
export function sesionSinEmpresa(): void {
  sesion = { viva: true, empresaId: null };
}

/** Empresa de la sesión simulada al momento de llamar; `null` si no hay. */
export function empresaDeLaSesion(): string | null {
  return sesion.viva ? sesion.empresaId : null;
}

export function hayEmpresaElegida(): boolean {
  return sesion.viva && sesion.empresaId !== null;
}

export function haySesion(): boolean {
  return sesion.viva;
}

export function abrirSesion(): void {
  sesion = { viva: true, empresaId: null };
}

export function elegirEmpresaMock(empresaId: string): void {
  sesion = { viva: true, empresaId };
}

export function cerrarSesionMock(): void {
  sesion = { viva: false, empresaId: null };
}
