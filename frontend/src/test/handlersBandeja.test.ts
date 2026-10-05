import { describe, expect, it } from 'vitest';
import { respuestaBandeja, resumenBandeja } from '@/shared/api/contratos';
import {
  FILAS_DEMO,
  filaBandeja,
  idDe,
  resumenDe,
} from '@/test/fixturesBandeja';
import { crearHandlersBandeja } from '@/test/handlersBandeja';
import { servidor } from '@/test/servidor';

async function pedir(ruta: string) {
  const respuesta = await fetch(`/api${ruta}`);
  return {
    status: respuesta.status,
    cuerpo: (await respuesta.json()) as unknown,
  };
}

describe('fixtures de la bandeja', () => {
  it('cumplen el contrato y cubren los casos de las pantallas', () => {
    expect(FILAS_DEMO.length).toBeGreaterThanOrEqual(25);
    expect(
      respuestaBandeja.safeParse({
        datos: FILAS_DEMO,
        pagina: 1,
        limite: 200,
        total: FILAS_DEMO.length,
      }).success,
    ).toBe(true);
    expect(FILAS_DEMO.some((f) => f.moneda !== 'MXN')).toBe(true);
    expect(
      FILAS_DEMO.some((f) => f.mejorPropuesta?.diferenciaMonto === '0.0040'),
    ).toBe(true);
    expect(
      FILAS_DEMO.some((f) =>
        f.motivo?.startsWith(
          'Sugerencia de IA: [SIMULADA — no es un modelo real]',
        ),
      ),
    ).toBe(true);
    expect(
      FILAS_DEMO.some(
        (f) => f.regla === 'llm_sugerencia' && !f.motivo?.includes('SIMULADA'),
      ),
    ).toBe(true);
    expect(
      FILAS_DEMO.some((f) => f.estado === 'sin_match' && !f.mejorPropuesta),
    ).toBe(true);
  });

  it('resumenDe suma por moneda sin flotantes y excluye los conciliados', () => {
    const resumen = resumenDe([
      filaBandeja({ movimientoId: idDe(1), monto: '0.1000' }),
      filaBandeja({
        movimientoId: idDe(2),
        monto: '0.2000',
        estado: 'sugerencia',
      }),
      filaBandeja({
        movimientoId: idDe(3),
        monto: '5.0000',
        estado: 'conciliado',
      }),
      filaBandeja({ movimientoId: idDe(4), monto: '9.0000', moneda: 'USD' }),
    ]);
    expect(resumen.conteos).toEqual({
      conciliado: 1,
      sugerencia: 1,
      sin_match: 2,
    });
    expect(resumen.montoPorRevisar).toEqual([
      { moneda: 'MXN', monto: '0.3000' },
      { moneda: 'USD', monto: '9.0000' },
    ]);
  });
});

describe('manejadores de la bandeja', () => {
  it('sin parámetros sirve sugerencia y sin_match, con el límite por defecto', async () => {
    const { status, cuerpo } = await pedir('/bandeja');
    expect(status).toBe(200);
    const datos = respuestaBandeja.parse(cuerpo);
    expect(datos).toMatchObject({ pagina: 1, limite: 50, total: 39 });
    expect(datos.datos.every((f) => f.estado !== 'conciliado')).toBe(true);
  });

  it('ordena por monto descendente y pagina sin repetir filas', async () => {
    const uno = respuestaBandeja.parse(
      (await pedir('/bandeja?pagina=1&limite=20')).cuerpo,
    );
    const dos = respuestaBandeja.parse(
      (await pedir('/bandeja?pagina=2&limite=20')).cuerpo,
    );
    expect(uno.datos).toHaveLength(20);
    expect(dos.datos).toHaveLength(19);
    expect(dos.total).toBe(39);
    const ids = [...uno.datos, ...dos.datos].map((f) => f.movimientoId);
    expect(new Set(ids).size).toBe(39);
    // La fila en USD (2,150.00) cae al final por su monto, no por su moneda.
    expect(dos.datos.at(-1)?.moneda).toBe('USD');
  });

  it('desempata por id cuando el monto coincide', async () => {
    const { handlers } = crearHandlersBandeja([
      filaBandeja({ movimientoId: idDe(9), monto: '10.0000' }),
      filaBandeja({ movimientoId: idDe(2), monto: '10.0000' }),
      filaBandeja({ movimientoId: idDe(5), monto: '99.0000' }),
    ]);
    servidor.use(...handlers);
    const { datos } = respuestaBandeja.parse((await pedir('/bandeja')).cuerpo);
    expect(datos.map((f) => f.movimientoId)).toEqual([
      idDe(5),
      idDe(2),
      idDe(9),
    ]);
  });

  it('filtra por estado repetido y el total no depende de la página', async () => {
    const { cuerpo } = await pedir('/bandeja?estado=conciliado&limite=1');
    expect(respuestaBandeja.parse(cuerpo)).toMatchObject({
      total: 4,
      limite: 1,
    });
  });

  it.each([
    '/bandeja?estado=borrado',
    '/bandeja?estado=sin_match&estado=sin_match',
    '/bandeja?pagina=0',
    '/bandeja?pagina=abc',
    '/bandeja?pagina=1.5',
    '/bandeja?limite=0',
    '/bandeja?limite=201',
  ])('responde 400 a %s', async (ruta) => {
    const { status, cuerpo } = await pedir(ruta);
    expect(status).toBe(400);
    expect(cuerpo).toMatchObject({ statusCode: 400 });
  });

  it('el resumen sale del mismo conjunto de datos que la lista', async () => {
    const resumen = resumenBandeja.parse(
      (await pedir('/bandeja/resumen')).cuerpo,
    );
    expect(resumen).toEqual(resumenDe(FILAS_DEMO));
    for (const estado of ['conciliado', 'sugerencia', 'sin_match'] as const) {
      const lista = respuestaBandeja.parse(
        (await pedir(`/bandeja?estado=${estado}&limite=1`)).cuerpo,
      );
      expect(resumen.conteos[estado]).toBe(lista.total);
    }
  });

  it('establecer cambia a la vez lo que sirven la lista y el resumen', async () => {
    const control = crearHandlersBandeja();
    servidor.use(...control.handlers);
    control.establecer([filaBandeja({ monto: '7.0000' })]);
    expect(respuestaBandeja.parse((await pedir('/bandeja')).cuerpo).total).toBe(
      1,
    );
    expect(
      resumenBandeja.parse((await pedir('/bandeja/resumen')).cuerpo),
    ).toEqual({
      conteos: { conciliado: 0, sugerencia: 0, sin_match: 1 },
      montoPorRevisar: [{ moneda: 'MXN', monto: '7.0000' }],
    });
  });
});
