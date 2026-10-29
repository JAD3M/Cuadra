import type { EntityManager } from 'typeorm';

/**
 * Fragmento de `datos`: `{"reanudada": true}` si la carga ya tiene una entrada
 * `cargar` anterior (misma empresa), `{}` si es la primera. Se usa sobre el
 * alias `c` de `cargas`.
 */
const AGREGA_REANUDADA = `CASE WHEN EXISTS (
              SELECT 1 FROM bitacora b
               WHERE b.company_id = c.company_id
                 AND b.entidad = 'cargas' AND b.entidad_id = c.id
                 AND b.accion = 'cargar'
            ) THEN jsonb_build_object('reanudada', true)
              ELSE '{}'::jsonb END`;

/**
 * FR-52: la entrada `cargar` de la bitácora, una por carga que termina
 * (procesada, con_errores o fallida). Se escribe en la misma transacción que
 * deja la carga en su estado final, así que no puede haber una sin la otra ni
 * dos por la misma terminación. Un archivo repetido (`yaExistia`) no crea
 * carga y por tanto nunca llega aquí.
 *
 * Si la carga ya tenía una entrada `cargar` (falló y se reanudó), la nueva
 * lleva `reanudada: true` en `datos`; la bitácora solo se agrega, la primera
 * entrada no se toca.
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
            ) || ${AGREGA_REANUDADA}
       FROM cargas c
      WHERE c.id = $1 AND c.company_id = $2`,
    [cargaId, companyId],
  );
}
