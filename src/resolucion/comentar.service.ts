import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { ComentarioDto } from './dto/comentar.dto';
import type { ContextoDeConfirmacion } from './resolucion.service';

interface FilaComentario {
  id: string;
  decisionId: string;
  texto: string;
  por: string;
  fecha: Date;
}

/**
 * Historia 5.9 (FR-68, AD-4, AD-7). Una observación sobre una decisión: se
 * agrega a `decision_comentarios` y a la bitácora en la misma sentencia y no
 * toca la decisión, las facturas ni el movimiento, así que no necesita el
 * candado de empresa. No hay edición ni borrado: `cuadra_app` solo tiene
 * SELECT e INSERT. Quien está de acuerdo reabre con la 5.7.
 */
@Injectable()
export class ComentarService {
  constructor(private readonly contexto: ContextoEmpresa) {}

  async comentar(
    companyId: string,
    decisionId: string,
    texto: string,
    quien: ContextoDeConfirmacion,
  ): Promise<ComentarioDto> {
    const manager = this.contexto.manager();
    const existe = await manager.query<{ id: string }[]>(
      `SELECT id FROM decisiones
        WHERE id = $1 AND company_id = $2 AND tipo = 'conciliacion'`,
      [decisionId, companyId],
    );
    if (existe.length === 0) {
      throw new NotFoundException('Conciliación no encontrada');
    }

    const filas = await manager.query<FilaComentario[]>(
      `WITH nuevo AS (
         INSERT INTO decision_comentarios (company_id, decision_id, autor_id, texto)
         VALUES ($1, $2, $3, $4)
         RETURNING id, decision_id, texto, created_at
       ),
       auditoria AS (
         INSERT INTO bitacora
                (company_id, user_id, entidad, entidad_id, accion, datos, ip, user_agent)
         SELECT $1::uuid, $3::uuid, 'decisiones', n.decision_id, 'comentar',
                jsonb_build_object('comentarioId', n.id, 'texto', n.texto),
                $5::inet, $6
           FROM nuevo n
         RETURNING id
       )
       SELECT n.id, n.decision_id AS "decisionId", n.texto, u.nombre AS por,
              n.created_at AS fecha
         FROM nuevo n
         JOIN users u ON u.id = $3
        WHERE (SELECT count(*) FROM auditoria) = 1`,
      [
        companyId,
        decisionId,
        quien.userId,
        texto,
        quien.ip ?? null,
        quien.userAgent ?? null,
      ],
    );
    if (filas.length !== 1) {
      throw new ConflictException('No se pudo guardar el comentario');
    }
    const fila = filas[0];
    return {
      id: fila.id,
      decisionId: fila.decisionId,
      texto: fila.texto,
      por: fila.por,
      fecha: new Date(fila.fecha).toISOString(),
    };
  }
}
