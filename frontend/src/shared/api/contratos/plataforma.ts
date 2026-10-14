import { z } from 'zod';

// Contratos de la API de plataforma (historia 1.3). Se derivan de
// src/plataforma/plataforma-auth.controller.ts y plataforma.controller.ts.
// Ojo con los nombres: el cuerpo del login usa `email` y las respuestas usan
// `correo`. Los objetos ignoran claves desconocidas; lo que falta falla en voz
// alta. Aquí no hay montos.

const id = z.guid();
const texto = z.string().min(1);

/** Cuenta del dueño de Cuadra tal como la devuelve el servidor. */
export const usuarioPlataforma = z.object({
  id,
  correo: z.email(),
});

/**
 * `POST /plataforma/auth/login` y `GET /plataforma/auth/me`. Sin token: la
 * sesión viaja en la cookie `httpOnly` y JavaScript no la lee.
 */
export const respuestaSesionPlataforma = z.object({
  usuario: usuarioPlataforma,
});

/** Cuerpo de `POST /plataforma/auth/login`. La contraseña viaja tal cual. */
export const solicitudLoginPlataforma = z.object({
  email: z.email(),
  password: texto,
});

/** Empresa de la lista de `GET /plataforma/empresas` (vacía hasta la 1.4). */
export const empresaPlataforma = z.object({
  id,
  razonSocial: texto,
  rfc: texto,
});

export const listaEmpresasPlataforma = z.array(empresaPlataforma);

export type UsuarioPlataforma = z.infer<typeof usuarioPlataforma>;
export type RespuestaSesionPlataforma = z.infer<
  typeof respuestaSesionPlataforma
>;
export type SolicitudLoginPlataforma = z.infer<typeof solicitudLoginPlataforma>;
export type EmpresaPlataforma = z.infer<typeof empresaPlataforma>;
