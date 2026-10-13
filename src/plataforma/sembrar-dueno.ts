// src/plataforma/sembrar-dueno.ts
import type { DataSource } from 'typeorm';
import { PasswordHasher } from '../auth/password';
import { normalizarEmail } from '../users/email';

/**
 * Historia 1.3. Largo mínimo de la contraseña del dueño. Regla explícita y
 * propia de esta siembra: el login y las demás cuentas no la aplican.
 */
export const PASSWORD_MINIMO_DUENO = 12;

/** Los mensajes nunca incluyen la contraseña ni su hash. */
export class ErrorSiembraDueno extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorSiembraDueno';
  }
}

export interface EntradaSiembraDueno {
  correo?: string;
  password?: string;
}

const FORMA_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Crea la única cuenta del dueño. Se niega, sin escribir nada, si faltan los
 * datos, si la contraseña es corta o si la tabla ya tiene alguna fila. No hay
 * otro camino para crear dueños: ni endpoint ni invitación.
 */
export async function sembrarDueno(
  ds: DataSource,
  entrada: EntradaSiembraDueno,
  hasher: PasswordHasher = new PasswordHasher(),
): Promise<void> {
  const correo = normalizarEmail(entrada.correo ?? '');
  const password = entrada.password ?? '';

  if (correo === '') throw new ErrorSiembraDueno('Falta el correo del dueño.');
  if (!FORMA_CORREO.test(correo)) {
    throw new ErrorSiembraDueno('El correo del dueño no es válido.');
  }
  if (password.trim() === '') {
    throw new ErrorSiembraDueno('Falta la contraseña del dueño.');
  }
  if (password.length < PASSWORD_MINIMO_DUENO) {
    throw new ErrorSiembraDueno(
      `La contraseña del dueño debe tener al menos ${PASSWORD_MINIMO_DUENO} caracteres.`,
    );
  }

  const passwordHash = await hasher.hashear(password);

  await ds.transaction(async (manager) => {
    // Cierra la carrera entre dos siembras simultáneas.
    await manager.query(
      'LOCK TABLE plataforma_usuarios IN SHARE ROW EXCLUSIVE MODE',
    );
    const [{ n }] = await manager.query<Array<{ n: string }>>(
      'SELECT count(*) AS n FROM plataforma_usuarios',
    );
    if (Number(n) > 0) {
      throw new ErrorSiembraDueno(
        'plataforma_usuarios ya tiene filas; la siembra no crea otro dueño.',
      );
    }
    await manager.query(
      'INSERT INTO plataforma_usuarios (correo, password_hash) VALUES ($1, $2)',
      [correo, passwordHash],
    );
  });
}
