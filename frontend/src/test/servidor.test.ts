import { describe, expect, it } from 'vitest';
import {
  CONTEXTO_SESION,
  EMPRESAS_DISPONIBLES,
  RESPUESTA_LOGIN,
  RESPUESTA_TOKEN,
} from '@/test/fixtures';

describe('servidor MSW de pruebas', () => {
  it('responde los endpoints de autenticación con los fixtures', async () => {
    const login = await fetch('/api/auth/login', { method: 'POST' });
    expect(await login.json()).toEqual(RESPUESTA_LOGIN);

    const empresas = await fetch('/api/auth/empresas');
    expect(await empresas.json()).toEqual(EMPRESAS_DISPONIBLES);

    const token = await fetch('/api/auth/empresa/abc', { method: 'POST' });
    expect(await token.json()).toEqual(RESPUESTA_TOKEN);

    const contexto = await fetch('/api/auth/contexto');
    expect(await contexto.json()).toEqual(CONTEXTO_SESION);
  });

  it('una petición sin manejador falla en lugar de salir a la red', async () => {
    await expect(fetch('/api/no-existe')).rejects.toThrow();
  });
});
