import { describe, expect, it } from 'vitest';
import {
  CONTEXTO_SESION,
  CONTEXTO_SESION_B,
  EMPRESAS_DISPONIBLES,
  RESPUESTA_LOGIN,
} from '@/test/fixtures';

describe('servidor MSW de pruebas', () => {
  it('responde los endpoints de autenticación con los fixtures', async () => {
    // Sin sesión el contexto es 401, como el backend.
    expect((await fetch('/api/auth/contexto')).status).toBe(401);

    const login = await fetch('/api/auth/login', { method: 'POST' });
    expect(await login.json()).toEqual(RESPUESTA_LOGIN);
    expect(Object.keys(RESPUESTA_LOGIN)).not.toContain('token');

    const empresas = await fetch('/api/auth/empresas');
    expect(await empresas.json()).toEqual(EMPRESAS_DISPONIBLES);

    // Elegir empresa devuelve el contexto, no un token.
    const [empresaA, empresaB] = EMPRESAS_DISPONIBLES;
    const elegida = await fetch(`/api/auth/empresa/${empresaA!.id}`, {
      method: 'POST',
    });
    expect(await elegida.json()).toEqual(CONTEXTO_SESION);

    const contexto = await fetch('/api/auth/contexto');
    expect(await contexto.json()).toEqual(CONTEXTO_SESION);

    // Con la sesión viva la lista sigue y cambiar reemplaza la empresa.
    expect(await (await fetch('/api/auth/empresas')).json()).toEqual(
      EMPRESAS_DISPONIBLES,
    );
    const cambiada = await fetch(`/api/auth/empresa/${empresaB!.id}`, {
      method: 'POST',
    });
    expect(await cambiada.json()).toEqual(CONTEXTO_SESION_B);
    expect(await (await fetch('/api/auth/contexto')).json()).toEqual(
      CONTEXTO_SESION_B,
    );

    // Una empresa ajena responde 403 y la sesión queda como estaba.
    const ajena = await fetch('/api/auth/empresa/no-es-mia', {
      method: 'POST',
    });
    expect(ajena.status).toBe(403);
    expect(await (await fetch('/api/auth/contexto')).json()).toEqual(
      CONTEXTO_SESION_B,
    );

    // Cerrar la sesión la cancela: el contexto vuelve a ser 401.
    const salida = await fetch('/api/auth/logout', { method: 'POST' });
    expect(salida.status).toBe(204);
    expect((await fetch('/api/auth/contexto')).status).toBe(401);
  });

  it('una petición sin manejador falla en lugar de salir a la red', async () => {
    await expect(fetch('/api/no-existe')).rejects.toThrow();
  });
});
