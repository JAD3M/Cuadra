// src/correo/proveedor-correo.ts

/** Lo que sale por correo: texto plano, sin adjuntos ni HTML. */
export interface MensajeCorreo {
  para: string;
  asunto: string;
  texto: string;
}

/**
 * Puerto de envío de correo (historia 1.5). Clase abstracta que sirve de
 * token de Nest: el módulo enlaza el adaptador (simulado o SMTP) y quien
 * envía no conoce al proveedor. Un fallo de envío lanza; quien llama decide
 * qué hacer con él.
 */
export abstract class ProveedorCorreo {
  abstract enviar(mensaje: MensajeCorreo): Promise<void>;
}
