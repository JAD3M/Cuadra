import { Injectable, NotFoundException } from '@nestjs/common';
import { ContextoEmpresa } from '../database/contexto-empresa';
import type { VistaPreviaDto } from './dto/vista-previa.dto';

interface FilaCargaEnEspera {
  nombre_archivo: string;
  banco: string | null;
  total_registros: number;
  saldo_inicial: string;
  saldo_final: string;
}

interface FilaMovimiento {
  fecha: string;
  monto: string;
  referencia: string | null;
}

/**
 * Historia 3.4 (FR-3, parte): la vista previa de un PDF que cuadró y espera
 * en `movimientos_pendientes`. Aquí viven leerla (T2), aceptarla (T3) y
 * rechazarla (T4). Todo corre en la transacción de la petición, con RLS; el
 * filtro por empresa va igual en cada consulta (CLAUDE.md).
 */
@Injectable()
export class VistaPreviaService {
  constructor(private readonly contexto: ContextoEmpresa) {}

  /**
   * Solo lectura. 404 si la carga no existe, es de otra empresa o no está en
   * 'pendiente_vista_previa': para quien pregunta, no hay vista previa. Los
   * montos salen como texto de NUMERIC, nunca por flotante.
   */
  async consultar(companyId: string, cargaId: string): Promise<VistaPreviaDto> {
    const manager = this.contexto.manager();
    const [carga] = await manager.query<FilaCargaEnEspera[]>(
      `SELECT nombre_archivo, banco, total_registros,
              saldo_inicial::text AS saldo_inicial,
              saldo_final::text AS saldo_final
         FROM cargas
        WHERE id = $1 AND company_id = $2
          AND estado = 'pendiente_vista_previa'`,
      [cargaId, companyId],
    );
    if (!carga) throw new NotFoundException();
    const movimientos = await manager.query<FilaMovimiento[]>(
      `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, monto::text AS monto,
              referencia
         FROM movimientos_pendientes
        WHERE carga_id = $1 AND company_id = $2
        ORDER BY linea_numero`,
      [cargaId, companyId],
    );
    return {
      cargaId,
      archivo: carga.nombre_archivo,
      banco: carga.banco,
      total: movimientos.length,
      saldoInicial: carga.saldo_inicial,
      saldoFinal: carga.saldo_final,
      movimientos,
    };
  }
}
