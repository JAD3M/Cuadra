import { Injectable, NotFoundException } from '@nestjs/common';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type {
  EventoHistorialDto,
  RespuestaHistorialDto,
} from './dto/bitacora.dto';

interface FilaSql {
  id: string;
  entidad: string;
  entidad_id: string;
  accion: string;
  datos: Record<string, unknown> | null;
  created_at: Date;
  user_id: string | null;
  nombre: string | null;
  email: string | null;
}

/**
 * CU-16. Lectura de la bitácora: solo SELECT, con el manager de la
 * transacción de la petición (RLS como cuadra_app) y además `company_id` en
 * cada consulta y join. `datos` sale tal como se guardó: los eventos de
 * CU-15 tienen dos formas y aquí no se interpretan.
 */
@Injectable()
export class BitacoraService {
  constructor(private readonly contexto: ContextoEmpresa) {}

  /**
   * Eventos de una conciliación, del más antiguo al más nuevo. Una propuesta
   * anterior a CU-16 no tiene fila 'crear' y devuelve solo lo posterior. El
   * 404 es el mismo para una conciliación inexistente y para una ajena.
   */
  async historial(
    companyId: string,
    conciliacionId: string,
  ): Promise<RespuestaHistorialDto> {
    const manager = this.contexto.manager();
    const existe = await manager.query<{ id: string }[]>(
      'SELECT id FROM conciliaciones WHERE id = $1 AND company_id = $2',
      [conciliacionId, companyId],
    );
    if (existe.length === 0) {
      throw new NotFoundException('Conciliación no encontrada');
    }
    // Sin ip ni user_agent: solo el listado general los expone.
    const filas = await manager.query<FilaSql[]>(
      `SELECT b.id, b.entidad, b.entidad_id, b.accion, b.datos, b.created_at,
              b.user_id, u.nombre, u.email
         FROM bitacora b
         LEFT JOIN users u ON u.id = b.user_id
        WHERE b.company_id = $1
          AND b.entidad = 'conciliaciones'
          AND b.entidad_id = $2
        ORDER BY b.created_at ASC, b.id ASC`,
      [companyId, conciliacionId],
    );
    return { datos: filas.map(aEvento) };
  }
}

/** Sin `user_id` el actor es el sistema (motor de reglas): usuario null. */
function aEvento(f: FilaSql): EventoHistorialDto {
  return {
    id: f.id,
    entidad: f.entidad,
    entidadId: f.entidad_id,
    accion: f.accion,
    datos: f.datos,
    createdAt: f.created_at.toISOString(),
    usuario:
      f.user_id === null || f.nombre === null || f.email === null
        ? null
        : { nombre: f.nombre, email: f.email },
  };
}
