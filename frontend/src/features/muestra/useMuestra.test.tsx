import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { casoMuestra, conAvance } from '@/test/handlersMuestra';
import { clienteDePruebas, envoltura } from '@/test/montarBandeja';
import { servidor } from '@/test/servidor';
import { clavesMuestra } from './claves';
import { useMuestra } from './useMuestra';

const MUESTRA = conAvance({
  mes: '2026-09',
  meses: ['2026-09'],
  sinRevisor: false,
  puedeVerificar: true,
  casos: [casoMuestra(1)],
});

describe('useMuestra (historia 9.4)', () => {
  it('sin mes pide GET /muestra y entrega los montos como texto', async () => {
    const pedidas: string[] = [];
    servidor.use(
      http.get('/api/muestra', ({ request }) => {
        pedidas.push(new URL(request.url).search);
        return HttpResponse.json(MUESTRA);
      }),
    );
    const cliente = clienteDePruebas();
    const { result } = renderHook(() => useMuestra(null), {
      wrapper: envoltura(cliente),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pedidas).toEqual(['']);
    expect(result.current.data?.casos[0]?.monto).toBe('18560.4000');
    expect(cliente.getQueryData(clavesMuestra.lectura(1, null))).toEqual(
      MUESTRA,
    );
  });

  it('con mes lo manda como ?mes=AAAA-MM', async () => {
    const pedidas: string[] = [];
    servidor.use(
      http.get('/api/muestra', ({ request }) => {
        pedidas.push(new URL(request.url).search);
        return HttpResponse.json(MUESTRA);
      }),
    );
    const { result } = renderHook(() => useMuestra('2026-08'), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pedidas).toEqual(['?mes=2026-08']);
  });

  it('un cuerpo fuera de contrato es un error, no datos', async () => {
    servidor.use(
      http.get('/api/muestra', () =>
        HttpResponse.json({
          ...MUESTRA,
          casos: [{ ...MUESTRA.casos[0], monto: 18560.4 }],
        }),
      ),
    );
    const { result } = renderHook(() => useMuestra(null), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('un 403 deja el error y deshabilitado no pide nada', async () => {
    let pedidas = 0;
    servidor.use(
      http.get('/api/muestra', () => {
        pedidas++;
        return HttpResponse.json(
          { statusCode: 403, message: 'x' },
          { status: 403 },
        );
      }),
    );
    const apagado = renderHook(() => useMuestra(null, false), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(pedidas).toBe(0);
    expect(apagado.result.current.fetchStatus).toBe('idle');
    const { result } = renderHook(() => useMuestra(null), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
