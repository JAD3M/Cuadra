import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { clienteDePruebas, sesionConEpoca } from '@/test/montarBandeja';
import { envolturaCargas } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import {
  ID_CARGA,
  leerVistaPrevia,
  leerVistaPreviaFalla,
  vistaPrevia,
} from './pruebas';
import { useVistaPrevia } from './useVistaPrevia';

function montar(epoca: number | null = 1) {
  return renderHook(() => useVistaPrevia(ID_CARGA), {
    wrapper: envolturaCargas(clienteDePruebas(), () =>
      epoca === null
        ? ({ status: 'anonymous' } as const)
        : sesionConEpoca(epoca),
    ),
  });
}

describe('useVistaPrevia', () => {
  it('lee la vista previa con los montos como cadenas exactas', async () => {
    servidor.use(
      leerVistaPrevia(vistaPrevia({ saldoFinal: '9007199254740993.1200' })),
    );
    const { result } = montar();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.saldoFinal).toBe('9007199254740993.1200');
    expect(result.current.data?.movimientos).toHaveLength(3);
  });

  it('un 404 llega como ApiError y no se reintenta', async () => {
    servidor.use(leerVistaPreviaFalla(404));
    const { result } = montar();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).statusCode).toBe(404);
  });

  it('sin sesión lista no pide nada', async () => {
    servidor.use(leerVistaPrevia());
    const { result } = montar(null);
    expect(result.current.fetchStatus).toBe('idle');
  });
});
