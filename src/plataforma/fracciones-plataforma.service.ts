import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { FraccionesEmpresaDto } from './dto/plataforma.dto';

/**
 * Historia 6.3 (FR-69, AD-10). El dueño mide cuántas facturas son PPD y cuántos
 * movimientos son parcialidades o comisiones, por empresa. Todo sale por
 * consulta cada vez (`fracciones_por_empresa()`, que cruza empresas sin
 * exponer filas de ninguna) y no se guarda nada. Solo mide: ninguna regla lee
 * estos números ni la clase de los movimientos.
 */
@Injectable()
export class FraccionesPlataforma {
  constructor(private readonly ds: DataSource) {}

  async listar(): Promise<FraccionesEmpresaDto[]> {
    // La división va en NUMERIC dentro de la base: nunca pasa por flotante.
    const filas = await this.ds.query<
      Array<{
        companyId: string;
        razonSocial: string;
        totalCfdi: string;
        cfdiPpd: string;
        totalMovimientos: string;
        parcialidades: string;
        comisiones: string;
        fraccionPpd: string | null;
        fraccionParcialidades: string | null;
        fraccionComisiones: string | null;
      }>
    >(
      `SELECT f.company_id AS "companyId", c.razon_social AS "razonSocial",
              f.total_cfdi AS "totalCfdi", f.cfdi_ppd AS "cfdiPpd",
              f.total_movimientos AS "totalMovimientos",
              f.parcialidades, f.comisiones,
              round(f.cfdi_ppd::numeric / nullif(f.total_cfdi, 0), 4)::text
                AS "fraccionPpd",
              round(f.parcialidades::numeric / nullif(f.total_movimientos, 0), 4)::text
                AS "fraccionParcialidades",
              round(f.comisiones::numeric / nullif(f.total_movimientos, 0), 4)::text
                AS "fraccionComisiones"
         FROM fracciones_por_empresa() f
         JOIN companies c ON c.id = f.company_id
        ORDER BY c.razon_social, f.company_id`,
    );
    return filas.map((f) => ({
      companyId: f.companyId,
      razonSocial: f.razonSocial,
      facturas: { total: Number(f.totalCfdi), ppd: Number(f.cfdiPpd) },
      movimientos: {
        total: Number(f.totalMovimientos),
        parcialidades: Number(f.parcialidades),
        comisiones: Number(f.comisiones),
      },
      fraccionPpd: f.fraccionPpd,
      fraccionParcialidades: f.fraccionParcialidades,
      fraccionComisiones: f.fraccionComisiones,
    }));
  }
}
