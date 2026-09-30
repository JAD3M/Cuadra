// src/sugerencias/persistencia-sugerencias.ts
import { Injectable } from '@nestjs/common';
import { aTexto, CERO, dinero } from '../common/dinero';
import { REGLA_LLM_SUGERENCIA } from '../common/entities/tipos';
import { tomarCandadoDeConciliacion } from '../conciliacion/candado';
import { compatibles } from '../conciliacion/evaluar-par';
import { TransaccionEmpresa } from '../database/transaccion-empresa';
import type { SolicitudSugerencia } from './candidatos';
import type { Confianza } from './proveedor-sugerencia';

/** Lo que el servicio necesita saber de una escritura de propuesta. */
export interface PropuestaPorGuardar {
  solicitud: SolicitudSugerencia;
  cfdiId: string;
  confianza: Confianza;
  /** Ya saneado y con prefijo (`motivoDeSugerencia`). */
  motivo: string;
  modelo: string;
}

/**
 * 'creada': quedó la propuesta, su fila en la bitácora y el libro.
 * 'obsoleta': el estado cambió mientras el modelo pensaba; no se escribió
 * nada, ni siquiera el libro, para que la próxima corrida lo reevalúe.
 */
export type ResultadoPropuesta = 'creada' | 'obsoleta';

interface CfdiBloqueado {
  estado: string;
  tipo: string;
  moneda: string;
  fechaEmision: string;
  total: string;
  esDeLaEmpresa: boolean;
}

interface MovimientoBloqueado {
  estado: string;
  monto: string;
  moneda: string;
  fecha: string;
  regla: string | null;
  motivo: string | null;
}

/**
 * CU-17. Las escrituras de la sugerencia, cada una en su propia transacción
 * corta como `cuadra_app` (RLS). Se llaman DESPUÉS de la respuesta del modelo:
 * el candado de la empresa nunca se sostiene durante la llamada al proveedor.
 * Toda consulta filtra `company_id` además de RLS.
 */
@Injectable()
export class PersistenciaSugerencias {
  constructor(private readonly transaccion: TransaccionEmpresa) {}

  /**
   * Orden de candados, el mismo que `conciliar()` y CU-15: candado de la
   * empresa -> CFDI -> movimiento. Con el candado tomado, revisa otra vez todo
   * lo que el servicio leyó antes de llamar al modelo; si algo cambió, no
   * escribe. La propuesta, su fila `crear` en la bitácora, la limpieza del
   * motivo y el libro van juntos o no va nada.
   */
  async proponer(
    companyId: string,
    p: PropuestaPorGuardar,
  ): Promise<ResultadoPropuesta> {
    const { movimiento } = p.solicitud;
    return this.transaccion.ejecutar(companyId, async (manager) => {
      await tomarCandadoDeConciliacion(manager, companyId);

      const cfdis = await manager.query<CfdiBloqueado[]>(
        `SELECT estado, tipo_comprobante AS tipo, moneda,
                to_char(fecha_emision, 'YYYY-MM-DD') AS "fechaEmision",
                total::text AS total,
                rfc_emisor = (SELECT rfc FROM companies WHERE id = $2) AS "esDeLaEmpresa"
           FROM cfdi
          WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [p.cfdiId, companyId],
      );
      const movimientos = await manager.query<MovimientoBloqueado[]>(
        `SELECT estado, monto::text AS monto, moneda,
                to_char(fecha, 'YYYY-MM-DD') AS fecha,
                regla_sin_match AS regla, motivo_sin_match AS motivo
           FROM movimientos
          WHERE id = $1 AND company_id = $2 FOR UPDATE`,
        [movimiento.id, companyId],
      );
      if (cfdis.length === 0 || movimientos.length === 0) return 'obsoleta';
      const [cfdi] = cfdis;
      const [mov] = movimientos;

      // El veredicto del motor tiene que ser el mismo con el que se preguntó.
      // Se compara regla y motivo, no `evaluado_at`, que depende de la
      // precisión del reloj.
      const vigente =
        mov.estado === 'abierto' &&
        dinero(mov.monto).gt(CERO) &&
        mov.regla === movimiento.regla &&
        mov.motivo === movimiento.motivo &&
        cfdi.estado === 'abierta' &&
        cfdi.tipo === 'I' &&
        cfdi.esDeLaEmpresa &&
        compatibles(
          {
            id: movimiento.id,
            fecha: mov.fecha,
            monto: mov.monto,
            moneda: mov.moneda,
            referencia: null,
            referenciaNorm: null,
          },
          {
            id: p.cfdiId,
            serie: null,
            folio: null,
            fechaEmision: cfdi.fechaEmision,
            total: cfdi.total,
            moneda: cfdi.moneda,
          },
        );
      if (!vigente) return 'obsoleta';

      const ocupados = await manager.query<unknown[]>(
        `SELECT 1 FROM conciliaciones
          WHERE company_id = $1 AND estado <> 'rechazada'
            AND (movimiento_id = $2 OR cfdi_id = $3)
          LIMIT 1`,
        [companyId, movimiento.id, p.cfdiId],
      );
      if (ocupados.length > 0) return 'obsoleta';

      // La misma forma que `ConciliacionService.insertar`: el CTE deja la
      // conciliación y su fila `crear` en UNA sentencia. Un par que
      // ON CONFLICT descarta (p. ej. uno rechazado) no sale de RETURNING:
      // 0 filas es obsoleta. El autor es el sistema (`user_id` NULL).
      // La diferencia se calcula con decimal.js sobre lo releído, nunca con number.
      const diferencia = aTexto(dinero(mov.monto).minus(dinero(cfdi.total)), 4);
      const auditadas = await manager.query<{ id: string }[]>(
        `WITH creada AS (
           INSERT INTO conciliaciones
                  (company_id, cfdi_id, movimiento_id, estado, origen, regla,
                   score, diferencia_monto, motivo)
           VALUES ($1, $2, $3, 'propuesta', 'llm', $4, NULL, $5::numeric, $6)
           ON CONFLICT (company_id, cfdi_id, movimiento_id) DO NOTHING
           RETURNING id, cfdi_id, movimiento_id, regla, diferencia_monto
         )
         INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
         SELECT $1, NULL, 'conciliaciones', c.id, 'crear',
                jsonb_build_object(
                  'despues', jsonb_build_object('estado', 'propuesta'),
                  'origen', 'llm',
                  'regla', c.regla,
                  'modelo', $7::text,
                  'inputHash', $8::text,
                  'confianza', $9::text,
                  'diferenciaMonto', c.diferencia_monto::text,
                  'cfdiId', c.cfdi_id,
                  'movimientoId', c.movimiento_id)
           FROM creada c
         RETURNING id`,
        [
          companyId,
          p.cfdiId,
          movimiento.id,
          REGLA_LLM_SUGERENCIA,
          diferencia,
          p.motivo,
          p.modelo,
          p.solicitud.inputHash,
          p.confianza,
        ],
      );
      if (auditadas.length === 0) return 'obsoleta';

      // Un motivo nunca convive con una propuesta vigente; los tres van juntos
      // (ck_movimientos_sin_match_par), igual que `limpiarMotivos`.
      await manager.query(
        `UPDATE movimientos
            SET motivo_sin_match = NULL, regla_sin_match = NULL, evaluado_at = NULL
          WHERE id = $1 AND company_id = $2`,
        [movimiento.id, companyId],
      );
      await this.anotar(manager, companyId, p.solicitud, 'propuesta');
      return 'creada';
    });
  }

  /**
   * El modelo no sugirió nada (o lo que dijo no pasó la validación): se anota
   * para no volver a preguntar lo mismo. No toca conciliaciones ni movimientos.
   */
  async registrarSinSugerencia(
    companyId: string,
    solicitud: SolicitudSugerencia,
  ): Promise<void> {
    await this.transaccion.ejecutar(companyId, (manager) =>
      this.anotar(manager, companyId, solicitud, 'sin_sugerencia'),
    );
  }

  private async anotar(
    manager: Parameters<Parameters<TransaccionEmpresa['ejecutar']>[1]>[0],
    companyId: string,
    solicitud: SolicitudSugerencia,
    resultado: 'propuesta' | 'sin_sugerencia',
  ): Promise<void> {
    await manager.query(
      `INSERT INTO sugerencias_ia (company_id, movimiento_id, input_hash, resultado)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (company_id, movimiento_id, input_hash) DO NOTHING`,
      [companyId, solicitud.movimiento.id, solicitud.inputHash, resultado],
    );
  }
}
