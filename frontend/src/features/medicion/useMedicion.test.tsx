import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { clienteDePruebas } from '@/test/montarBandeja';
import { envolturaCargas } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { clavesMedicion } from './claves';
import { useMedicion } from './useMedicion';

const TASA = { propuestas: 240, tratadas: 200, desacuerdos: 8, tasa: '0.0400' };

describe('useMedicion (historia 9.1)', () => {
  it('pide GET /medicion/desacuerdo y entrega la tasa tal como llega', async () => {
    servidor.use(
      http.get('/api/medicion/desacuerdo', () => HttpResponse.json(TASA)),
    );
    const cliente = clienteDePruebas();
    const { result } = renderHook(() => useMedicion(), {
      wrapper: envolturaCargas(cliente),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(TASA);
    expect(cliente.getQueryData(clavesMedicion.desacuerdo(1))).toEqual(TASA);
  });

  it('un cuerpo fuera de contrato es un error, no datos', async () => {
    servidor.use(
      http.get('/api/medicion/desacuerdo', () =>
        HttpResponse.json({ ...TASA, tasa: 0.04 }),
      ),
    );
    const { result } = renderHook(() => useMedicion(), {
      wrapper: envolturaCargas(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('un 500 deja el error para ofrecer Reintentar', async () => {
    servidor.use(
      http.get('/api/medicion/desacuerdo', () =>
        HttpResponse.json({ statusCode: 500, message: 'x' }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useMedicion(), {
      wrapper: envolturaCargas(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
