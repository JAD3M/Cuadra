import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import { interpretarTrustProxy } from './config/env.validation';

/**
 * Lo que toda instancia de la API necesita antes de escuchar. Lo usan
 * `main.ts` y los helpers de los specs de integración, para que las pruebas
 * vean lo mismo que producción.
 *
 * Swagger y el puerto quedan en `main.ts`: no cambian el comportamiento de
 * las rutas.
 */
export function configurarApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  // La IP real del cliente (`req.ip`) solo se toma de X-Forwarded-For si
  // alguien lo declara: sin proxy de confianza cualquiera podría falsearla.
  const express = app.getHttpAdapter().getInstance() as Express;
  express.set(
    'trust proxy',
    interpretarTrustProxy(config.get<unknown>('TRUST_PROXY')),
  );

  // La sesión viaja en la cookie `cuadra_sesion` (AD-6).
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS con el origen exacto y credenciales (AD-6). Nunca `*` ni el origen
  // reflejado: la función solo concede la cabecera cuando coincide, y a
  // cualquier otro origen no le responde ninguna cabecera CORS.
  const autorizado = config.getOrThrow<string>('ORIGEN_AUTORIZADO');
  app.enableCors({
    origin: (
      origen: string | undefined,
      devolver: (error: Error | null, permitido?: string | false) => void,
    ) => devolver(null, origen === autorizado ? autorizado : false),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Accept'],
  });
}
