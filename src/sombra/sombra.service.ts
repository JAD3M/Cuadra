import { Injectable } from '@nestjs/common';
import { TransaccionEmpresa } from '../database/transaccion-empresa';

export interface TasaDeDesacuerdo {
  /** Propuestas de la regla 1 con evidencia (`habria_cerrado`). */
  propuestas: number;
  /** Las que la persona ya tocó: confirmó, rechazó, desmarcó o reabrió. */
  tratadas: number;
  /** Las tratadas en las que la persona no estuvo de acuerdo con Cuadra. */
  desacuerdos: number;
  /** `desacuerdos / tratadas` con cuatro decimales; `null` si no hay tratadas. */
  tasa: string | null;
}

/**
 * Lecturas del modo sombra (AD-10). Solo consulta: la tasa se calcula sobre los
 * eventos cada vez y no se guarda en ninguna tabla (6.2, FR-35).
 */
@Injectable()
export class SombraService {
  constructor(private readonly transaccion: TransaccionEmpresa) {}

  /**
   * Por propuesta (decisión) con `habria_cerrado`, hay desacuerdo si la persona
   * la rechazó o la reabrió, o si la desmarcó y no la confirmó: desmarcar y
   * confirmar igual es acuerdo; desmarcar y resolver de otra forma (rechazo,
   * descarte, a mano) no. Una re-propuesta tras reabrir es otra decisión.
   * Cuenta por decisión, aunque `desmarco` se repita en varios lotes.
   */
  async tasaDesacuerdo(companyId: string): Promise<TasaDeDesacuerdo> {
    const [fila] = await this.transaccion.ejecutar(companyId, (manager) =>
      manager.query<
        { propuestas: number; tratadas: number; desacuerdos: number }[]
      >(
        `WITH por_decision AS (
           SELECT h.decision_id,
                  COALESCE(bool_or(e.evento IN ('rechazo', 'reabrio')), false) AS contradijo,
                  COALESCE(bool_or(e.evento = 'desmarco'), false) AS desmarco,
                  COALESCE(bool_or(e.evento = 'confirmo'), false) AS confirmo,
                  COALESCE(bool_or(e.evento <> 'habria_cerrado'), false) AS tratada
             FROM evidencia_sombra h
             LEFT JOIN evidencia_sombra e
               ON e.decision_id = h.decision_id AND e.company_id = $1
            WHERE h.company_id = $1 AND h.evento = 'habria_cerrado'
            GROUP BY h.decision_id
         )
         SELECT count(*)::int AS propuestas,
                (count(*) FILTER (WHERE tratada))::int AS tratadas,
                (count(*) FILTER (WHERE tratada
                   AND (contradijo OR (desmarco AND NOT confirmo))))::int AS desacuerdos
           FROM por_decision`,
        [companyId],
      ),
    );
    return {
      ...fila,
      tasa:
        fila.tratadas === 0
          ? null
          : (fila.desacuerdos / fila.tratadas).toFixed(4),
    };
  }
}
