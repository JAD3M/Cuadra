import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clavesBandeja } from '@/features/bandeja/claves';
import { clavesCaso } from '@/features/caso/claves';
import { ApiError, ContratoError, NetworkError } from '@/shared/api';
import type { SessionState } from '@/shared/sesion';
import { almacenes } from '@/test/handlers';
import { crearCompuerta } from '@/test/compuerta';
import {
  guardarFalla,
  guardarFueraDeContrato,
  guardarRedDeFallo,
} from '@/test/handlersTolerancia';
import {
  clienteDePruebas,
  envoltura,
  sesionConEpoca,
} from '@/test/montarBandeja';
import { esperarIntervalos } from '@/test/montarCargas';
import { servidor } from '@/test/servidor';
import { clavesTolerancia } from './claves';
import { useCambiosTolerancia } from './useCambiosTolerancia';
import { useGuardarTolerancia } from './useGuardarTolerancia';
import { useTolerancia } from './useTolerancia';

afterEach(() => {
  vi.restoreAllMocks();
  retenidas = 0;
});

const tolerancia = almacenes.tolerancia;
const SIN_SESION: SessionState = { status: 'loading', restaurarOrigen: false };

const lecturasDelValor = () =>
  tolerancia
    .peticiones()
    .filter((p) => p.metodo === 'GET' && p.ruta === '/api/empresa/tolerancia');
const lecturasDeCambios = () =>
  tolerancia.peticiones().filter((p) => p.ruta === '/api/bitacora');
const guardados = () =>
  tolerancia.peticiones().filter((p) => p.metodo === 'PUT');

/** PUT que llegaron a un manejador de `guardarRetenido` (no pasan por el registro del almacén). */
let retenidas = 0;

/** Respuesta del PUT retenida hasta abrir la compuerta, con el cuerpo dado. */
function guardarRetenido(
  espera: Promise<void>,
  responder: () => Response = () =>
    HttpResponse.json({ toleranciaMonto: '9.0000' }),
) {
  return http.put('/api/empresa/tolerancia', async () => {
    retenidas += 1;
    await espera;
    return responder();
  });
}

const CASO = { toleranciaMonto: '0.5000' };

function montar(estado: () => SessionState = () => sesionConEpoca(1)) {
  const cliente = clienteDePruebas();
  const invalidar = vi.spyOn(cliente, 'invalidateQueries');
  const alExito = vi.fn();
  const alFallar = vi.fn();
  // Detalles de caso en caché (sin observador: solo se marcan como viejos) y
  // una consulta de la bandeja, para comprobar qué se invalida y qué no.
  cliente.setQueryData(clavesCaso.detalle(1, 'm1'), CASO);
  cliente.setQueryData(clavesCaso.detalle(2, 'm1'), CASO);
  cliente.setQueryData(clavesBandeja.resumen(1), { listo: true });
  const hook = renderHook(
    () => ({
      guardado: useGuardarTolerancia(),
      valor: useTolerancia(),
      cambios: useCambiosTolerancia(),
    }),
    { wrapper: envoltura(cliente, estado) },
  );
  const guardar = (valor: string) =>
    hook.result.current.guardado.guardar(valor, {
      onSuccess: alExito,
      onError: alFallar,
    });
  const invalidado = (clave: readonly unknown[]) =>
    cliente.getQueryState(clave)?.isInvalidated ?? false;
  return {
    cliente,
    invalidar,
    alExito,
    alFallar,
    guardar,
    invalidado,
    ...hook,
  };
}

/** Espera a que las dos lecturas iniciales hayan llegado. */
async function listo(m: ReturnType<typeof montar>) {
  await waitFor(() => expect(m.result.current.valor.isSuccess).toBe(true));
  await waitFor(() => expect(m.result.current.cambios.isSuccess).toBe(true));
}

describe('useGuardarTolerancia', () => {
  describe('éxito', () => {
    it('manda el valor como CADENA JSON, tal como se escribió', async () => {
      const m = montar();
      await listo(m);
      act(() => {
        m.guardar('0.0050');
      });
      await waitFor(() => expect(m.alExito).toHaveBeenCalledTimes(1));
      expect(guardados()).toEqual([
        {
          metodo: 'PUT',
          ruta: '/api/empresa/tolerancia',
          consulta: {},
          cuerpo: { toleranciaMonto: '0.0050' },
        },
      ]);
      expect(
        typeof (guardados()[0]?.cuerpo as { toleranciaMonto: unknown })
          .toleranciaMonto,
      ).toBe('string');
    });

    it('deja en la caché el valor de la RESPUESTA ("0.5" escrito -> "0.5000")', async () => {
      const m = montar();
      await listo(m);
      tolerancia.establecer('0.7500');
      act(() => {
        m.guardar('0.5');
      });
      await waitFor(() => expect(m.alExito).toHaveBeenCalledTimes(1));
      expect(m.alExito.mock.calls[0]?.[0]).toEqual({
        toleranciaMonto: '0.5000',
      });
      expect(m.cliente.getQueryData(clavesTolerancia.valor(1))).toEqual({
        toleranciaMonto: '0.5000',
      });
      expect(m.result.current.valor.data).toEqual({
        toleranciaMonto: '0.5000',
      });
    });

    it('no vuelve a pedir el valor: la respuesta del PUT lo alimenta', async () => {
      const m = montar();
      await listo(m);
      act(() => {
        m.guardar('0.75');
      });
      await waitFor(() => expect(m.alExito).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(m.result.current.cambios.data?.[0]?.datos.despues).toBe(
          '0.7500',
        ),
      );
      expect(m.result.current.valor.data).toEqual({
        toleranciaMonto: '0.7500',
      });
      await esperarIntervalos();
      expect(lecturasDelValor()).toHaveLength(1);
    });

    it('invalida los cambios y el nuevo cambio llega primero (TOL-9.2)', async () => {
      const m = montar();
      await listo(m);
      expect(lecturasDeCambios()).toHaveLength(1);
      act(() => {
        m.guardar('0.75');
      });
      await waitFor(() => expect(m.alExito).toHaveBeenCalledTimes(1));
      expect(m.invalidar).toHaveBeenCalledWith({
        queryKey: clavesTolerancia.cambios(1),
      });
      await waitFor(() =>
        expect(m.result.current.cambios.data?.[0]?.datos).toMatchObject({
          antes: '0.5000',
          despues: '0.7500',
        }),
      );
      expect(lecturasDeCambios()).toHaveLength(2);
    });

    it('invalida los casos de SU época y no los de otra (CAS-TOL-1.1/1.2)', async () => {
      const m = montar();
      await listo(m);
      expect(m.invalidado(clavesCaso.detalle(1, 'm1'))).toBe(false);
      act(() => {
        m.guardar('0.75');
      });
      await waitFor(() => expect(m.alExito).toHaveBeenCalledTimes(1));
      expect(m.invalidar).toHaveBeenCalledWith({
        queryKey: clavesCaso.todas(1),
      });
      expect(m.invalidado(clavesCaso.detalle(1, 'm1'))).toBe(true);
      expect(m.invalidado(clavesCaso.detalle(2, 'm1'))).toBe(false);
    });

    it('nunca toca la bandeja (TOL-9.8)', async () => {
      const m = montar();
      await listo(m);
      act(() => {
        m.guardar('0.75');
      });
      await waitFor(() => expect(m.alExito).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(m.invalidado(clavesCaso.detalle(1, 'm1'))).toBe(true),
      );
      expect(m.invalidado(clavesBandeja.resumen(1))).toBe(false);
      for (const [filtro] of m.invalidar.mock.calls) {
        expect(filtro?.queryKey?.[0]).not.toBe('bandeja');
      }
    });

    it('un GET del valor en vuelo no pisa lo guardado: el PUT lo cancela', async () => {
      const lectura = crearCompuerta();
      tolerancia.compuertas({ valor: lectura.promesa });
      const m = montar();
      await waitFor(() => expect(lecturasDelValor()).toHaveLength(1));
      act(() => {
        m.guardar('0.75');
      });
      await waitFor(() => expect(m.alExito).toHaveBeenCalledTimes(1));
      expect(m.cliente.getQueryData(clavesTolerancia.valor(1))).toEqual({
        toleranciaMonto: '0.7500',
      });
      // La lectura vieja contestaría "0.5000" (o "0.7500" si el servidor ya
      // cambió); el valor es el de la respuesta del PUT en cualquier caso, y
      // la lectura cancelada no vuelve a escribir.
      tolerancia.establecer('0.5000');
      lectura.abrir();
      await esperarIntervalos();
      expect(m.cliente.getQueryData(clavesTolerancia.valor(1))).toEqual({
        toleranciaMonto: '0.7500',
      });
    });
  });

  describe('guarda contra el doble envío (TOL-9.6)', () => {
    it('dos guardar síncronos mandan una sola petición y el segundo devuelve false', async () => {
      const compuerta = crearCompuerta();
      tolerancia.compuertas({ guardar: compuerta.promesa });
      const m = montar();
      await listo(m);
      let primero = false;
      let segundo = true;
      act(() => {
        primero = m.guardar('0.75');
        segundo = m.guardar('0.75');
      });
      expect(primero).toBe(true);
      expect(segundo).toBe(false);
      await waitFor(() => expect(guardados()).toHaveLength(1));
      compuerta.abrir();
      await waitFor(() => expect(m.alExito).toHaveBeenCalledTimes(1));
      expect(guardados()).toHaveLength(1);
      expect(m.result.current.guardado.isPending).toBe(false);
    });

    it('tras un fallo la guarda se libera y se puede reintentar', async () => {
      servidor.use(guardarFalla(500));
      const m = montar();
      await listo(m);
      act(() => {
        m.guardar('0.75');
      });
      await waitFor(() => expect(m.alFallar).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(m.result.current.guardado.isPending).toBe(false),
      );
      let otraVez = false;
      act(() => {
        otraVez = m.guardar('0.75');
      });
      expect(otraVez).toBe(true);
      await waitFor(() => expect(m.alFallar).toHaveBeenCalledTimes(2));
    });

    it('guardar devuelve false si la sesión no está lista y no envía nada', async () => {
      const m = montar(() => SIN_SESION);
      let enviado = true;
      act(() => {
        enviado = m.guardar('0.75');
      });
      expect(enviado).toBe(false);
      await esperarIntervalos();
      expect(guardados()).toHaveLength(0);
      expect(m.result.current.guardado.isPending).toBe(false);
    });
  });

  describe('fallos', () => {
    it.each([400, 403, 500])(
      'un %i llega a onError con su estado y no invalida nada (CAS-TOL-1.3)',
      async (status) => {
        servidor.use(guardarFalla(status, ['toleranciaMonto no es válido']));
        const m = montar();
        await listo(m);
        m.invalidar.mockClear();
        act(() => {
          m.guardar('0.75');
        });
        await waitFor(() => expect(m.alFallar).toHaveBeenCalledTimes(1));
        const error = m.alFallar.mock.calls[0]?.[0] as ApiError;
        expect(error).toBeInstanceOf(ApiError);
        expect(error.statusCode).toBe(status);
        expect(m.alExito).not.toHaveBeenCalled();
        expect(m.invalidar).not.toHaveBeenCalled();
        expect(m.invalidado(clavesCaso.detalle(1, 'm1'))).toBe(false);
        // El valor en caché sigue siendo el de antes.
        expect(m.cliente.getQueryData(clavesTolerancia.valor(1))).toEqual({
          toleranciaMonto: '0.5000',
        });
        // Y los cambios no se volvieron a pedir.
        await esperarIntervalos();
        expect(lecturasDeCambios()).toHaveLength(1);
      },
    );

    it('un 401 llega a onError y no invalida nada (la sesión lo atiende)', async () => {
      servidor.use(guardarFalla(401));
      const m = montar();
      await listo(m);
      m.invalidar.mockClear();
      act(() => {
        m.guardar('0.75');
      });
      await waitFor(() => expect(m.alFallar).toHaveBeenCalledTimes(1));
      expect((m.alFallar.mock.calls[0]?.[0] as ApiError).statusCode).toBe(401);
      expect(m.invalidar).not.toHaveBeenCalled();
    });

    it('un fallo de red llega como NetworkError y no invalida nada', async () => {
      servidor.use(guardarRedDeFallo());
      const m = montar();
      await listo(m);
      m.invalidar.mockClear();
      act(() => {
        m.guardar('0.75');
      });
      await waitFor(() => expect(m.alFallar).toHaveBeenCalledTimes(1));
      expect(m.alFallar.mock.calls[0]?.[0]).toBeInstanceOf(NetworkError);
      expect(m.invalidar).not.toHaveBeenCalled();
    });

    it('un 2xx ilegible es ContratoError e invalida valor, cambios y casos para decir la verdad', async () => {
      servidor.use(guardarFueraDeContrato());
      const m = montar();
      await listo(m);
      m.invalidar.mockClear();
      act(() => {
        m.guardar('0.75');
      });
      await waitFor(() => expect(m.alFallar).toHaveBeenCalledTimes(1));
      expect(m.alFallar.mock.calls[0]?.[0]).toBeInstanceOf(ContratoError);
      expect(m.invalidar).toHaveBeenCalledWith({
        queryKey: clavesTolerancia.valor(1),
      });
      expect(m.invalidar).toHaveBeenCalledWith({
        queryKey: clavesTolerancia.cambios(1),
      });
      expect(m.invalidar).toHaveBeenCalledWith({
        queryKey: clavesCaso.todas(1),
      });
      expect(m.invalidado(clavesCaso.detalle(1, 'm1'))).toBe(true);
      // Los observadores activos pidieron de nuevo valor y cambios.
      await waitFor(() => expect(lecturasDelValor()).toHaveLength(2));
      await waitFor(() => expect(lecturasDeCambios()).toHaveLength(2));
    });
  });

  describe('época (TOL-9.3, 9.4)', () => {
    async function cambiarDeEpocaEnVuelo(responder: () => Response) {
      const compuerta = crearCompuerta();
      servidor.use(guardarRetenido(compuerta.promesa, responder));
      let epoca = 1;
      const m = montar(() => sesionConEpoca(epoca));
      await listo(m);
      act(() => {
        m.guardar('9');
      });
      await waitFor(() => expect(retenidas).toBe(1));
      // Control: la empresa B ya cargó su valor antes de que conteste el PUT.
      epoca = 2;
      m.rerender();
      await waitFor(() =>
        expect(m.cliente.getQueryData(clavesTolerancia.valor(2))).toEqual({
          toleranciaMonto: '0.5000',
        }),
      );
      await waitFor(() =>
        expect(
          m.cliente.getQueryData(clavesTolerancia.cambios(2)),
        ).toBeDefined(),
      );
      m.invalidar.mockClear();
      const lecturasAntes = tolerancia.peticiones().length;
      compuerta.abrir();
      await waitFor(() =>
        expect(m.cliente.getMutationCache().getAll()[0]?.state.status).not.toBe(
          'pending',
        ),
      );
      await esperarIntervalos();
      return { m, lecturasAntes };
    }

    it('un éxito que llega tras cambiar de época no escribe, no invalida y no avisa', async () => {
      const { m, lecturasAntes } = await cambiarDeEpocaEnVuelo(() =>
        HttpResponse.json({ toleranciaMonto: '9.0000' }),
      );
      expect(m.cliente.getMutationCache().getAll()[0]?.state.status).toBe(
        'success',
      );
      expect(m.alExito).not.toHaveBeenCalled();
      expect(m.alFallar).not.toHaveBeenCalled();
      expect(m.invalidar).not.toHaveBeenCalled();
      expect(m.cliente.getQueryData(clavesTolerancia.valor(2))).toEqual({
        toleranciaMonto: '0.5000',
      });
      expect(m.cliente.getQueryData(clavesTolerancia.valor(1))).toEqual({
        toleranciaMonto: '0.5000',
      });
      expect(m.invalidado(clavesCaso.detalle(1, 'm1'))).toBe(false);
      // Ni siquiera hubo lecturas nuevas por una invalidación.
      expect(tolerancia.peticiones().length).toBe(lecturasAntes);
    });

    it('un error que llega tras cambiar de época tampoco avisa ni invalida', async () => {
      const { m } = await cambiarDeEpocaEnVuelo(() =>
        HttpResponse.json(
          { statusCode: 500, error: 'Error', message: 'x' },
          { status: 500 },
        ),
      );
      expect(m.cliente.getMutationCache().getAll()[0]?.state.status).toBe(
        'error',
      );
      expect(m.alExito).not.toHaveBeenCalled();
      expect(m.alFallar).not.toHaveBeenCalled();
      expect(m.invalidar).not.toHaveBeenCalled();
    });

    it('un ContratoError tardío de otra época no invalida nada de la nueva', async () => {
      const { m } = await cambiarDeEpocaEnVuelo(() =>
        HttpResponse.json({ toleranciaMonto: 0.5 }),
      );
      expect(m.alFallar).not.toHaveBeenCalled();
      expect(m.invalidar).not.toHaveBeenCalled();
    });

    it('cerrar la sesión en vuelo no escribe ni invalida (TOL-9.4)', async () => {
      const compuerta = crearCompuerta();
      servidor.use(guardarRetenido(compuerta.promesa));
      let estado: SessionState = sesionConEpoca(1);
      const m = montar(() => estado);
      await listo(m);
      act(() => {
        m.guardar('9');
      });
      await waitFor(() => expect(retenidas).toBe(1));
      estado = SIN_SESION;
      m.rerender();
      m.invalidar.mockClear();
      compuerta.abrir();
      await waitFor(() =>
        expect(m.cliente.getMutationCache().getAll()[0]?.state.status).toBe(
          'success',
        ),
      );
      await esperarIntervalos();
      expect(m.alExito).not.toHaveBeenCalled();
      expect(m.alFallar).not.toHaveBeenCalled();
      expect(m.invalidar).not.toHaveBeenCalled();
      expect(m.cliente.getQueryData(clavesTolerancia.valor(1))).toEqual({
        toleranciaMonto: '0.5000',
      });
    });
  });

  describe('desmontar con un PUT pendiente (TOL-9.9)', () => {
    it('la pantalla no recibe nada y no se lanza ningún error', async () => {
      const compuerta = crearCompuerta();
      servidor.use(guardarRetenido(compuerta.promesa));
      const m = montar();
      await listo(m);
      act(() => {
        m.guardar('9');
      });
      await waitFor(() => expect(retenidas).toBe(1));
      m.unmount();
      compuerta.abrir();
      // Control positivo: la mutación SÍ terminó; la pantalla desmontada no
      // se enteró de nada.
      await waitFor(() =>
        expect(m.cliente.getMutationCache().getAll()[0]?.state.status).toBe(
          'success',
        ),
      );
      await esperarIntervalos();
      expect(m.alExito).not.toHaveBeenCalled();
      expect(m.alFallar).not.toHaveBeenCalled();
    });
  });
});
