import { describe, expect, it } from 'vitest';
import { ApiError, ContratoError, NetworkError } from './errores';
import { crearQueryClient, reintentarConsulta } from './queryClient';

const apiError = (status: number) => new ApiError(status, 'x', []);

describe('reintentarConsulta', () => {
  it.each([400, 401, 403, 404, 422])('no reintenta un %i', (status) => {
    expect(reintentarConsulta(0, apiError(status))).toBe(false);
  });

  it('reintenta un fallo de red hasta dos veces', () => {
    const error = new NetworkError();
    expect(reintentarConsulta(0, error)).toBe(true);
    expect(reintentarConsulta(1, error)).toBe(true);
    expect(reintentarConsulta(2, error)).toBe(false);
  });

  it('reintenta un 5xx hasta dos veces', () => {
    expect(reintentarConsulta(0, apiError(503))).toBe(true);
    expect(reintentarConsulta(2, apiError(503))).toBe(false);
  });

  it('no reintenta un fallo de contrato', () => {
    expect(reintentarConsulta(0, new ContratoError())).toBe(false);
  });
});

describe('crearQueryClient', () => {
  it('no refresca al volver el foco y aplica la política de reintentos', () => {
    const opciones = crearQueryClient().getDefaultOptions();
    expect(opciones.queries?.refetchOnWindowFocus).toBe(false);
    expect(opciones.queries?.retry).toBe(reintentarConsulta);
    expect(opciones.mutations?.retry).toBe(false);
  });

  it('una consulta con 4xx se ejecuta una sola vez', async () => {
    const cliente = crearQueryClient();
    let llamadas = 0;
    await expect(
      cliente.fetchQuery({
        queryKey: ['x'],
        queryFn: () => {
          llamadas += 1;
          return Promise.reject(apiError(404));
        },
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(llamadas).toBe(1);
  });

  it('una consulta con fallo de red se intenta tres veces en total', async () => {
    const cliente = crearQueryClient();
    let llamadas = 0;
    await expect(
      cliente.fetchQuery({
        queryKey: ['y'],
        retry: reintentarConsulta,
        retryDelay: 0,
        queryFn: () => {
          llamadas += 1;
          return Promise.reject(new NetworkError());
        },
      }),
    ).rejects.toBeInstanceOf(NetworkError);
    expect(llamadas).toBe(3);
  });
});
