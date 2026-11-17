import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { DesacuerdoEmpresaBancoDto } from './dto/plataforma.dto';

/**
 * Historia 9.2 (FR-37, AD-10). La tasa de desacuerdo por empresa y por banco
 * para el dueño. Sale por consulta cada vez (`desacuerdo_por_empresa_y_banco()`,
 * que cruza empresas y devuelve solo conteos) y no se guarda nada. La división
 * va en NUMERIC dentro de la base: nunca pasa por flotante.
 */
@Injectable()
export class DesacuerdoPlataforma {
  constructor(private readonly ds: DataSource) {}

  async listar(): Promise<DesacuerdoEmpresaBancoDto[]> {
    const filas = await this.ds.query<
      Array<{
        companyId: string;
        razonSocial: string;
        banco: string | null;
        propuestas: string;
        tratadas: string;
        desacuerdos: string;
        tasa: string | null;
      }>
    >(
      `SELECT d.company_id AS "companyId", c.razon_social AS "razonSocial",
              d.banco, d.propuestas, d.tratadas, d.desacuerdos,
              round(d.desacuerdos::numeric / nullif(d.tratadas, 0), 4)::text AS tasa
         FROM desacuerdo_por_empresa_y_banco() d
         JOIN companies c ON c.id = d.company_id
        ORDER BY c.razon_social, d.company_id, d.banco NULLS LAST`,
    );
    return filas.map((f) => ({
      companyId: f.companyId,
      razonSocial: f.razonSocial,
      banco: f.banco,
      propuestas: Number(f.propuestas),
      tratadas: Number(f.tratadas),
      desacuerdos: Number(f.desacuerdos),
      tasa: f.tasa,
    }));
  }
}
