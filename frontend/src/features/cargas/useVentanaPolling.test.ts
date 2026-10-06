import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEstadoVentana, useVigilarVentana } from './useVentanaPolling';

// Las dos mitades del hook juntas, como las usa `usePollingCargas`: el estado
// primero (lo leen las consultas) y la vigilancia después (necesita `activo`,
// que sale de ellas).
function useVentana(activo: boolean, topeMs: number) {
  const estado = useEstadoVentana();
  useVigilarVentana(estado, activo, topeMs);
  return estado;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useVentanaPolling', () => {
  it('el id de ventana sube cada vez que lo activo pasa de false a true', () => {
    const { result, rerender } = renderHook(
      ({ activo }) => useVentana(activo, 60_000),
      { initialProps: { activo: false } },
    );
    expect(result.current.ventana).toBe(0);
    rerender({ activo: true });
    expect(result.current.ventana).toBe(1);
    rerender({ activo: true });
    expect(result.current.ventana).toBe(1);
    rerender({ activo: false });
    expect(result.current.ventana).toBe(1);
    rerender({ activo: true });
    expect(result.current.ventana).toBe(2);
  });

  it('montar con algo activo abre la primera ventana', () => {
    const { result } = renderHook(() => useVentana(true, 60_000));
    expect(result.current.ventana).toBe(1);
    expect(result.current.capada).toBe(false);
  });

  it('iniciar() abre otra ventana (subida correcta o Actualizar)', () => {
    const { result } = renderHook(() => useVentana(true, 60_000));
    act(() => {
      result.current.iniciar();
    });
    expect(result.current.ventana).toBe(2);
  });

  it('el tope capa la ventana una vez y iniciar() la reabre', async () => {
    const { result } = renderHook(() => useVentana(true, 40));
    expect(result.current.capada).toBe(false);
    await waitFor(() => expect(result.current.capada).toBe(true));
    const ventanaCapada = result.current.ventana;
    act(() => {
      result.current.iniciar();
    });
    expect(result.current.ventana).toBe(ventanaCapada + 1);
    expect(result.current.capada).toBe(false);
    await waitFor(() => expect(result.current.capada).toBe(true));
  });

  it('sin nada activo no hay tope que armar', () => {
    const armar = vi.spyOn(globalThis, 'setTimeout');
    const { result } = renderHook(() => useVentana(false, 4_321));
    expect(result.current.capada).toBe(false);
    expect(armar.mock.calls.filter(([, ms]) => ms === 4_321)).toHaveLength(0);
  });

  it('al desmontar o quedar inactivo cancela el temporizador', () => {
    const armar = vi.spyOn(globalThis, 'setTimeout');
    const cancelar = vi.spyOn(globalThis, 'clearTimeout');
    const { rerender, unmount } = renderHook(
      ({ activo }) => useVentana(activo, 4_321),
      { initialProps: { activo: true } },
    );
    const propios = () =>
      armar.mock.results
        .filter((_, i) => armar.mock.calls[i]?.[1] === 4_321)
        .map((r) => r.value as unknown);
    expect(propios()).toHaveLength(1);
    rerender({ activo: false });
    expect(cancelar).toHaveBeenCalledWith(propios()[0]);
    rerender({ activo: true });
    expect(propios()).toHaveLength(2);
    unmount();
    expect(cancelar).toHaveBeenCalledWith(propios()[1]);
  });
});
