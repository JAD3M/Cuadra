import { Injectable } from '@nestjs/common';
import { Bitacora } from '../bitacora/bitacora.entity';
import { ContextoEmpresa } from '../database/contexto-empresa';

export interface ContextoDeCambio {
  userId: string;
  ip?: string;
  userAgent?: string;
}

/**
 * CU-12. Lee y cambia la tolerancia de monto de la empresa de la sesión. Usa
 * el manager de la transacción de la petición: el UPDATE y la bitácora
 * confirman juntos o no confirman. El id de empresa siempre viene del token.
 *
 * Cambiarla no vuelve a correr `conciliar`: aplica desde la siguiente corrida.
 */
@Injectable()
export class ToleranciaService {
  constructor(private readonly contexto: ContextoEmpresa) {}

  async obtener(companyId: string): Promise<string> {
    const filas = await this.contexto
      .manager()
      .query<{ tolerancia: string }[]>(
        `SELECT tolerancia_monto::text AS tolerancia FROM companies WHERE id = $1`,
        [companyId],
      );
    return filas[0].tolerancia;
  }

  async actualizar(
    companyId: string,
    toleranciaMonto: string,
    quien: ContextoDeCambio,
  ): Promise<string> {
    const manager = this.contexto.manager();
    // `cuadra_app` solo tiene UPDATE sobre tolerancia_monto: nada de
    // `updated_at` ni del ORM. FOR UPDATE fija el valor previo que se audita.
    // TypeORM devuelve `[filas, afectadas]` para un UPDATE ... RETURNING.
    const [[cambio]] = await manager.query<
      [{ antes: string; despues: string }[], number]
    >(
      `WITH previa AS (
         SELECT tolerancia_monto FROM companies WHERE id = $1 FOR UPDATE
       )
       UPDATE companies c SET tolerancia_monto = $2
         FROM previa
        WHERE c.id = $1
        RETURNING previa.tolerancia_monto::text AS antes,
                  c.tolerancia_monto::text AS despues`,
      [companyId, toleranciaMonto],
    );
    await manager.insert(Bitacora, {
      companyId,
      userId: quien.userId,
      entidad: 'companies',
      entidadId: companyId,
      accion: 'actualizar',
      datos: {
        campo: 'tolerancia_monto',
        antes: cambio.antes,
        despues: cambio.despues,
      },
      ip: quien.ip ?? null,
      userAgent: quien.userAgent ?? null,
    });
    return cambio.despues;
  }
}
