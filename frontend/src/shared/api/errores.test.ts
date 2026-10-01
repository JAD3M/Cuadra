import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError, ContratoError, NetworkError, aApiError } from './errores';

function json(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('aApiError', () => {
  it('normaliza un message de texto a un arreglo de un elemento', async () => {
    const error = await aApiError(
      json(
        {
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Credenciales inválidas',
        },
        401,
      ),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(401);
    expect(error.error).toBe('Unauthorized');
    expect(error.mensajes).toEqual(['Credenciales inválidas']);
    expect(error.message).toBe('Credenciales inválidas');
  });

  it('conserva un message en arreglo, como los fallos de validación', async () => {
    const error = await aApiError(
      json({ statusCode: 400, error: 'Bad Request', message: ['a', 'b'] }, 400),
    );
    expect(error.mensajes).toEqual(['a', 'b']);
    expect(error.message).toBe('a b');
  });

  it('un cuerpo que no es JSON da ApiError con el código HTTP y sin mensajes', async () => {
    const respuesta = new Response('<html>Bad Gateway</html>', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'Content-Type': 'text/html' },
    });
    const error = await aApiError(respuesta);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(502);
    expect(error.error).toBe('Bad Gateway');
    expect(error.mensajes).toEqual([]);
    expect(error.message).toBe('No se pudo completar la solicitud.');
  });

  it('un cuerpo vacío también da ApiError', async () => {
    const error = await aApiError(new Response(null, { status: 500 }));
    expect(error.statusCode).toBe(500);
    expect(error.error).toBe('Error');
    expect(error.mensajes).toEqual([]);
  });

  it('un JSON con otra forma no se toma como cuerpo de Nest', async () => {
    const error = await aApiError(json({ message: 42 }, 500));
    expect(error.statusCode).toBe(500);
    expect(error.mensajes).toEqual([]);
  });
});

describe('tipos de error', () => {
  it('NetworkError no es ApiError y conserva la causa', () => {
    const causa = new TypeError('fetch failed');
    const error = new NetworkError({ cause: causa });
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error.name).toBe('NetworkError');
    expect(error.cause).toBe(causa);
  });

  it('ContratoError guarda el detalle de zod y no es ApiError', () => {
    const resultado = z.object({ a: z.string() }).safeParse({ a: 1 });
    if (resultado.success) throw new Error('debía fallar');
    const error = new ContratoError(resultado.error);
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error.name).toBe('ContratoError');
    expect(error.detalle?.issues.length).toBeGreaterThan(0);
  });
});
