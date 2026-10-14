import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 1.4 (FR-39, AD-7). El dueño crea empresas desde la API.
 *
 * - `companies.separacion_funciones`: la empresa nace con la separación de
 *   funciones activa; volverla configurable es de la épica 5.
 * - `companies` no tiene RLS y `cuadra_app` solo tenía SELECT y UPDATE de una
 *   columna. Se concede INSERT únicamente sobre `rfc` y `razon_social`: el
 *   resto (activa, tolerancia, régimen, separación) toma su valor por defecto.
 *   Nunca INSERT de tabla completa.
 * - `crear_empresa` entra al CHECK de `bitacora_plataforma`. La lista debe
 *   coincidir con `ACCIONES_BITACORA_PLATAFORMA` (src/common/entities/tipos.ts);
 *   el texto va a mano porque TypeORM no compara el de un CHECK.
 */
export class CrearEmpresas1790709400000 implements MigrationInterface {
  name = 'CrearEmpresas1790709400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "companies" ADD "separacion_funciones" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `GRANT INSERT (rfc, razon_social) ON "companies" TO cuadra_app`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" DROP CONSTRAINT "ck_bitacora_plataforma_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" ADD CONSTRAINT "ck_bitacora_plataforma_accion" CHECK (accion IN ('acceso_denegado', 'iniciar_sesion_plataforma', 'cerrar_sesion_plataforma', 'crear_empresa'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" DROP CONSTRAINT "ck_bitacora_plataforma_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" ADD CONSTRAINT "ck_bitacora_plataforma_accion" CHECK (accion IN ('acceso_denegado', 'iniciar_sesion_plataforma', 'cerrar_sesion_plataforma'))`,
    );
    await queryRunner.query(
      `REVOKE INSERT (rfc, razon_social) ON "companies" FROM cuadra_app`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" DROP COLUMN "separacion_funciones"`,
    );
  }
}
