import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  evaluarCondicionCierre,
  type CondicionCierre,
} from './condicion-cierre';

/**
 * Historia 9.5 (FR-37, SM-C1, AD-10). La condición del PRD para considerar el
 * cierre automático, para el dueño. Se calcula en cada consulta: las tasas
 * salen de las mismas funciones de la 9.2 y de `conteos_condicion_cierre()`,
 * que cruzan empresas y devuelven solo conteos. No guarda nada y no activa
 * nada (AD-3).
 */
@Injectable()
export class CondicionCierrePlataforma {
  constructor(private readonly ds: DataSource) {}

  async consultar(): Promise<CondicionCierre> {
    // Una sola sentencia: los conteos y la tasa de las respuestas ven la misma
    // foto de los datos.
    const [f] = await this.ds.query<
      Array<{
        propuestas: string;
        tratadas: string;
        desacuerdos: string;
        empresas: string;
        meses: string;
        verificados: string;
        desacuerdosMuestra: string;
      }>
    >(
      `SELECT (SELECT COALESCE(sum(d.propuestas), 0) FROM desacuerdo_por_empresa_y_banco() d)::text AS propuestas,
              (SELECT COALESCE(sum(d.tratadas), 0) FROM desacuerdo_por_empresa_y_banco() d)::text AS tratadas,
              (SELECT COALESCE(sum(d.desacuerdos), 0) FROM desacuerdo_por_empresa_y_banco() d)::text AS desacuerdos,
              c.empresas::text AS empresas, c.meses::text AS meses,
              c.verificados::text AS verificados,
              c.desacuerdos_muestra::text AS "desacuerdosMuestra"
         FROM conteos_condicion_cierre() c`,
    );
    return evaluarCondicionCierre({
      propuestas: Number(f.propuestas),
      empresas: Number(f.empresas),
      meses: Number(f.meses),
      tratadas: Number(f.tratadas),
      desacuerdos: Number(f.desacuerdos),
      verificados: Number(f.verificados),
      desacuerdosMuestra: Number(f.desacuerdosMuestra),
    });
  }
}
