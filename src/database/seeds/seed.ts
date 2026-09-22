// src/database/seeds/seed.ts
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { DataSource } from 'typeorm';
import dataSource from '../data-source';
import type { Rol } from '../entities';

/**
 * Hash de contraseña con scrypt de la stdlib. Es un placeholder deliberado:
 * la historia de autenticación decidirá el algoritmo definitivo y sus
 * parámetros. Basta con que la semilla nunca guarde texto plano.
 */
function hashear(password: string): string {
  const sal = randomBytes(16);
  const derivada = scryptSync(password, sal, 64);
  return `scrypt$${sal.toString('base64')}$${derivada.toString('base64')}`;
}

/** Contraparte de `hashear`, para que la semilla pueda verificarse a sí misma. */
export function verificar(password: string, guardado: string): boolean {
  const [algoritmo, salB64, hashB64] = guardado.split('$');
  if (algoritmo !== 'scrypt' || !salB64 || !hashB64) return false;
  const esperado = Buffer.from(hashB64, 'base64');
  const derivada = scryptSync(
    password,
    Buffer.from(salB64, 'base64'),
    esperado.length,
  );
  return timingSafeEqual(esperado, derivada);
}

/** Contraseña única para todas las cuentas de ejemplo. Solo desarrollo. */
export const PASSWORD_SEMILLA = 'cuadra-dev-2026';

const EMPRESAS = [
  {
    rfc: 'FDB190215QK4',
    razonSocial: 'Ferreteria del Bajio SA de CV',
    regimenFiscal: '601',
  },
  {
    rfc: 'TCU170830R52',
    razonSocial: 'Transportes Cuautla SA de CV',
    regimenFiscal: '601',
  },
] as const;

const USUARIOS = [
  { email: 'ana.reyes@fdb.mx', nombre: 'Ana Reyes' },
  { email: 'luis.mendoza@fdb.mx', nombre: 'Luis Mendoza' },
  { email: 'carmen.olvera@cuautla.mx', nombre: 'Carmen Olvera' },
  { email: 'jorge.tapia@despacho.mx', nombre: 'Jorge Tapia' },
] as const;

/**
 * Jorge aparece en las dos empresas y con dos roles distintos: es el caso que
 * justifica que el rol viva en `user_company_roles` y no en `users`.
 */
const ROLES: ReadonlyArray<{ email: string; rfc: string; rol: Rol }> = [
  { email: 'ana.reyes@fdb.mx', rfc: 'FDB190215QK4', rol: 'admin' },
  { email: 'luis.mendoza@fdb.mx', rfc: 'FDB190215QK4', rol: 'contador' },
  { email: 'carmen.olvera@cuautla.mx', rfc: 'TCU170830R52', rol: 'admin' },
  { email: 'jorge.tapia@despacho.mx', rfc: 'FDB190215QK4', rol: 'contador' },
  { email: 'jorge.tapia@despacho.mx', rfc: 'TCU170830R52', rol: 'auditor' },
];

/**
 * Idempotente: se apoya en las claves naturales (rfc, email y la terna de
 * roles), así que correrla dos veces deja la base igual que correrla una.
 * No toca las contraseñas ya existentes para no invalidar sesiones locales.
 */
export async function sembrar(ds: DataSource): Promise<void> {
  await ds.transaction(async (manager) => {
    const idsEmpresa = new Map<string, string>();
    for (const empresa of EMPRESAS) {
      const [fila] = await manager.query<Array<{ id: string }>>(
        `INSERT INTO companies (rfc, razon_social, regimen_fiscal)
         VALUES ($1, $2, $3)
         ON CONFLICT (rfc) DO UPDATE
           SET razon_social = EXCLUDED.razon_social,
               regimen_fiscal = EXCLUDED.regimen_fiscal,
               updated_at = now()
         RETURNING id`,
        [empresa.rfc, empresa.razonSocial, empresa.regimenFiscal],
      );
      idsEmpresa.set(empresa.rfc, fila.id);
    }

    const idsUsuario = new Map<string, string>();
    for (const usuario of USUARIOS) {
      const [fila] = await manager.query<Array<{ id: string }>>(
        `INSERT INTO users (email, nombre, password_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE
           SET nombre = EXCLUDED.nombre,
               updated_at = now()
         RETURNING id`,
        [usuario.email, usuario.nombre, hashear(PASSWORD_SEMILLA)],
      );
      idsUsuario.set(usuario.email, fila.id);
    }

    for (const asignacion of ROLES) {
      await manager.query(
        `INSERT INTO user_company_roles (user_id, company_id, rol)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, company_id, rol) DO NOTHING`,
        [
          idsUsuario.get(asignacion.email),
          idsEmpresa.get(asignacion.rfc),
          asignacion.rol,
        ],
      );
    }
  });
}

async function main(): Promise<void> {
  const ds = await dataSource.initialize();
  try {
    await sembrar(ds);
    const [{ empresas, usuarios, roles }] = await ds.query<
      Array<{ empresas: string; usuarios: string; roles: string }>
    >(`SELECT (SELECT count(*) FROM companies)           AS empresas,
              (SELECT count(*) FROM users)               AS usuarios,
              (SELECT count(*) FROM user_company_roles)  AS roles`);
    console.log(
      `Semilla aplicada: ${empresas} empresas, ${usuarios} usuarios, ${roles} roles.`,
    );
  } finally {
    await ds.destroy();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('La semilla falló:', error);
    process.exit(1);
  });
}
