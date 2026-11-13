import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BANCOS_PDF_API } from '@/test/fixturesCargas';
import { bancosPdfFalla } from '@/test/handlersCargas';
import { clienteDePruebas } from '@/test/montarBandeja';
import { envolturaCargas } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { clavesCargas } from './claves';
import { useBancosPdf } from './useBancosPdf';

describe('useBancosPdf (historia 8.3)', () => {
  it('pide GET /bancos/pdf y entrega los bancos en el orden de la API', async () => {
    const cliente = clienteDePruebas();
    const { result } = renderHook(() => useBancosPdf(), {
      wrapper: envolturaCargas(cliente),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(BANCOS_PDF_API);
    expect(cliente.getQueryData(clavesCargas.bancosPdf(1))).toEqual(
      BANCOS_PDF_API,
    );
  });

  it('si falla, no hay datos y queda el error para ofrecer Reintentar', async () => {
    servidor.use(bancosPdfFalla(500));
    const { result } = renderHook(() => useBancosPdf(), {
      wrapper: envolturaCargas(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
