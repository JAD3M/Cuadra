// @vitest-environment node
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { RAIZ_FRONTEND } from '../css/leerTokens';

// AD-6: la sesión viaja en una cookie `httpOnly` y en desarrollo el
// navegador solo habla con Vite (mismo origen). El proxy debe dejar pasar el
// `Set-Cookie` de la API y la `Cookie` del navegador sin tocarlos.
//
// Se ejecuta en un proceso aparte: el servidor MSW de las pruebas intercepta
// todo `http` del proceso y fallaría ante un servidor local real.

const COOKIE = 'cuadra_sesion=abc; Path=/; HttpOnly; Secure; SameSite=Lax';

const GUION = `
import { createServer as http } from 'node:http';
import { createServer as vite } from 'vite';
import { construirProxy } from ${JSON.stringify(
  path.join(RAIZ_FRONTEND, 'config', 'proxy.ts'),
)};

let cookieRecibida;
const api = http((solicitud, respuesta) => {
  cookieRecibida = solicitud.headers.cookie;
  respuesta.setHeader('Set-Cookie', ${JSON.stringify(COOKIE)});
  respuesta.setHeader('Content-Type', 'application/json');
  respuesta.end(JSON.stringify({ ruta: solicitud.url }));
});
await new Promise((r) => api.listen(0, '127.0.0.1', r));
const servidor = await vite({
  configFile: false,
  logLevel: 'silent',
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: {
    port: 0,
    host: '127.0.0.1',
    proxy: construirProxy({ API_TARGET: 'http://127.0.0.1:' + api.address().port }),
  },
});
await servidor.listen();
const base = 'http://127.0.0.1:' + servidor.httpServer.address().port;
const respuesta = await fetch(base + '/api/auth/login', {
  method: 'POST',
  headers: { Cookie: 'cuadra_sesion=abc' },
});
const cuerpo = await respuesta.json();
console.log(JSON.stringify({
  cuerpo,
  setCookie: respuesta.headers.getSetCookie(),
  cookieRecibida,
}));
await servidor.close();
api.close();
`;

describe('proxy de desarrollo y la cookie de sesión', () => {
  it('reenvía el Set-Cookie de la API y la Cookie del navegador sin tocarlos', async () => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ['--input-type=module', '--eval', GUION],
      { cwd: RAIZ_FRONTEND, timeout: 20_000 },
    );
    const resultado = JSON.parse(stdout.trim().split('\n').at(-1) ?? '{}');
    expect(resultado).toEqual({
      cuerpo: { ruta: '/auth/login' },
      setCookie: [COOKIE],
      cookieRecibida: 'cuadra_sesion=abc',
    });
  });
});
