import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El email se compara sin distinguir mayúsculas. Orden obligado: primero se
 * normalizan los datos, luego el índice sobre lower(email) impide que vuelvan
 * a convivir 'ana@x.mx' y 'Ana@x.mx', y al final se quita el UNIQUE plano,
 * que ya no aporta nada.
 */
export class EmailSinMayusculas1790205607191 implements MigrationInterface {
  name = 'EmailSinMayusculas1790205607191';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Si dos cuentas colapsan al mismo email, decidir cuál sobrevive es
    // trabajo de una persona, no de una migración. No se listan los emails:
    // son datos personales y esto termina en logs.
    const [{ choques }] = (await queryRunner.query(
      `SELECT count(*)::int AS choques FROM (
         SELECT 1 FROM users GROUP BY lower(btrim(email)) HAVING count(*) > 1
       ) AS duplicados`,
    )) as Array<{ choques: number }>;
    if (choques > 0) {
      throw new Error(
        `${choques} email(s) chocan al normalizarlos a minúsculas; resuélvelos a mano antes de migrar.`,
      );
    }

    await queryRunner.query(
      `UPDATE "users" SET "email" = lower(btrim("email")), "updated_at" = now()
        WHERE "email" <> lower(btrim("email"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_users_email_lower" ON "users" (lower("email"))`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."ux_users_email"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Los emails se quedan en minúsculas: la forma original no se guardó.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_users_email" ON "users" ("email")`,
    );
    await queryRunner.query(`DROP INDEX "public"."ux_users_email_lower"`);
  }
}
