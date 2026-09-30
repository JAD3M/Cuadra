import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LIMITE_POR_DEFECTO } from '../bandeja/dto/bandeja.dto';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type {
  ConsultaBitacoraDto,
  EventoBitacoraDto,
  EventoHistorialDto,
  RespuestaBitacoraDto,
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

interface FilaListadoSql extends FilaSql {
  ip: string | null;
  user_agent: string | null;
}

/**
 * Columna de `conciliaciones` que enlaza cada entidad con su historia: la
 * bitácora de una conciliación no guarda el CFDI ni el movimiento en una
 * forma única (CU-15 tiene dos), así que se llega por la tabla.
 */
const COLUMNA_DE_CONCILIACION: Record<string, string> = {
  cfdi: 'c.cfdi_id',
  movimientos: 'c.movimiento_id',
};

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

  /**
   * Bitácora de la empresa, del más nuevo al más antiguo. Los filtros se
   * combinan con AND y sus valores siempre viajan como parámetros. La
   * historia de un CFDI o de un movimiento incluye las filas de sus
   * conciliaciones (join por llave primaria, sin multiplicar filas).
   */
  async listar(
    companyId: string,
    consulta: ConsultaBitacoraDto,
  ): Promise<RespuestaBitacoraDto> {
    const pagina = consulta.pagina ?? 1;
    const limite = consulta.limite ?? LIMITE_POR_DEFECTO;
    const params: unknown[] = [companyId];
    const donde = ['b.company_id = $1'];
    const parametro = (valor: unknown): string => {
      params.push(valor);
      return `$${params.length}`;
    };

    const { entidad, entidadId } = consulta;
    const columna =
      entidad === undefined ? undefined : COLUMNA_DE_CONCILIACION[entidad];
    if (entidadId !== undefined && columna !== undefined && entidad) {
      const e = parametro(entidad);
      const id = parametro(entidadId);
      donde.push(
        `((b.entidad = ${e} AND b.entidad_id = ${id})
          OR (b.entidad = 'conciliaciones' AND ${columna} = ${id}))`,
      );
    } else {
      if (entidad !== undefined)
        donde.push(`b.entidad = ${parametro(entidad)}`);
      if (entidadId !== undefined) {
        donde.push(`b.entidad_id = ${parametro(entidadId)}`);
      }
    }
    if (consulta.accion !== undefined) {
      donde.push(`b.accion = ${parametro(consulta.accion)}`);
    }
    if (consulta.userId !== undefined) {
      donde.push(`b.user_id = ${parametro(consulta.userId)}`);
    }
    // Instantes UTC explícitos: la zona de la sesión no cambia el resultado.
    const desde =
      consulta.desde === undefined ? null : new Date(consulta.desde);
    const hasta =
      consulta.hasta === undefined ? null : new Date(consulta.hasta);
    if (desde !== null && hasta !== null && desde > hasta) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }
    if (desde !== null) {
      donde.push(
        `b.created_at >= ${parametro(desde.toISOString())}::timestamptz`,
      );
    }
    if (hasta !== null) {
      donde.push(
        `b.created_at < ${parametro(hasta.toISOString())}::timestamptz`,
      );
    }

    const desdeSql = `
      FROM bitacora b
      LEFT JOIN conciliaciones c
        ON b.entidad = 'conciliaciones' AND c.id = b.entidad_id AND c.company_id = $1
      LEFT JOIN users u ON u.id = b.user_id
     WHERE ${donde.join(' AND ')}`;

    const manager = this.contexto.manager();
    const [{ total }] = await manager.query<{ total: number }[]>(
      `SELECT count(*)::int AS total ${desdeSql}`,
      params,
    );
    const filas = await manager.query<FilaListadoSql[]>(
      `SELECT b.id, b.entidad, b.entidad_id, b.accion, b.datos, b.created_at,
              b.user_id, u.nombre, u.email, host(b.ip) AS ip, b.user_agent
       ${desdeSql}
       ORDER BY b.created_at DESC, b.id DESC
       LIMIT ${parametro(limite)} OFFSET ${parametro((pagina - 1) * limite)}`,
      params,
    );
    return { datos: filas.map(aEventoListado), pagina, limite, total };
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

function aEventoListado(f: FilaListadoSql): EventoBitacoraDto {
  return { ...aEvento(f), ip: f.ip, userAgent: f.user_agent };
}
