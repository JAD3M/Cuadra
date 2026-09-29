import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

/**
 * Una transacción como `cuadra_app` con `app.company_id` fijado (CU-04b).
 * La usan el interceptor de cada petición y el worker de la cola (CU-08),
 * que no pasa por el interceptor.
 */
@Injectable()
export class TransaccionEmpresa {
  constructor(private readonly ds: DataSource) {}

  async ejecutar<T>(
    companyId: string,
    cuerpo: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();
      // Parametrizado y local a la transacción: al COMMIT o ROLLBACK se
      // borra solo, y la conexión vuelve al pool sin empresa.
      await qr.query(`SELECT set_config('app.company_id', $1, true)`, [
        companyId,
      ]);
      const resultado = await cuerpo(qr.manager);
      await qr.commitTransaction();
      return resultado;
    } catch (error) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}
