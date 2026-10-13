import { afterEach, describe, expect, it } from 'vitest';
import {
  CONTEXTO_SESION,
  CONTEXTO_SESION_B,
  EMPRESAS_DISPONIBLES,
  RESPUESTA_LOGIN_UNA_EMPRESA,
} from '@/test/fixtures';
import {
  contextoFalla,
  contextoPorEmpresa,
  contextoRedDeFallo,
  empresasFalla,
  empresasLista,
  espiarSolicitudes,
  loginFalla,
  loginRedDeFallo,
  loginUnaEmpresa,
  seleccionFalla,
} from '@/test/handlersAuth';
import { empresaDeLaSesion } from '@/test/sesionMock';

const IDB = EMPRESAS_DISPONIBLES[1]!.id;
let espia: ReturnType<typeof espiarSolicitudes> | null = null;

afterEach(() => {
  espia?.detener();
  espia = null;
});

describe('handlers de autenticación de pruebas', () => {
  it('loginFalla responde 401 por omisión y el estado pedido si se indica', async () => {
    loginFalla();
    expect((await fetch('/api/auth/login', { method: 'POST' })).status).toBe(
      401,
    );
    loginFalla(403);
    expect((await fetch('/api/auth/login', { method: 'POST' })).status).toBe(
      403,
    );
  });

  it('loginRedDeFallo y contextoRedDeFallo rechazan el fetch', async () => {
    loginRedDeFallo();
    await expect(
      fetch('/api/auth/login', { method: 'POST' }),
    ).rejects.toThrow();
    contextoRedDeFallo();
    await expect(fetch('/api/auth/contexto')).rejects.toThrow();
  });

  it('loginUnaEmpresa entrega una sola empresa', async () => {
    loginUnaEmpresa();
    const cuerpo = await (
      await fetch('/api/auth/login', { method: 'POST' })
    ).json();
    expect(cuerpo).toEqual(RESPUESTA_LOGIN_UNA_EMPRESA);
    expect(cuerpo.empresas).toHaveLength(1);
  });

  it('empresasLista y empresasFalla controlan GET /auth/empresas', async () => {
    empresasLista(EMPRESAS_DISPONIBLES.slice(0, 1));
    expect(await (await fetch('/api/auth/empresas')).json()).toHaveLength(1);
    empresasFalla(500);
    expect((await fetch('/api/auth/empresas')).status).toBe(500);
  });

  it('seleccionFalla y contextoFalla responden el estado pedido sin eco del texto de servidor en la forma', async () => {
    seleccionFalla(403);
    expect(
      (await fetch('/api/auth/empresa/x', { method: 'POST' })).status,
    ).toBe(403);
    contextoFalla(401);
    const respuesta = await fetch('/api/auth/contexto');
    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toMatchObject({ statusCode: 401 });
  });

  it('contextoPorEmpresa distingue la empresa B por la sesión simulada', async () => {
    contextoPorEmpresa(IDB);
    // Sin sesión con empresa, 401.
    expect((await fetch('/api/auth/contexto')).status).toBe(401);
    const elegida = await fetch(`/api/auth/empresa/${IDB}`, { method: 'POST' });
    expect(await elegida.json()).toEqual(CONTEXTO_SESION_B);
    expect(empresaDeLaSesion()).toBe(IDB);
    const deB = await fetch('/api/auth/contexto');
    expect(await deB.json()).toEqual(CONTEXTO_SESION_B);
    await fetch('/api/auth/empresa/otra', { method: 'POST' });
    const deA = await fetch('/api/auth/contexto');
    expect(await deA.json()).toEqual(CONTEXTO_SESION);
  });

  it('espiarSolicitudes cuenta por método y ruta y deja de oír al detenerse', async () => {
    espia = espiarSolicitudes();
    await fetch('/api/auth/contexto', { credentials: 'include' });
    await fetch('/api/auth/contexto');
    await fetch('/api/auth/login', { method: 'POST' });
    expect(espia.cuantas('GET', '/api/auth/contexto')).toBe(2);
    expect(espia.cuantas('POST', '/api/auth/login')).toBe(1);
    expect(espia.solicitudes[0]).toEqual({
      metodo: 'GET',
      ruta: '/api/auth/contexto',
      autorizacion: null,
      credenciales: 'include',
      empresa: null,
    });
    espia.detener();
    await fetch('/api/auth/contexto');
    expect(espia.cuantas('GET', '/api/auth/contexto')).toBe(2);
  });
});
