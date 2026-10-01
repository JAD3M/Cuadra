import { z } from 'zod';
import { ROLES } from '@/shared/dominio/tipos';

// Contratos de la API de autenticación (CU-19). Se derivan de
// src/auth/dto/respuestas.dto.ts y src/auth/dto/LoginDto.ts. Los objetos
// ignoran claves desconocidas (el backend puede agregar campos sin romper la
// interfaz); lo que falta o tiene otra forma falla en voz alta. Aquí no hay
// montos; los que lleguen en otros contratos usan `montoDecimal`.

/** Rol validado contra el espejo: uno desconocido falla en la frontera. */
export const rol = z.enum(ROLES);

const id = z.guid();
const texto = z.string().min(1);

export const usuarioPublico = z.object({
  id,
  nombre: texto,
  email: z.email(),
});

export const empresaContexto = z.object({
  id,
  razonSocial: texto,
  rfc: texto,
});

/** Empresa elegible tras el login: incluye los roles del usuario en ella. */
export const empresaDisponible = empresaContexto.extend({
  roles: z.array(rol),
});

/** `GET /auth/empresas`: la misma lista que trae el login, sin envoltorio. */
export const listaEmpresasDisponibles = z.array(empresaDisponible);

/** `GET /auth/contexto`. */
export const contextoSesion = z.object({
  usuario: usuarioPublico,
  empresa: empresaContexto,
  roles: z.array(rol),
});

/** `POST /auth/login`: `token` es el de selección (5 min). */
export const respuestaLogin = z.object({
  token: texto,
  usuario: usuarioPublico,
  empresas: listaEmpresasDisponibles,
});

/** `POST /auth/empresa/:id`: `token` es el de sesión (15 min). */
export const respuestaToken = z.object({ token: texto });

/** Cuerpo de `POST /auth/login`. La contraseña viaja tal cual, sin recortar. */
export const solicitudLogin = z.object({
  email: z.email(),
  password: texto,
});

/** Errores de Nest: `message` es texto o, con ValidationPipe, una lista. */
export const cuerpoError = z.object({
  statusCode: z.int(),
  error: z.string(),
  message: z.union([z.string(), z.array(z.string())]),
});

export type Usuario = z.infer<typeof usuarioPublico>;
export type EmpresaContexto = z.infer<typeof empresaContexto>;
export type EmpresaDisponible = z.infer<typeof empresaDisponible>;
export type ContextoSesion = z.infer<typeof contextoSesion>;
export type RespuestaLogin = z.infer<typeof respuestaLogin>;
export type RespuestaToken = z.infer<typeof respuestaToken>;
export type SolicitudLogin = z.infer<typeof solicitudLogin>;
export type CuerpoError = z.infer<typeof cuerpoError>;
