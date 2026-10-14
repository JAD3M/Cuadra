import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdaptadorSmtp } from './adaptador-smtp';
import { CorreoSimulado } from './correo-simulado';
import { crearProveedorCorreo } from './correo.module';

const SMTP = {
  CORREO_SMTP_HOST: 'smtp.example',
  CORREO_SMTP_PORT: 587,
  CORREO_SMTP_USUARIO: 'usuario',
  CORREO_SMTP_PASSWORD: 'secreto',
  CORREO_REMITENTE: 'Cuadra <no-responder@cuadra.example>',
};

describe('crearProveedorCorreo (historia 1.5)', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('sin variables de correo: adaptador simulado', () => {
    expect(
      crearProveedorCorreo(new ConfigService({ NODE_ENV: 'development' })),
    ).toBeInstanceOf(CorreoSimulado);
  });

  it('con las variables completas: adaptador SMTP', () => {
    expect(crearProveedorCorreo(new ConfigService(SMTP))).toBeInstanceOf(
      AdaptadorSmtp,
    );
  });

  it('en producción sin variables: lanza nombrando todas las faltantes', () => {
    expect(() =>
      crearProveedorCorreo(new ConfigService({ NODE_ENV: 'production' })),
    ).toThrow(/CORREO_SMTP_HOST[\s\S]*CORREO_REMITENTE/);
  });
});

describe('correo simulado en desarrollo', () => {
  const MENSAJE = {
    para: 'admin@aurora.mx',
    asunto: 'Invitación a Cuadra',
    texto: 'Entra con http://localhost:5173/invitacion/token-de-prueba',
  };
  afterEach(() => jest.restoreAllMocks());

  it('imprime el mensaje, con su enlace, en el log de la API', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const correo = crearProveedorCorreo(
      new ConfigService({ NODE_ENV: 'development' }),
    );
    await correo.enviar(MENSAJE);
    const impreso = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(impreso).toContain('admin@aurora.mx');
    expect(impreso).toContain(
      'http://localhost:5173/invitacion/token-de-prueba',
    );
  });

  it('en pruebas no imprime nada', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const correo = crearProveedorCorreo(
      new ConfigService({ NODE_ENV: 'test' }),
    );
    await correo.enviar(MENSAJE);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('CorreoSimulado', () => {
  it('guarda en memoria lo enviado y se puede leer y vaciar', async () => {
    const correo = new CorreoSimulado();
    await correo.enviar({ para: 'a@x.test', asunto: 'Hola', texto: 'cuerpo' });
    await correo.enviar({ para: 'b@x.test', asunto: 'Dos', texto: 'otro' });
    expect(correo.enviados.map((m) => m.para)).toEqual([
      'a@x.test',
      'b@x.test',
    ]);
    expect(correo.ultimoPara('a@x.test')?.asunto).toBe('Hola');
    correo.limpiar();
    expect(correo.enviados).toHaveLength(0);
  });
});

describe('AdaptadorSmtp', () => {
  it('entrega el mensaje al transporte con el remitente configurado', async () => {
    const enviarCorreo = jest.fn().mockResolvedValue({});
    const adaptador = new AdaptadorSmtp(
      { remitente: SMTP.CORREO_REMITENTE },
      { sendMail: enviarCorreo },
    );
    await adaptador.enviar({ para: 'a@x.test', asunto: 'S', texto: 'T' });
    expect(enviarCorreo).toHaveBeenCalledWith({
      from: SMTP.CORREO_REMITENTE,
      to: 'a@x.test',
      subject: 'S',
      text: 'T',
    });
  });
});
