import { describe, expect, it } from 'vitest';
import { respuestaCaso } from '@/shared/api/contratos';
import {
  casoConciliado,
  casoDeFila,
  casoLlm,
  casoSinMatch,
  casoSugerencia,
  casoVarias,
  propuestaCaso,
} from '@/test/fixturesCaso';
import { FILAS_DEMO, MOTIVO_IA_SIMULADA, idDe } from '@/test/fixturesBandeja';
import {
  casoFalla,
  casoRedDeFallo,
  crearHandlersCaso,
} from '@/test/handlersCaso';
import { servidor } from '@/test/servidor';

async function pedir(ruta: string) {
  const respuesta = await fetch(`/api${ruta}`);
  return {
    status: respuesta.status,
    cuerpo: (await respuesta.json()) as unknown,
  };
}

describe('fixtures del caso', () => {
  it('todas cumplen el contrato, con montos como cadenas', () => {
    const casos = [
      casoSugerencia(),
      casoVarias(),
      casoSinMatch(),
      casoConciliado(),
      casoLlm(),
    ];
    for (const caso of casos) {
      expect(respuestaCaso.safeParse(caso).success).toBe(true);
      expect(typeof caso.movimiento.monto).toBe('string');
      expect(typeof caso.toleranciaMonto).toBe('string');
    }
  });

  it('cubren cada estado derivado y el número de propuestas', () => {
    expect(casoSugerencia().propuestas).toHaveLength(1);
    expect(casoVarias().propuestas.length).toBeGreaterThanOrEqual(3);
    expect(casoSinMatch().estado).toBe('sin_match');
    expect(casoSinMatch().propuestas).toEqual([]);
    expect(casoConciliado().estado).toBe('conciliado');
    expect(casoConciliado().propuestas[0]?.estado).toBe('confirmada');
    expect(casoConciliado().propuestas[0]?.confirmadaPor?.nombre).toBe('Ana');
  });

  it('la propuesta llm simulada usa el prefijo completo', () => {
    const [p] = casoLlm().propuestas;
    expect(p?.origen).toBe('llm');
    expect(p?.regla).toBe('llm_sugerencia');
    expect(p?.motivo).toBe(MOTIVO_IA_SIMULADA);
  });

  it('propuestaCaso permite cambiar solo lo que importa', () => {
    const p = propuestaCaso(3, { diferenciaMonto: '0.0040' });
    expect(p.diferenciaMonto).toBe('0.0040');
    expect(p.conciliacionId).not.toBe(propuestaCaso(4).conciliacionId);
  });

  it('casoDeFila vuelve navegable cada fila de la bandeja con su estado', () => {
    for (const fila of FILAS_DEMO) {
      const caso = casoDeFila(fila);
      expect(respuestaCaso.safeParse(caso).success).toBe(true);
      expect(caso.estado).toBe(fila.estado);
      expect(caso.movimiento.id).toBe(fila.movimientoId);
      expect(caso.movimiento.monto).toBe(fila.monto);
    }
  });
});

describe('GET /api/casos/:id', () => {
  it('sirve el caso de una fila de la bandeja', async () => {
    servidor.use(...crearHandlersCaso().handlers);
    const fila = FILAS_DEMO[0];
    if (!fila) throw new Error('Sin filas de demostración');
    const { status, cuerpo } = await pedir(`/casos/${fila.movimientoId}`);
    expect(status).toBe(200);
    expect(respuestaCaso.parse(cuerpo).movimiento.id).toBe(fila.movimientoId);
  });

  it('un id desconocido es 404 y uno que no es guid es 400', async () => {
    servidor.use(...crearHandlersCaso().handlers);
    expect((await pedir(`/casos/${idDe(99999)}`)).status).toBe(404);
    expect((await pedir('/casos/42')).status).toBe(400);
  });

  it('establecer reemplaza los casos servidos', async () => {
    const casos = crearHandlersCaso();
    servidor.use(...casos.handlers);
    const propio = casoVarias();
    casos.establecer([propio]);
    const { status, cuerpo } = await pedir(`/casos/${propio.movimiento.id}`);
    expect(status).toBe(200);
    expect(respuestaCaso.parse(cuerpo).propuestas).toHaveLength(
      propio.propuestas.length,
    );
  });
});

describe('ayudas de error', () => {
  it('casoFalla responde con el status y nada que mostrar', async () => {
    servidor.use(casoFalla(403));
    const { status } = await pedir(`/casos/${idDe(1)}`);
    expect(status).toBe(403);
  });

  it('casoRedDeFallo corta la conexión', async () => {
    servidor.use(casoRedDeFallo());
    await expect(fetch(`/api/casos/${idDe(1)}`)).rejects.toThrow();
  });
});
