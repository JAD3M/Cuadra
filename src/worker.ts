import './colas/modo-worker';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Proceso worker (AD-16/AD-17): el mismo código y la misma imagen que la API,
 * sin servidor HTTP. Consume las colas de cargas y de sugerencias; la API solo
 * encola. Apaga limpio con SIGTERM/SIGINT: BullMQ termina el job en curso.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  new Logger('Worker').log('Worker de colas en marcha');
}
void bootstrap();
