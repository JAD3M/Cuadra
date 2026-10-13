import { config as cargarEnv } from 'dotenv';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import { CLIENTE_REDIS, crearClienteRedis } from './cliente-redis';
import { RedisModule } from './redis.module';

cargarEnv({ quiet: true });

/** Contra el Redis del compose; el caso caído apunta a un puerto sin nadie. */

describe('RedisModule', () => {
  it('conecta, responde PING y cierra sin dejar la conexión abierta', async () => {
    const modulo = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), RedisModule],
    }).compile();
    await modulo.init();
    const cliente = modulo.get<Redis>(CLIENTE_REDIS);

    expect(await cliente.ping()).toBe('PONG');

    await modulo.close();
    // El socket termina de cerrarse un instante después de QUIT.
    const limite = Date.now() + 1000;
    while (cliente.status !== 'end' && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(cliente.status).toBe('end');
  });
});

describe('crearClienteRedis con Redis caído', () => {
  it('un comando falla rápido en vez de colgarse', async () => {
    const cliente = crearClienteRedis('redis://127.0.0.1:1', {
      // Tras cortar, ioredis deja vivo un temporizador de `disconnectTimeout`
      // (2 s): corto, para que Jest no lo vea como un handle abierto.
      disconnectTimeout: 100,
    });
    try {
      await cliente.connect().catch(() => undefined);
      const inicio = Date.now();
      await expect(cliente.ping()).rejects.toThrow();
      expect(Date.now() - inicio).toBeLessThan(1500);
    } finally {
      cliente.disconnect();
    }
  });
});
