import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { nuevoToken } from '../auth/sesiones.service';
import type { Rol } from '../common/entities/tipos';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type {
  InvitacionCanceladaDto,
  InvitacionPendienteDto,
  InvitacionUsuarioEnviadaDto,
} from './dto/usuarios.dto';
import {
  insertarInvitacionViva,
  InvitarUsuariosService,
} from './invitar-usuarios.service';

interface FilaBloqueada {
  id: string;
  email: string;
  roles: Rol[];
  consumida: boolean;
  cerrada: boolean;
}

/**
 * Historia 2.4 (FR-42, FR-50). Una persona administradora ve las invitaciones
 * que nadie ha aceptado y las reenvía o las cancela. Pendiente = ni consumida,
 * ni reemplazada, ni cancelada; la vencida sigue pendiente (se marca).
 *
 * `invitaciones` es clase 2 (sin RLS): la empresa se impone con
 * `company_id = $1` explícito en cada consulta, con el valor de la sesión.
 * Reenviar y cancelar bloquean la fila (`FOR UPDATE`) dentro de la transacción
 * de la petición, así que dos acciones sobre la misma invitación se serializan
 * y la segunda ve el estado ya cambiado. La fila de bitácora confirma junto con
 * el cambio; el correo sale después del COMMIT.
 */
@Injectable()
export class InvitacionesPendientesService {
  constructor(
    private readonly contexto: ContextoEmpresa,
    private readonly invitar: InvitarUsuariosService,
  ) {}

  listar(companyId: string): Promise<InvitacionPendienteDto[]> {
    return this.contexto.manager().query<InvitacionPendienteDto[]>(
      `SELECT i.id, i.email, i.roles,
              i.created_at AS "creadaEn", i.expires_at AS "venceEn",
              i.expires_at <= now() AS vencida,
              u.nombre AS "invitadaPor"
         FROM invitaciones i
         LEFT JOIN users u ON u.id = i.invitada_por_user_id
        WHERE i.company_id = $1
          AND i.consumida_en IS NULL
          AND i.reemplazada_en IS NULL
          AND i.cancelada_en IS NULL
        ORDER BY i.created_at DESC, i.id DESC`,
      [companyId],
    );
  }

  async reenviar(
    companyId: string,
    actorId: string,
    id: string,
  ): Promise<InvitacionUsuarioEnviadaDto> {
    const manager = this.contexto.manager();
    const anterior = await this.bloquearPendiente(
      manager,
      companyId,
      id,
      'reenviar',
    );
    const [empresa] = await manager.query<Array<{ razonSocial: string }>>(
      `SELECT razon_social AS "razonSocial" FROM companies WHERE id = $1`,
      [companyId],
    );
    const token = nuevoToken();

    await manager.query(
      `UPDATE invitaciones SET reemplazada_en = now(), updated_at = now()
        WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    const nuevaId = await insertarInvitacionViva(
      manager,
      companyId,
      actorId,
      anterior.email,
      anterior.roles,
      token,
    );
    await this.registrar(manager, companyId, actorId, 'reenviar_invitacion', {
      invitacionId: nuevaId,
      anteriorId: id,
      email: anterior.email,
      roles: anterior.roles,
    });

    this.contexto.alConfirmar(() =>
      this.invitar.enviarCorreo(
        companyId,
        empresa.razonSocial,
        anterior.email,
        anterior.roles,
        token,
      ),
    );
    return { email: anterior.email, roles: anterior.roles };
  }

  async cancelar(
    companyId: string,
    actorId: string,
    id: string,
  ): Promise<InvitacionCanceladaDto> {
    const manager = this.contexto.manager();
    const fila = await this.bloquearPendiente(
      manager,
      companyId,
      id,
      'cancelar',
    );
    await manager.query(
      `UPDATE invitaciones SET cancelada_en = now(), updated_at = now()
        WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    await this.registrar(manager, companyId, actorId, 'cancelar_invitacion', {
      invitacionId: id,
      email: fila.email,
      roles: fila.roles,
    });
    return { email: fila.email };
  }

  /**
   * Otra empresa o un id inexistente: 404 (no se revela cuál). Existe pero ya
   * no es pendiente: 409 con el motivo, sin tocar nada.
   */
  private async bloquearPendiente(
    manager: EntityManager,
    companyId: string,
    id: string,
    verbo: 'reenviar' | 'cancelar',
  ): Promise<FilaBloqueada> {
    const [fila] = await manager.query<FilaBloqueada[]>(
      `SELECT id, email, roles,
              consumida_en IS NOT NULL AS consumida,
              (reemplazada_en IS NOT NULL OR cancelada_en IS NOT NULL) AS cerrada
         FROM invitaciones
        WHERE id = $1 AND company_id = $2
          FOR UPDATE`,
      [id, companyId],
    );
    if (!fila) throw new NotFoundException('La invitación no existe.');
    if (fila.consumida) {
      throw new ConflictException(
        `Esta invitación ya fue aceptada y no se puede ${verbo}.`,
      );
    }
    if (fila.cerrada) {
      throw new ConflictException('Esta invitación ya no está pendiente.');
    }
    return fila;
  }

  private async registrar(
    manager: EntityManager,
    companyId: string,
    actorId: string,
    accion: 'reenviar_invitacion' | 'cancelar_invitacion',
    datos: Record<string, unknown>,
  ): Promise<void> {
    // Igual que invitar: `entidad` es la empresa; la invitación va en `datos`.
    await manager.query(
      `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
       VALUES ($1, $2, 'companies', $1, $3, $4::jsonb)`,
      [companyId, actorId, accion, JSON.stringify(datos)],
    );
  }
}
