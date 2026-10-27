import type { EntityManager } from 'typeorm';

/**
 * FR-52: la entrada `cargar` de la bitácora, una por carga que termina
 * (procesada, con_errores o fallida). Se escribe en la misma transacción que
 * deja la carga en su estado final, así que no puede haber una sin la otra ni
 * dos por la misma terminación. Un archivo repetido (`yaExistia`) no crea
 * carga y por tanto nunca llega aquí.
 *
 * `user_id` es quien subió el archivo; `datos` lleva nombres y conteos,
 * nunca el contenido. Lee la carga ya actualizada, con el filtro de empresa.
 */
export async function registrarCargar(
  manager: EntityManager,
  companyId: string,
  cargaId: string,
): Promise<void> {
  await manager.query(
    `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
     SELECT c.company_id, c.subido_por_id, 'cargas', c.id, 'cargar',
            jsonb_build_object(
              'cargaId', c.id,
              'tipo', c.tipo,
              'archivo', c.nombre_archivo,
              'estado', c.estado,
              'registrosOk', c.registros_ok,
              'registrosExistentes', c.registros_existentes,
              'registrosError', c.registros_error,
              'totalRegistros', c.total_registros
            )
       FROM cargas c
      WHERE c.id = $1 AND c.company_id = $2`,
    [cargaId, companyId],
  );
}
