import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { configurarApp } from './configurar-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configurarApp(app);
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
