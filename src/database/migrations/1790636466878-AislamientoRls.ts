import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CU-04b. Segunda capa de aislamiento: aunque un handler olvide el
 * `WHERE company_id`, Postgres no devuelve ni acepta filas de otra empresa.
 *
 * - La política compara contra `app.company_id`, que la app fija por
 *   transacción con `set_config(..., true)`. Sin empresa fijada el valor es
 *   NULL (o '' tras una transacción previa en la misma conexión: de ahí el
 *   `nullif`), la comparación nunca es verdadera y se ven cero filas.
 * - FORCE para que tampoco el dueño de las tablas se la salte. Un
 *   superusuario la ignora de todos modos, por eso la app corre como
 *   `cuadra_app` y no como `cuadra`.
 * - Fuera: `companies`, `users` y `user_company_roles`. Se leen antes de
 *   elegir empresa (login, selección, RolesGuard).
 *
 * Los roles son del clúster, no de la base: `cuadra` y `cuadra_test` comparten
 * `cuadra_app`. Por eso se crea solo si no existe, y el `down` revoca los
 * GRANT de esta base y quita las políticas, pero nunca hace DROP ROLE.
 */

const TABLAS_CON_RLS = [
  'cargas',
  'cfdi',
  'movimientos',
  'conciliaciones',
  'bitacora',
] as const;

const ROL_APP = 'cuadra_app';

/** La contraseña no va en el repo: sale de la misma URL con la que se conecta la app. */
function passwordDelRolApp(): string {
  const url = process.env.DATABASE_APP_URL;
  if (!url) {
    throw new Error(
      'Falta DATABASE_APP_URL: la migración AislamientoRls toma de ahí la contraseña de cuadra_app.',
    );
  }
  const { username, password } = new URL(url);
  if (username !== ROL_APP || !password) {
    throw new Error(
      `DATABASE_APP_URL debe conectar como ${ROL_APP} y traer contraseña.`,
    );
  }
  return decodeURIComponent(password);
}

export class AislamientoRls1790636466878 implements MigrationInterface {
  name = 'AislamientoRls1790636466878';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const password = passwordDelRolApp();

    // NOBYPASSRLS es lo que importa; lo demás cierra que el rol pueda
    // escalar por su cuenta.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROL_APP}') THEN
          CREATE ROLE ${ROL_APP} LOGIN NOSUPERUSER NOBYPASSRLS
            NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
        END IF;
      END
      $$`);
    // Se reafirman los atributos aunque el rol ya existiera: si alguien le
    // dio BYPASSRLS a mano, RLS dejaría de servir sin que nada falle.
    await queryRunner.query(
      `ALTER ROLE ${ROL_APP} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION`,
    );
    // ALTER ROLE no admite parámetros: format(%L) cita el literal en el
    // servidor, sin interpolar en JS.
    const [{ sql }] = (await queryRunner.query(
      `SELECT format('ALTER ROLE ${ROL_APP} PASSWORD %L', $1::text) AS sql`,
      [password],
    )) as Array<{ sql: string }>;
    await queryRunner.query(sql);

    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO ${ROL_APP}`);
    // Lectura para login, selección de empresa y RolesGuard. Las altas de
    // usuarios y empresas no son de la app todavía.
    await queryRunner.query(
      `GRANT SELECT ON companies, users, user_company_roles TO ${ROL_APP}`,
    );
    // Sin DELETE: ninguna historia borra filas de dominio. Una carga fallida
    // cambia de estado, no desaparece.
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE ON cargas, cfdi, movimientos, conciliaciones TO ${ROL_APP}`,
    );
    // La bitácora es de solo agregar (CU-16).
    await queryRunner.query(`GRANT SELECT, INSERT ON bitacora TO ${ROL_APP}`);

    for (const tabla of TABLAS_CON_RLS) {
      await queryRunner.query(
        `ALTER TABLE "${tabla}" ENABLE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${tabla}" FORCE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `CREATE POLICY "rls_${tabla}_company" ON "${tabla}"
           USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
           WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabla of [...TABLAS_CON_RLS].reverse()) {
      await queryRunner.query(
        `DROP POLICY "rls_${tabla}_company" ON "${tabla}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "${tabla}" NO FORCE ROW LEVEL SECURITY`,
      );
      await queryRunner.query(
        `ALTER TABLE "${tabla}" DISABLE ROW LEVEL SECURITY`,
      );
    }
    // Solo lo de esta base. El rol no se borra: es del clúster y la otra
    // base (cuadra o cuadra_test) lo sigue usando.
    await queryRunner.query(
      `REVOKE ALL ON companies, users, user_company_roles, cargas, cfdi, movimientos, conciliaciones, bitacora FROM ${ROL_APP}`,
    );
    await queryRunner.query(`REVOKE USAGE ON SCHEMA public FROM ${ROL_APP}`);
  }
}
