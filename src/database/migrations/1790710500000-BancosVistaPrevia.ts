import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 3.6: el dueño levanta la vista previa obligatoria de un banco.
 *
 * - `bancos_vista_previa`: un renglón por banco levantado (quién y cuándo).
 *   Es global: sin `company_id` y sin RLS, como las demás tablas de
 *   plataforma, y no entra en `arquitectura.ts`. `banco` va normalizado igual
 *   que `cargas.banco` (minúsculas, sin espacios en las puntas). Solo agrega:
 *   `cuadra_app` tiene SELECT e INSERT, nunca UPDATE ni DELETE; si hubiera que
 *   volver a exigir la vista previa, sería otra historia.
 * - `ck_bitacora_plataforma_accion` suma 'levantar_vista_previa'. El CHECK va
 *   a mano: TypeORM no compara su texto. La lista debe coincidir con
 *   `ACCIONES_BITACORA_PLATAFORMA` (src/common/entities/tipos.ts).
 * - `cargas_aceptadas_por_banco()`: cuántas cargas de PDF fueron aceptadas, por
 *   banco, entre todas las empresas. `cargas` tiene RLS FORCE y `cuadra_app`
 *   solo ve su empresa, así que la función es SECURITY DEFINER y devuelve solo
 *   la agregación (banco, conteo), nunca datos de una empresa. Aceptada es una
 *   carga 'procesada' de estado de cuenta con saldos del PDF
 *   (`saldo_inicial` no nulo; solo el PDF los trae): 'rechazada',
 *   'pendiente_vista_previa' y 'fallida' no cuentan. `search_path` fijo, sin
 *   SQL dinámico, EXECUTE solo para `cuadra_app`.
 *
 * Dueño de la función: el rol que migra. FORCE RLS aplica también al dueño de
 * la tabla, salvo que sea superusuario o tenga BYPASSRLS; sin eso la función
 * vería cero filas y el conteo mentiría en silencio. Por eso la migración
 * falla si el rol que migra no puede saltarse RLS. `cuadra_app` nunca lo es.
 *
 * `down` no borra datos: con una fila 'levantar_vista_previa' en la bitácora
 * el ADD CONSTRAINT falla y qué hacer con ella es trabajo de una persona.
 */
const ROL_APP = 'cuadra_app';

export class BancosVistaPrevia1790710500000 implements MigrationInterface {
  name = 'BancosVistaPrevia1790710500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bancos_vista_previa" ("banco" character varying(128) NOT NULL, "levantada_por" uuid NOT NULL, "levantada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "ck_bancos_vista_previa_banco_normalizado" CHECK (banco = lower(btrim(banco))), CONSTRAINT "PK_bancos_vista_previa" PRIMARY KEY ("banco"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "bancos_vista_previa" ADD CONSTRAINT "fk_bancos_vista_previa_usuario" FOREIGN KEY ("levantada_por") REFERENCES "plataforma_usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT ON "bancos_vista_previa" TO ${ROL_APP}`,
    );

    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" DROP CONSTRAINT "ck_bitacora_plataforma_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" ADD CONSTRAINT "ck_bitacora_plataforma_accion" CHECK (accion IN ('acceso_denegado', 'iniciar_sesion_plataforma', 'cerrar_sesion_plataforma', 'crear_empresa', 'invitar', 'restablecer_contrasena', 'levantar_vista_previa'))`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_roles
           WHERE rolname = current_user AND (rolsuper OR rolbypassrls)
        ) THEN
          RAISE EXCEPTION 'El rol que migra (%) debe poder saltarse RLS: cargas_aceptadas_por_banco() contaría cero.', current_user;
        END IF;
      END
      $$`);
    await queryRunner.query(`
      CREATE FUNCTION cargas_aceptadas_por_banco()
      RETURNS TABLE (banco character varying, aceptadas bigint)
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = pg_catalog, public
      AS $$
        SELECT c.banco, count(*)
          FROM public.cargas c
         WHERE c.tipo = 'estado_cuenta'
           AND c.estado = 'procesada'
           AND c.saldo_inicial IS NOT NULL
           AND c.banco IS NOT NULL
         GROUP BY c.banco
      $$`);
    await queryRunner.query(
      `REVOKE EXECUTE ON FUNCTION cargas_aceptadas_por_banco() FROM PUBLIC`,
    );
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION cargas_aceptadas_por_banco() TO ${ROL_APP}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `REVOKE EXECUTE ON FUNCTION cargas_aceptadas_por_banco() FROM ${ROL_APP}`,
    );
    await queryRunner.query(`DROP FUNCTION cargas_aceptadas_por_banco()`);

    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" DROP CONSTRAINT "ck_bitacora_plataforma_accion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bitacora_plataforma" ADD CONSTRAINT "ck_bitacora_plataforma_accion" CHECK (accion IN ('acceso_denegado', 'iniciar_sesion_plataforma', 'cerrar_sesion_plataforma', 'crear_empresa', 'invitar', 'restablecer_contrasena'))`,
    );

    await queryRunner.query(
      `REVOKE ALL ON "bancos_vista_previa" FROM ${ROL_APP}`,
    );
    await queryRunner.query(
      `ALTER TABLE "bancos_vista_previa" DROP CONSTRAINT "fk_bancos_vista_previa_usuario"`,
    );
    await queryRunner.query(`DROP TABLE "bancos_vista_previa"`);
  }
}
