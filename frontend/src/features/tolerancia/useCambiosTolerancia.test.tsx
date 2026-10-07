import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ContratoError } from '@/shared/api';
import { extraerCambiosTolerancia } from '@/shared/api/contratos';
import { ACCION_ACTUALIZAR, ENTIDAD_EMPRESA } from '@/shared/dominio';
import { almacenes } from '@/test/handlers';
import { CAMBIOS_RUIDOSOS, idEvento } from '@/test/fixturesTolerancia';
import {
  cambiosFalla,
  cambiosFueraDeContrato,
  valorFalla,
} from '@/test/handlersTolerancia';
import {
  clienteDePruebas,
  envoltura,
  sesionConEpoca,
} from '@/test/montarBandeja';
import { esperarIntervalos } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { clavesTolerancia } from './claves';
import { CAMBIOS_VISIBLES, LIMITE_CONSULTA_CAMBIOS } from './constantes';
import { useCambiosTolerancia } from './useCambiosTolerancia';
import { useTolerancia } from './useTolerancia';

// Permite probar que el hook pasa `CAMBIOS_VISIBLES` de la feature: el
// contrato de shared tiene su propio valor por defecto (shared no importa
// features) y este es el único punto que los mantiene alineados.
const visibles = vi.hoisted(() => ({ valor: null as number | null }));
vi.mock('./constantes', async (importarOriginal) => {
  const real = await importarOriginal<typeof import('./constantes')>();
  return {
    ...real,
    get CAMBIOS_VISIBLES() {
      return visibles.valor ?? real.CAMBIOS_VISIBLES;
    },
  };
});

afterEach(() => {
  visibles.valor = null;
});

const tolerancia = almacenes.tolerancia;

// En CAMBIOS_RUIDOSOS los eventos de tolerancia son los n múltiplos de 5
// (10 en total); el servidor los sirve del más nuevo (n menor) al más antiguo.
const IDS_PRIMEROS_CINCO = [5, 10, 15, 20, 25].map(idEvento);

describe('useCambiosTolerancia', () => {
  it('pide GET /bitacora con exactamente entidad, accion y limite=50', async () => {
    const cliente = clienteDePruebas();
    const { result } = renderHook(() => useCambiosTolerancia(), {
      wrapper: envoltura(cliente),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(tolerancia.peticiones()).toEqual([
      {
        metodo: 'GET',
        ruta: '/api/bitacora',
        consulta: {
          entidad: 'companies',
          accion: 'actualizar',
          limite: '50',
        },
        cuerpo: null,
      },
    ]);
  });

  it('la consulta sale de las constantes del dominio y de la feature', () => {
    expect(ENTIDAD_EMPRESA).toBe('companies');
    expect(ACCION_ACTUALIZAR).toBe('actualizar');
    expect(LIMITE_CONSULTA_CAMBIOS).toBe(50);
  });

  it('filtra el ruido y se queda con los cinco primeros en el orden del servidor', async () => {
    tolerancia.establecerCambios(CAMBIOS_RUIDOSOS);
    const cliente = clienteDePruebas();
    const { result } = renderHook(() => useCambiosTolerancia(), {
      wrapper: envoltura(cliente),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Control: el fixture trae diez eventos de tolerancia, no cinco.
    expect(
      CAMBIOS_RUIDOSOS.filter(
        (e) =>
          (e.datos as { campo?: string } | null)?.campo === 'tolerancia_monto',
      ),
    ).toHaveLength(10);
    expect(result.current.data?.map((c) => c.id)).toEqual(IDS_PRIMEROS_CINCO);
    expect(result.current.data).toHaveLength(CAMBIOS_VISIBLES);
    expect(cliente.getQueryData(clavesTolerancia.cambios(1))).toEqual(
      result.current.data,
    );
  });

  it('con pocos cambios entrega los que haya, sin rellenar', async () => {
    const { result } = renderHook(() => useCambiosTolerancia(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // CAMBIOS_INICIALES: 2 de tolerancia entre 3 de ruido.
    expect(result.current.data).toHaveLength(2);
  });

  it('el recorte lo gobierna CAMBIOS_VISIBLES de la feature, no el valor por defecto del contrato', async () => {
    tolerancia.establecerCambios(CAMBIOS_RUIDOSOS);
    visibles.valor = 3;
    const { result } = renderHook(() => useCambiosTolerancia(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((c) => c.id)).toEqual(
      IDS_PRIMEROS_CINCO.slice(0, 3),
    );
  });

  it('el valor por defecto del contrato coincide con CAMBIOS_VISIBLES', () => {
    const datos = [...CAMBIOS_RUIDOSOS];
    expect(extraerCambiosTolerancia(datos)).toHaveLength(CAMBIOS_VISIBLES);
    expect(extraerCambiosTolerancia(datos)).toEqual(
      extraerCambiosTolerancia(datos, CAMBIOS_VISIBLES),
    );
  });

  it('otra época usa otra clave y vuelve a pedir', async () => {
    const cliente = clienteDePruebas();
    let epoca = 1;
    const { result, rerender } = renderHook(() => useCambiosTolerancia(), {
      wrapper: envoltura(cliente, () => sesionConEpoca(epoca)),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    epoca = 2;
    rerender();
    await waitFor(() =>
      expect(cliente.getQueryData(clavesTolerancia.cambios(2))).toBeDefined(),
    );
    expect(cliente.getQueryData(clavesTolerancia.cambios(1))).toBeDefined();
    expect(tolerancia.peticiones()).toHaveLength(2);
  });

  it('sin sesión lista no pide nada', async () => {
    const { result } = renderHook(() => useCambiosTolerancia(), {
      wrapper: envoltura(clienteDePruebas(), () => ({
        status: 'loading',
        restaurarOrigen: false,
      })),
    });
    await esperarIntervalos();
    expect(result.current.fetchStatus).toBe('idle');
    expect(tolerancia.peticiones()).toHaveLength(0);
  });

  it('un 500 deja el error y data indefinido', async () => {
    servidor.use(cambiosFalla(500));
    const { result } = renderHook(() => useCambiosTolerancia(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ApiError).statusCode).toBe(500);
    expect(result.current.data).toBeUndefined();
  });

  it('un sobre sin el arreglo datos es ContratoError', async () => {
    servidor.use(cambiosFueraDeContrato());
    const { result } = renderHook(() => useCambiosTolerancia(), {
      wrapper: envoltura(clienteDePruebas()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ContratoError);
  });

  describe('independencia del valor (TOL-2.5)', () => {
    function montarAmbos() {
      return renderHook(
        () => ({ valor: useTolerancia(), cambios: useCambiosTolerancia() }),
        { wrapper: envoltura(clienteDePruebas()) },
      );
    }

    it('si falla el valor, los cambios llegan', async () => {
      servidor.use(valorFalla(500));
      const { result } = montarAmbos();
      await waitFor(() => expect(result.current.valor.isError).toBe(true));
      await waitFor(() => expect(result.current.cambios.isSuccess).toBe(true));
      expect(result.current.cambios.data).toHaveLength(2);
    });

    it('si fallan los cambios, el valor llega', async () => {
      servidor.use(cambiosFalla(500));
      const { result } = montarAmbos();
      await waitFor(() => expect(result.current.cambios.isError).toBe(true));
      await waitFor(() => expect(result.current.valor.isSuccess).toBe(true));
      expect(result.current.valor.data).toEqual({ toleranciaMonto: '0.5000' });
    });
  });
});
