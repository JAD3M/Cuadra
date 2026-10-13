import { randomBytes } from 'crypto';
import type { DataSource } from 'typeorm';
import { COOKIE_SESION, huellaDeToken } from '../auth/sesiones.service';

/**
 * Ayudas de los specs de integración para la sesión con cookie (AD-6).
 * Un "token" de prueba es el valor del encabezado `Cookie`
 * (`cuadra_sesion=<token>`), listo para `.set('Cookie', token)`.
 */

/** El encabezado `Cookie` que manda el navegador con un token de sesión. */
export function encabezadoCookie(token: string): string {
  return `${COOKIE_SESION}=${token}`;
}

/**
 * Abre una sesión directo en `sesiones` con la conexión del dueño, sin pasar
 * por el login (eso lo prueban los specs de auth). `companyId` nulo = sesión
 * sin empresa elegida. Devuelve el encabezado `Cookie`.
 */
export async function abrirSesion(
  ds: DataSource,
  userId: string,
  companyId: string | null,
): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await ds.query(
    `INSERT INTO sesiones
       (user_id, token_hash, tipo, company_id, ultima_actividad, expira_en)
     VALUES ($1, $2, 'empresa', $3, now(), now() + interval '8 hours')`,
    [userId, huellaDeToken(token), companyId],
  );
  return encabezadoCookie(token);
}

/** El `Set-Cookie` de la cookie de sesión de una respuesta, tal cual. */
export function setCookieDe(res: {
  headers: Record<string, unknown>;
}): string | undefined {
  const crudo = res.headers['set-cookie'];
  const lista = Array.isArray(crudo) ? (crudo as string[]) : [];
  return lista.find((c) => c.startsWith(`${COOKIE_SESION}=`));
}

/** El encabezado `Cookie` que corresponde al `Set-Cookie` de la respuesta. */
export function cookieDe(res: { headers: Record<string, unknown> }): string {
  const fija = setCookieDe(res);
  if (!fija) throw new Error('La respuesta no fijó la cookie de sesión');
  return fija.split(';')[0];
}
