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
import { crearHandlersBandeja } from '@/test/handlersBandeja';
import {
  casoFalla,
  casoRedDeFallo,
  crearHandlersCaso,
  resolverFalla,
} from '@/test/handlersCaso';
import { servidor } from '@/test/servidor';
import {
  respuestaHistorial,
  respuestaResolucion,
} from '@/shared/api/contratos';

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

async function enviar(ruta: string, cuerpo?: unknown) {
  const respuesta = await fetch(`/api${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  return {
    status: respuesta.status,
    cuerpo: (await respuesta.json()) as unknown,
  };
}

/** Bandeja y caso compartiendo un solo conjunto de datos. */
function montar() {
  const bandeja = crearHandlersBandeja();
  const caso = crearHandlersCaso(bandeja);
  servidor.use(...bandeja.handlers, ...caso.handlers);
  return { bandeja, caso };
}

function filaSugerencia(propuestas: number) {
  const fila = FILAS_DEMO.find(
    (f) => f.estado === 'sugerencia' && f.propuestasCount === 1,
  );
  if (!fila) throw new Error('Sin fila sugerencia');
  return { ...fila, propuestasCount: propuestas };
}

describe('POST confirmar y rechazar con estado', () => {
  it('confirmar deja la fila de la bandeja y el caso conciliados', async () => {
    const { bandeja, caso } = montar();
    const fila = filaSugerencia(3);
    bandeja.establecer([fila]);
    const antes = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    expect(antes.propuestas).toHaveLength(3);
    const elegida = antes.propuestas[1];
    if (!elegida) throw new Error('sin propuesta');

    const { status, cuerpo } = await enviar(
      `/conciliaciones/${elegida.conciliacionId}/confirmar`,
    );
    expect(status).toBe(200);
    const resolucion = respuestaResolucion.parse(cuerpo);
    expect(resolucion.estado).toBe('confirmada');
    expect(resolucion.rechazadasAutomaticamente).toHaveLength(2);

    const despues = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    expect(despues.estado).toBe('conciliado');
    expect(despues.propuestas).toHaveLength(1);
    expect(despues.propuestas[0]?.conciliacionId).toBe(elegida.conciliacionId);
    expect(despues.propuestas[0]?.confirmadaPor?.nombre).toBeTruthy();
    expect(bandeja.filas()[0]?.estado).toBe('conciliado');
    expect(caso).toBeDefined();
  });

  it('rechazar quita la propuesta y deja las demás vigentes', async () => {
    const { bandeja } = montar();
    const fila = filaSugerencia(2);
    bandeja.establecer([fila]);
    const antes = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    const primera = antes.propuestas[0];
    if (!primera) throw new Error('sin propuesta');
    const { status, cuerpo } = await enviar(
      `/conciliaciones/${primera.conciliacionId}/rechazar`,
      { motivo: 'No corresponde' },
    );
    expect(status).toBe(200);
    const resolucion = respuestaResolucion.parse(cuerpo);
    expect(resolucion.estado).toBe('rechazada');
    expect(resolucion.motivo).toBe('No corresponde');
    const despues = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    expect(despues.estado).toBe('sugerencia');
    expect(despues.propuestas).toHaveLength(1);
    expect(bandeja.filas()[0]?.estado).toBe('sugerencia');
    expect(bandeja.filas()[0]?.propuestasCount).toBe(1);
  });

  it('rechazar la última propuesta deja el caso y la fila en sin_match', async () => {
    const { bandeja } = montar();
    const fila = filaSugerencia(1);
    bandeja.establecer([fila]);
    const caso = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    const unica = caso.propuestas[0];
    if (!unica) throw new Error('sin propuesta');
    await enviar(`/conciliaciones/${unica.conciliacionId}/rechazar`, {});
    const despues = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    expect(despues.estado).toBe('sin_match');
    expect(despues.propuestas).toEqual([]);
    expect(bandeja.filas()[0]?.estado).toBe('sin_match');
    expect(bandeja.filas()[0]?.mejorPropuesta).toBeNull();
    // El historial de la rechazada sigue disponible (B5).
    const historial = respuestaHistorial.parse(
      (await pedir(`/conciliaciones/${unica.conciliacionId}/historial`)).cuerpo,
    );
    expect(historial.datos.map((e) => e.accion)).toEqual(['crear', 'rechazar']);
  });

  it('el historial de una propuesta confirmada incluye el evento', async () => {
    const { bandeja } = montar();
    const fila = filaSugerencia(1);
    bandeja.establecer([fila]);
    const caso = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    const id = caso.propuestas[0]?.conciliacionId ?? '';
    const antes = respuestaHistorial.parse(
      (await pedir(`/conciliaciones/${id}/historial`)).cuerpo,
    );
    expect(antes.datos.map((e) => e.accion)).toEqual(['crear']);
    expect(antes.datos[0]?.usuario).toBeNull();
    await enviar(`/conciliaciones/${id}/confirmar`);
    const despues = respuestaHistorial.parse(
      (await pedir(`/conciliaciones/${id}/historial`)).cuerpo,
    );
    expect(despues.datos.map((e) => e.accion)).toEqual(['crear', 'confirmar']);
    expect(despues.datos[1]?.usuario?.nombre).toBeTruthy();
  });

  it('un historial de id desconocido es 404 y uno no guid es 400', async () => {
    montar();
    expect(
      (await pedir(`/conciliaciones/${idDe(99999)}/historial`)).status,
    ).toBe(404);
    expect((await pedir('/conciliaciones/42/historial')).status).toBe(400);
  });

  it('resolver una propuesta desconocida es 404', async () => {
    montar();
    expect(
      (await enviar(`/conciliaciones/${idDe(99999)}/confirmar`)).status,
    ).toBe(404);
  });

  it('un caso ya conciliado responde 409 al volver a confirmar', async () => {
    const { bandeja } = montar();
    const fila = filaSugerencia(1);
    bandeja.establecer([fila]);
    const caso = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    const id = caso.propuestas[0]?.conciliacionId ?? '';
    await enviar(`/conciliaciones/${id}/confirmar`);
    expect((await enviar(`/conciliaciones/${id}/confirmar`)).status).toBe(409);
  });

  it('rechazar con un motivo de más de 500 caracteres es 400', async () => {
    const { bandeja } = montar();
    const fila = filaSugerencia(1);
    bandeja.establecer([fila]);
    const caso = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    const id = caso.propuestas[0]?.conciliacionId ?? '';
    expect(
      (
        await enviar(`/conciliaciones/${id}/rechazar`, {
          motivo: 'x'.repeat(501),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await enviar(`/conciliaciones/${id}/rechazar`, {
          motivo: 'x'.repeat(500),
        })
      ).status,
    ).toBe(200);
  });

  it('las opciones conflicto y segregación fuerzan 409 y 403', async () => {
    const { bandeja, caso } = montar();
    const fila = filaSugerencia(1);
    bandeja.establecer([fila]);
    const c = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    const id = c.propuestas[0]?.conciliacionId ?? '';
    caso.opciones({ conflicto: true });
    expect((await enviar(`/conciliaciones/${id}/confirmar`)).status).toBe(409);
    caso.opciones({ conflicto: false, segregacion: true });
    expect((await enviar(`/conciliaciones/${id}/confirmar`)).status).toBe(403);
    // La segregación solo aplica a confirmar.
    expect((await enviar(`/conciliaciones/${id}/rechazar`, {})).status).toBe(
      200,
    );
  });

  it('reiniciar devuelve casos, historial, opciones y bandeja al inicio', async () => {
    const { bandeja, caso } = montar();
    const fila = filaSugerencia(1);
    bandeja.establecer([fila]);
    const c = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    const id = c.propuestas[0]?.conciliacionId ?? '';
    await enviar(`/conciliaciones/${id}/confirmar`);
    caso.opciones({ conflicto: true });
    caso.reiniciar();
    bandeja.reiniciar();
    expect(bandeja.filas()).toHaveLength(FILAS_DEMO.length);
    const despues = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    expect(despues.estado).toBe('sugerencia');
    expect((await enviar(`/conciliaciones/${id}/confirmar`)).status).toBe(200);
  });
});

describe('resolverFalla', () => {
  it('responde con el status para confirmar y rechazar', async () => {
    servidor.use(resolverFalla(409));
    expect(
      (await enviar(`/conciliaciones/${idDe(5001)}/confirmar`)).status,
    ).toBe(409);
    expect(
      (await enviar(`/conciliaciones/${idDe(5001)}/rechazar`, {})).status,
    ).toBe(409);
  });

  it('cada prueba empieza con el estado de arranque (sin fugas)', async () => {
    // Las dos pruebas globales comparten handlers por defecto: tras resolver
    // en la anterior, el caso por defecto sigue en su estado inicial.
    const fila = FILAS_DEMO.find((f) => f.estado === 'sugerencia');
    if (!fila) throw new Error('sin fila');
    const c = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    expect(c.estado).toBe('sugerencia');
  });
});

describe('estado global entre pruebas', () => {
  it('prueba A: resuelve un caso con los handlers por defecto', async () => {
    const fila = FILAS_DEMO.find((f) => f.estado === 'sugerencia');
    if (!fila) throw new Error('sin fila');
    const c = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    const id = c.propuestas[0]?.conciliacionId ?? '';
    expect((await enviar(`/conciliaciones/${id}/confirmar`)).status).toBe(200);
  });

  it('prueba B: el mismo caso vuelve a estar en sugerencia', async () => {
    const fila = FILAS_DEMO.find((f) => f.estado === 'sugerencia');
    if (!fila) throw new Error('sin fila');
    const c = respuestaCaso.parse(
      (await pedir(`/casos/${fila.movimientoId}`)).cuerpo,
    );
    expect(c.estado).toBe('sugerencia');
    const lista = (await pedir('/bandeja?estado=conciliado&limite=200'))
      .cuerpo as {
      total: number;
    };
    expect(lista.total).toBe(
      FILAS_DEMO.filter((f) => f.estado === 'conciliado').length,
    );
  });
});
