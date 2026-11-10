import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 5.9 (AD-4, AD-7, FR-68). Tabla de dominio (clase 1, solo agregar)
 * `decision_comentarios`: company_id, RLS con FORCE, política y GRANTs aquí
 * mismo. `cuadra_app` solo tiene SELECT e INSERT: un comentario no se edita ni
 * se borra. La FK hacia la decisión es RESTRICT por la misma razón.
 *
 * `ck_bitacora_accion` suma 'comentar'. El CHECK va a mano (TypeORM no compara
 * su texto) y debe coincidir con `ACCIONES_BITACORA`
 * (src/common/entities/tipos.ts).
 *
 * `down` no borra datos: con una fila 'comentar' en la bitácora el ADD
 * CONSTRAINT falla, y qué hacer con ella es trabajo de una persona. Con
 * comentarios guardados, el DROP TABLE los pierde: corre con el rol dueño y
 * después de un respaldo (docs/despliegue.md).
 */
const ROL_APP = 'cuadra_app';
const ACCIONES_ANTES =
  "'crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar', 'acceso_denegado', 'invitar', 'reenviar_invitacion', 'cancelar_invitacion', 'cambiar_rol', 'quitar_rol', 'desactivar_separacion', 'descartar', 'deshacer_descarte', 'reabrir'";

export class ComentariosDecision1790718000000 implements MigrationInterface {
  name = 'ComentariosDecision1790718000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "decision_comentarios" ("id" uuid NOT NULL DEFAULT uuidv7(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "decision_id" uuid NOT NULL, "autor_id" uuid NOT NULL, "texto" text NOT NULL, CONSTRAINT "ck_decision_comentarios_texto" CHECK (length(btrim(texto)) > 0 AND length(texto) <= 1000), CONSTRAINT "PK_decision_comentarios" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_decision_comentarios_company_id_decision_id" ON "decision_comentarios" ("company_id", "decision_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "decision_comentarios" ADD CONSTRAINT "fk_decision_comentarios_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "decision_comentarios" ADD CONSTRAINT "fk_decision_comentarios_decision" FOREIGN KEY ("decision_id") REFERENCES "decisiones"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "decision_comentarios" ADD CONSTRAINT "fk_decision_comentarios_autor" FOREIGN KEY ("autor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "decision_comentarios" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `ALTER TABLE "decision_comentarios" FORCE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `CREATE POLICY "rls_decision_comentarios_company" ON "decision_comentarios"
       USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
       WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid)`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT ON "decision_comentarios" TO ${ROL_APP}`,
    );

    await this.reemplazarAcciones(queryRunner, `${ACCIONES_ANTES}, 'comentar'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.reemplazarAcciones(queryRunner, ACCIONES_ANTES);
    await queryRunner.query(
      `REVOKE ALL ON "decision_comentarios" FROM ${ROL_APP}`,
    );
    // Índice, FK y política se van con la tabla.
    await queryRunner.query(`DROP TABLE "decision_comentarios"`);
  }

  private async reemplazarAcciones(
    queryRunner: QueryRunner,
    acciones: string,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bitacora" DROP CONSTRAINT "ck_bitacora_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora" ADD CONSTRAINT "ck_bitacora_accion" CHECK (accion IN (${acciones}))`,
    );
  }
}
