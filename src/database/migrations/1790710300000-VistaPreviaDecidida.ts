import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 3.4 (FR-3, parte): aceptar o rechazar una vista previa.
 * - `ck_cargas_estado` suma 'rechazada': la carga que la persona descartó en
 *   la vista previa. Distinta de 'fallida' (falló la lectura). Su
 *   `ck_cargas_total_cuadra` no cambia: fuera de procesada y con_errores solo
 *   exige que los contadores no pasen del total, y esta carga los trae en cero.
 * - `cargas.saldo_inicial` y `saldo_final`: los saldos del PDF, NUMERIC y
 *   NULL (solo las cargas de PDF los traen). El PDF no se guarda; sin ellos la
 *   vista previa no podría mostrarlos.
 * - `DELETE` sobre `movimientos_pendientes` para `cuadra_app`: aceptar mueve
 *   las filas a `movimientos` y rechazar las descarta. La tabla sigue con RLS
 *   FORCE y su política: el DELETE solo alcanza filas de la empresa fijada.
 *   Aceptar escribe en `movimientos` y actualiza `cargas`: ambos GRANT ya
 *   existen desde AislamientoRls.
 *
 * Los CHECK van a mano: TypeORM no compara su texto. La lista de estados
 * debe coincidir con `ESTADOS_CARGA` (src/common/entities/tipos.ts).
 *
 * `down` no borra datos: con una carga 'rechazada' el ADD CONSTRAINT falla y
 * qué hacer con ella es trabajo de una persona.
 */
const ROL_APP = 'cuadra_app';

export class VistaPreviaDecidida1790710300000 implements MigrationInterface {
  name = 'VistaPreviaDecidida1790710300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cargas" DROP CONSTRAINT "ck_cargas_estado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD CONSTRAINT "ck_cargas_estado" CHECK (estado IN ('pendiente', 'procesando', 'procesada', 'con_errores', 'fallida', 'pendiente_vista_previa', 'rechazada'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD "saldo_inicial" numeric(18,4)`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD "saldo_final" numeric(18,4)`,
    );
    await queryRunner.query(
      `GRANT DELETE ON "movimientos_pendientes" TO ${ROL_APP}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `REVOKE DELETE ON "movimientos_pendientes" FROM ${ROL_APP}`,
    );
    await queryRunner.query(`ALTER TABLE "cargas" DROP COLUMN "saldo_final"`);
    await queryRunner.query(`ALTER TABLE "cargas" DROP COLUMN "saldo_inicial"`);
    await queryRunner.query(
      `ALTER TABLE "cargas" DROP CONSTRAINT "ck_cargas_estado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cargas" ADD CONSTRAINT "ck_cargas_estado" CHECK (estado IN ('pendiente', 'procesando', 'procesada', 'con_errores', 'fallida', 'pendiente_vista_previa'))`,
    );
  }
}
