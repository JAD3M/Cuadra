import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

@Injectable()
export class PasswordHasher {
  async hashear(password: string): Promise<string> {
    const sal = randomBytes(16);
    const derivada = await scryptAsync(password, sal, 64);
    return `scrypt$${sal.toString('base64')}$${derivada.toString('base64')}`;
  }

  async verificar(password: string, guardado: string): Promise<boolean> {
    const [algoritmo, salB64, hashB64] = guardado.split('$');
    if (algoritmo !== 'scrypt' || !salB64 || !hashB64) return false;
    const esperado = Buffer.from(hashB64, 'base64');
    const derivada = await scryptAsync(
      password,
      Buffer.from(salB64, 'base64'),
      esperado.length,
    );
    return timingSafeEqual(esperado, derivada);
  }
}
