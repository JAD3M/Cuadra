import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PERFILES } from '@/test/fixturesCargas';
import { espiarSolicitudes } from '@/test/handlersAuth';
import { perfilesFalla } from '@/test/handlersCargas';
import { clienteDePruebas, sesionConEpoca } from '@/test/montarBandeja';
import { esperar, envolturaCargas } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { clavesCargas } from './claves';
import { VIGENCIA_PERFILES_MS } from './constantes';
import { usePerfiles } from './usePerfiles';

describe('usePerfiles', () => {
  it('pide GET /bancos/perfiles y entrega los perfiles en el orden de la API', async () => {
    const cliente = clienteDePruebas();
    const { result } = renderHook(() => usePerfiles(), {
      wrapper: envolturaCargas(cliente),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(PERFILES);
    expect(cliente.getQueryData(clavesCargas.perfiles(1))).toEqual(PERFILES);
  });

  it('es estática: vigente 5 minutos y un segundo montaje no repite la petición', async () => {
    const cliente = clienteDePruebas();
    const espia = espiarSolicitudes();
    const primero = renderHook(() => usePerfiles(), {
      wrapper: envolturaCargas(cliente),
    });
    await waitFor(() => expect(primero.result.current.isSuccess).toBe(true));
    const consulta = cliente.getQueryCache().find({
      queryKey: clavesCargas.perfiles(1),
    });
    expect(consulta?.observers[0]?.options.staleTime).toBe(
      VIGENCIA_PERFILES_MS,
    );
    const segundo = renderHook(() => usePerfiles(), {
      wrapper: envolturaCargas(cliente),
    });
    await esperar(30);
    expect(segundo.result.current.data).toEqual(PERFILES);
    expect(espia.cuantas('GET', '/api/bancos/perfiles')).toBe(1);
    espia.detener();
  });

  it('otra época usa otra clave y vuelve a pedir', async () => {
    const cliente = clienteDePruebas();
    const espia = espiarSolicitudes();
    let epoca = 1;
    const { result, rerender } = renderHook(() => usePerfiles(), {
      wrapper: envolturaCargas(cliente, () => sesionConEpoca(epoca)),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    epoca = 2;
    rerender();
    await waitFor(() =>
      expect(cliente.getQueryData(clavesCargas.perfiles(2))).toEqual(PERFILES),
    );
    expect(espia.cuantas('GET', '/api/bancos/perfiles')).toBe(2);
    espia.detener();
  });

  it('si falla, data queda indefinido (el campo se oculta y no se manda perfil)', async () => {
    servidor.use(perfilesFalla(500));
    const { result } = renderHook(() => usePerfiles(), {
      wrapper: envolturaCargas(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('sin sesión lista no pide nada', async () => {
    const espia = espiarSolicitudes();
    const { result } = renderHook(() => usePerfiles(), {
      wrapper: envolturaCargas(clienteDePruebas(), () => ({
        status: 'loading',
        restaurarOrigen: false,
      })),
    });
    await esperar(30);
    expect(result.current.fetchStatus).toBe('idle');
    expect(espia.solicitudes).toHaveLength(0);
    espia.detener();
  });
});
