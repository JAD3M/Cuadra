import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CERO, dinero, type Dinero } from '../common/dinero';

/**
 * De dónde sale la tolerancia de monto de una empresa. El motor recibe el
 * valor ya resuelto; cambiar la fuente es cambiar la clase que el módulo
 * enlaza a este token, sin tocar el motor.
 */
export abstract class ProveedorTolerancia {
  abstract obtener(companyId: string): Promise<Dinero>;
}

/** 0 MXN para todas las empresas. Ya no se enlaza; sirve de doble en pruebas. */
export class ToleranciaConstante extends ProveedorTolerancia {
  obtener(): Promise<Dinero> {
    return Promise.resolve(CERO);
  }
}

/**
 * CU-12. La tolerancia que cada empresa configuró en
 * `companies.tolerancia_monto` (MXN absolutos, estricta por omisión).
 *
 * Lee con el `DataSource` de la app (`cuadra_app`) en su propia conexión, no
 * con el manager de la transacción de `conciliar`: así el token y la firma
 * no cambian. `companies` no tiene RLS, por eso la consulta filtra por id
 * explícitamente y solo ve el valor confirmado. Si la empresa no existe,
 * cae a 0: lo más estricto.
 */
@Injectable()
export class ToleranciaPorEmpresa extends ProveedorTolerancia {
  constructor(private readonly ds: DataSource) {
    super();
  }

  async obtener(companyId: string): Promise<Dinero> {
    const filas = await this.ds.query<{ tolerancia: string }[]>(
      `SELECT tolerancia_monto::text AS tolerancia FROM companies WHERE id = $1`,
      [companyId],
    );
    return filas.length === 0 ? CERO : dinero(filas[0].tolerancia);
  }
}
