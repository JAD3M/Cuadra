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
   * la rechazó o la reabrió, o si la desmarcó, la resolvió de otra forma y no la
   * confirmó. Desmarcar y confirmar igual es acuerdo. Una desmarcada que sigue
   * pendiente (la decisión es `propuesta` y su movimiento sigue abierto) no
   * entra en la tasa hasta que se resuelva. «Resolver de otra forma» incluye
   * cualquier salida de ese estado: rechazo, descarte del movimiento, a mano.
   * Una re-propuesta tras reabrir es otra decisión. Cuenta por decisión, aunque
   * `desmarco` se repita en varios lotes.
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
                  COALESCE(bool_or(e.evento <> 'habria_cerrado'), false) AS tocada,
                  (d.estado <> 'propuesta' OR m.estado <> 'abierto') AS resuelta
             FROM evidencia_sombra h
             JOIN decisiones d ON d.id = h.decision_id AND d.company_id = $1
             JOIN movimientos m ON m.id = d.movimiento_id AND m.company_id = $1
             LEFT JOIN evidencia_sombra e
               ON e.decision_id = h.decision_id AND e.company_id = $1
            WHERE h.company_id = $1 AND h.evento = 'habria_cerrado'
            GROUP BY h.decision_id, d.estado, m.estado
         ),
         clasificada AS (
           SELECT decision_id,
                  -- Una desmarcada pendiente aún no tiene veredicto.
                  (tocada AND (contradijo OR confirmo OR NOT desmarco OR resuelta)) AS tratada,
                  (contradijo OR (desmarco AND NOT confirmo AND resuelta)) AS desacuerdo
             FROM por_decision
         )
         SELECT count(*)::int AS propuestas,
                (count(*) FILTER (WHERE tratada))::int AS tratadas,
                (count(*) FILTER (WHERE tratada AND desacuerdo))::int AS desacuerdos
           FROM clasificada`,
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
