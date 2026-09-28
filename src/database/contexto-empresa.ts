import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

interface Almacen {
  manager: EntityManager;
}

/**
 * El EntityManager de la transacción de la petición, con `app.company_id`
 * ya fijado (CU-04b). Lo abre `TransaccionEmpresaInterceptor`; los handlers
 * de dominio lo piden aquí en vez de usar el `DataSource` global, que no
 * tiene empresa fijada y por RLS no ve nada.
 */
@Injectable()
export class ContextoEmpresa {
  private readonly als = new AsyncLocalStorage<Almacen>();

  ejecutar<T>(manager: EntityManager, cuerpo: () => T): T {
    return this.als.run({ manager }, cuerpo);
  }

  /**
   * Sin transacción no hay respaldo al pool: la petición truena con 500. Un
   * endpoint de dominio sin empresa es un bug, no un caso a tolerar.
   */
  manager(): EntityManager {
    const almacen = this.als.getStore();
    if (!almacen) {
      throw new Error(
        'Sin transacción de empresa: este endpoint no pasó por TransaccionEmpresaInterceptor',
      );
    }
    return almacen.manager;
  }
}
