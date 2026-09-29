import { CERO, type Dinero } from '../common/dinero';

/**
 * De dónde sale la tolerancia de monto de una empresa. El motor recibe el
 * valor ya resuelto; cambiar la fuente (CU-12) es cambiar la clase que el
 * módulo enlaza a este token, sin tocar el motor.
 */
export abstract class ProveedorTolerancia {
  abstract obtener(companyId: string): Promise<Dinero>;
}

/** Hoy: 0 MXN absolutos para todas las empresas. */
export class ToleranciaConstante extends ProveedorTolerancia {
  obtener(): Promise<Dinero> {
    return Promise.resolve(CERO);
  }
}
