// src/correo/correo-simulado.ts
import { type MensajeCorreo, ProveedorCorreo } from './proveedor-correo';

/**
 * Adaptador simulado: no sale nada de la máquina. Guarda en memoria cada
 * mensaje para que las pruebas lo lean; en desarrollo no necesita variables.
 */
export class CorreoSimulado extends ProveedorCorreo {
  readonly enviados: MensajeCorreo[] = [];

  enviar(mensaje: MensajeCorreo): Promise<void> {
    this.enviados.push({ ...mensaje });
    return Promise.resolve();
  }

  /** El último mensaje dirigido a `para`, o undefined. */
  ultimoPara(para: string): MensajeCorreo | undefined {
    return [...this.enviados].reverse().find((m) => m.para === para);
  }

  limpiar(): void {
    this.enviados.length = 0;
  }
}
