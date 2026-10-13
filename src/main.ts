import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // La sesión viaja en la cookie `cuadra_sesion` (AD-6).
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const config = app.get(ConfigService);
  // La documentación describe el contrato y los ejemplos del seed: fuera de
  // producción nada más.
  if (config.get('NODE_ENV') !== 'production') {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Cuadra API')
        .setVersion('0.0.1')
        .addCookieAuth('cuadra_sesion')
        .build(),
    );
    SwaggerModule.setup('docs', app, documento);
  }
  // Number() da NaN, no null, si falta: `||` es lo que sí cae al 3000.
  const port = Number(config.get('PORT')) || 3000;
  await app.listen(port);
}
void bootstrap();
