// src/correo/correo.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdaptadorSmtp } from './adaptador-smtp';
import { CorreoSimulado } from './correo-simulado';
import { ProveedorCorreo } from './proveedor-correo';

/** Variables del adaptador real; el esquema de entorno las exige en producción. */
export const VARIABLES_CORREO = [
  'CORREO_SMTP_HOST',
  'CORREO_SMTP_PORT',
  'CORREO_SMTP_USUARIO',
  'CORREO_SMTP_PASSWORD',
  'CORREO_REMITENTE',
] as const;

/**
 * Elige el adaptador: con las cinco variables, SMTP; sin ellas, el simulado.
 * En producción faltar alguna es un error (segunda capa: el esquema de env ya
 * lo rechaza). El mensaje nombra variables, nunca valores.
 */
export function crearProveedorCorreo(config: ConfigService): ProveedorCorreo {
  const faltantes = VARIABLES_CORREO.filter((v) => !config.get(v));
  if (faltantes.length === 0) {
    return new AdaptadorSmtp({
      host: config.getOrThrow<string>('CORREO_SMTP_HOST'),
      port: Number(config.getOrThrow<string | number>('CORREO_SMTP_PORT')),
      usuario: config.getOrThrow<string>('CORREO_SMTP_USUARIO'),
      password: config.getOrThrow<string>('CORREO_SMTP_PASSWORD'),
      remitente: config.getOrThrow<string>('CORREO_REMITENTE'),
    });
  }
  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error(
      `Correo sin configurar en produccion; faltan: ${faltantes.join(', ')}`,
    );
  }
  return new CorreoSimulado();
}

@Global()
@Module({
  providers: [
    {
      provide: ProveedorCorreo,
      inject: [ConfigService],
      useFactory: crearProveedorCorreo,
    },
  ],
  exports: [ProveedorCorreo],
})
export class CorreoModule {}
