import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

interface Almacen {
  manager: EntityManager;
  /** Lo que corre solo si la transacción confirma (CU-08: encolar). */
  alConfirmar: Array<() => Promise<void>>;
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

  ejecutar<T>(almacen: Almacen, cuerpo: () => T): T {
    return this.als.run(almacen, cuerpo);
  }

  /**
   * Sin transacción no hay respaldo al pool: la petición truena con 500. Un
   * endpoint de dominio sin empresa es un bug, no un caso a tolerar.
   */
  manager(): EntityManager {
    return this.almacen().manager;
  }

  /**
   * Corre `accion` después del COMMIT, nunca antes ni si hay rollback. Para
   * efectos fuera de la base que no deben adelantarse a los datos: un job
   * encolado antes del commit podría tomarlo el worker y no ver la carga.
   * Si `accion` falla, la petición responde 500 aunque los datos ya estén
   * confirmados.
   */
  alConfirmar(accion: () => Promise<void>): void {
    this.almacen().alConfirmar.push(accion);
  }

  private almacen(): Almacen {
    const almacen = this.als.getStore();
    if (!almacen) {
      throw new Error(
        'Sin transacción de empresa: este endpoint no pasó por TransaccionEmpresaInterceptor',
      );
    }
    return almacen;
  }
}
