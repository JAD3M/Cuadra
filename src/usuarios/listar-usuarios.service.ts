import { Injectable } from '@nestjs/common';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { UsuarioListadoDto } from './dto/usuarios.dto';

/**
 * Historia 2.5 (FR-47). Una fila por persona de la empresa: activa (con sus
 * roles en esta empresa) o con invitación pendiente. Si una persona activa
 * tiene además una invitación abierta (invitar no lo impide), gana la activa.
 *
 * `users`, `user_company_roles` e `invitaciones` no tienen RLS: la empresa se
 * impone con `company_id = $1` explícito, con el valor de la sesión.
 */
@Injectable()
export class ListarUsuariosService {
  constructor(private readonly contexto: ContextoEmpresa) {}

  listar(companyId: string): Promise<UsuarioListadoDto[]> {
    return this.contexto.manager().query<UsuarioListadoDto[]>(
      `WITH activos AS (
         SELECT u.id, u.email, u.nombre,
                array_agg(ucr.rol::text ORDER BY ucr.rol::text) AS roles
           FROM users u
           JOIN user_company_roles ucr ON ucr.user_id = u.id
          WHERE ucr.company_id = $1 AND u.activo
          GROUP BY u.id, u.email, u.nombre
       )
       SELECT id, email, nombre, roles, 'activo' AS estado,
              NULL::uuid AS "invitacionId", false AS vencida,
              NULL::timestamptz AS "venceEn", NULL::timestamptz AS "creadaEn",
              NULL::text AS "invitadaPor"
         FROM activos
       UNION ALL
       SELECT i.id, i.email, NULL, i.roles::text[], 'pendiente',
              i.id, i.expires_at <= now(),
              i.expires_at, i.created_at, u.nombre
         FROM invitaciones i
         LEFT JOIN users u ON u.id = i.invitada_por_user_id
        WHERE i.company_id = $1
          AND i.consumida_en IS NULL
          AND i.reemplazada_en IS NULL
          AND i.cancelada_en IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM activos a WHERE lower(a.email) = lower(i.email)
          )
       ORDER BY email, id`,
      [companyId],
    );
  }
}
