// src/correo/adaptador-smtp.ts
import { createTransport } from 'nodemailer';
import { type MensajeCorreo, ProveedorCorreo } from './proveedor-correo';

export interface OpcionesSmtp {
  host: string;
  port: number;
  usuario: string;
  password: string;
  remitente: string;
}

/** Lo único que el adaptador usa del transporte de nodemailer. */
export interface TransporteCorreo {
  sendMail(mensaje: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<unknown>;
}

/** Adaptador real por SMTP. Nunca registra credenciales ni el cuerpo. */
export class AdaptadorSmtp extends ProveedorCorreo {
  private readonly transporte: TransporteCorreo;
  private readonly remitente: string;

  constructor(
    opciones: Pick<OpcionesSmtp, 'remitente'> & Partial<OpcionesSmtp>,
    transporte?: TransporteCorreo,
  ) {
    super();
    this.remitente = opciones.remitente;
    this.transporte =
      transporte ??
      createTransport({
        host: opciones.host,
        port: opciones.port,
        secure: opciones.port === 465,
        auth: { user: opciones.usuario, pass: opciones.password },
      });
  }

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    await this.transporte.sendMail({
      from: this.remitente,
      to: mensaje.para,
      subject: mensaje.asunto,
      text: mensaje.texto,
    });
  }
}
