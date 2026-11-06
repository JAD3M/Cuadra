import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Historia 5.5 (AD-5, AD-7, AD-13): el dueño apaga o vuelve a prender la
 * separación de funciones de una empresa.
 *
 * - `ck_bitacora_accion` y `ck_bitacora_plataforma_accion` suman
 *   'desactivar_separacion' (la misma acción para apagar y para volver a
 *   prender; el sentido va en `antes/despues` del detalle). Los CHECK van a
 *   mano: TypeORM no compara su texto. Las listas deben coincidir con
 *   `ACCIONES_BITACORA` y `ACCIONES_BITACORA_PLATAFORMA`
 *   (src/common/entities/tipos.ts).
 * - `GRANT UPDATE (separacion_funciones) ON companies`: a nivel de columna,
 *   como `tolerancia_monto`. Solo lo alcanza la ruta de `/plataforma`.
 *
 * `down` no borra datos: con una fila 'desactivar_separacion' en alguna
 * bitácora el ADD CONSTRAINT falla y qué hacer con ella es trabajo de una
 * persona.
 */
const ROL_APP = 'cuadra_app';

const ACCIONES_EMPRESA_ANTES =
  "'crear', 'actualizar', 'eliminar', 'cargar', 'confirmar', 'rechazar', 'acceso_denegado', 'invitar', 'reenviar_invitacion', 'cancelar_invitacion', 'cambiar_rol', 'quitar_rol'";
const ACCIONES_PLATAFORMA_ANTES =
  "'acceso_denegado', 'iniciar_sesion_plataforma', 'cerrar_sesion_plataforma', 'crear_empresa', 'invitar', 'restablecer_contrasena', 'levantar_vista_previa'";

export class DesactivarSeparacion1790714000000 implements MigrationInterface {
  name = 'DesactivarSeparacion1790714000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.reemplazar(
      queryRunner,
      'bitacora',
      'ck_bitacora_accion',
      `${ACCIONES_EMPRESA_ANTES}, 'desactivar_separacion'`,
    );
    await this.reemplazar(
      queryRunner,
      'bitacora_plataforma',
      'ck_bitacora_plataforma_accion',
      `${ACCIONES_PLATAFORMA_ANTES}, 'desactivar_separacion'`,
    );
    await queryRunner.query(
      `GRANT UPDATE ("separacion_funciones") ON "companies" TO ${ROL_APP}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `REVOKE UPDATE ("separacion_funciones") ON "companies" FROM ${ROL_APP}`,
    );
    await this.reemplazar(
      queryRunner,
      'bitacora_plataforma',
      'ck_bitacora_plataforma_accion',
      ACCIONES_PLATAFORMA_ANTES,
    );
    await this.reemplazar(
      queryRunner,
      'bitacora',
      'ck_bitacora_accion',
      ACCIONES_EMPRESA_ANTES,
    );
  }

  private async reemplazar(
    queryRunner: QueryRunner,
    tabla: string,
    restriccion: string,
    acciones: string,
  ): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "${tabla}" DROP CONSTRAINT "${restriccion}"`,
    );
    await queryRunner.query(
      `ALTER TABLE "${tabla}" ADD CONSTRAINT "${restriccion}" CHECK (accion IN (${acciones}))`,
    );
  }
}
