import { describe, expect, it } from 'vitest';
import {
  extraerCambiosTolerancia,
  respuestaBitacoraCruda,
  respuestaTolerancia,
} from '@/shared/api/contratos';
import { crearCompuerta } from '@/test/compuerta';
import {
  CAMBIOS_INICIALES,
  CAMBIOS_RUIDOSOS,
  eventoAjeno,
} from '@/test/fixturesTolerancia';
import { almacenes } from '@/test/handlers';
import {
  cambiosFalla,
  cambiosFueraDeContrato,
  guardarFalla,
  guardarFueraDeContrato,
  guardarRedDeFallo,
  valorFalla,
  valorRedDeFallo,
} from '@/test/handlersTolerancia';
import { servidor } from '@/test/servidor';

const tolerancia = almacenes.tolerancia;

async function pedir(ruta: string, init?: RequestInit) {
  const respuesta = await fetch(`/api${ruta}`, init);
  const texto = await respuesta.text();
  let cuerpo: unknown = texto;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    // cuerpo no JSON: se devuelve el texto.
  }
  return { status: respuesta.status, cuerpo };
}

const guardar = (cuerpo: unknown) =>
  pedir('/empresa/tolerancia', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });

const cambios = (consulta = 'entidad=companies&accion=actualizar&limite=50') =>
  pedir(`/bitacora?${consulta}`);

describe('GET /empresa/tolerancia', () => {
  it('sirve el valor del almacén y cumple el contrato', async () => {
    const { status, cuerpo } = await pedir('/empresa/tolerancia');
    expect(status).toBe(200);
    expect(respuestaTolerancia.parse(cuerpo)).toEqual({
      toleranciaMonto: '0.5000',
    });
  });

  it('establecer cambia lo que sirve', async () => {
    tolerancia.establecer('12.3456');
    const { cuerpo } = await pedir('/empresa/tolerancia');
    expect(cuerpo).toEqual({ toleranciaMonto: '12.3456' });
  });
});

describe('PUT /empresa/tolerancia', () => {
  it('guarda, devuelve el valor normalizado a 4 decimales y lo sirve después', async () => {
    const { status, cuerpo } = await guardar({ toleranciaMonto: '0.75' });
    expect(status).toBe(200);
    expect(respuestaTolerancia.parse(cuerpo)).toEqual({
      toleranciaMonto: '0.7500',
    });
    expect((await pedir('/empresa/tolerancia')).cuerpo).toEqual({
      toleranciaMonto: '0.7500',
    });
  });

  it('normaliza ceros a la izquierda y acepta los extremos 0 y 100', async () => {
    expect((await guardar({ toleranciaMonto: '007' })).cuerpo).toEqual({
      toleranciaMonto: '7.0000',
    });
    expect((await guardar({ toleranciaMonto: '100' })).cuerpo).toEqual({
      toleranciaMonto: '100.0000',
    });
    expect((await guardar({ toleranciaMonto: '0' })).cuerpo).toEqual({
      toleranciaMonto: '0.0000',
    });
  });

  it.each([
    ['un número JSON', { toleranciaMonto: 0.5 }],
    ['texto no decimal', { toleranciaMonto: 'abc' }],
    ['coma decimal', { toleranciaMonto: '0,5' }],
    ['un negativo', { toleranciaMonto: '-1' }],
    ['más de 100', { toleranciaMonto: '100.0001' }],
    ['cinco decimales', { toleranciaMonto: '0.12345' }],
    ['la clave ausente', {}],
  ])(
    'rechaza %s con 400 y una oración de Nest que nombra el campo',
    async (_n, cuerpo) => {
      const respuesta = await guardar(cuerpo);
      expect(respuesta.status).toBe(400);
      const { message } = respuesta.cuerpo as { message: string | string[] };
      expect(JSON.stringify(message)).toContain('toleranciaMonto');
      // Nada cambió: ni el valor ni la bitácora.
      expect((await pedir('/empresa/tolerancia')).cuerpo).toEqual({
        toleranciaMonto: '0.5000',
      });
      const lista = respuestaBitacoraCruda.parse((await cambios()).cuerpo);
      expect(lista.datos).toHaveLength(CAMBIOS_INICIALES.length);
    },
  );

  it('antepone a la bitácora una fila antes -> despues del usuario de la sesión', async () => {
    await guardar({ toleranciaMonto: '0.0050' });
    const lista = respuestaBitacoraCruda.parse((await cambios()).cuerpo);
    expect(lista.datos).toHaveLength(CAMBIOS_INICIALES.length + 1);
    const [primero] = extraerCambiosTolerancia(lista.datos);
    expect(primero?.datos).toEqual({
      campo: 'tolerancia_monto',
      antes: '0.5000',
      despues: '0.0050',
    });
    expect(primero?.usuario).toEqual({ nombre: 'Jorge Tapia' });
  });

  it('dos guardados seguidos dejan el más nuevo primero', async () => {
    await guardar({ toleranciaMonto: '1' });
    await guardar({ toleranciaMonto: '2' });
    const filas = extraerCambiosTolerancia(
      respuestaBitacoraCruda.parse((await cambios()).cuerpo).datos,
    );
    expect(filas.map((f) => f.datos.despues).slice(0, 2)).toEqual([
      '2.0000',
      '1.0000',
    ]);
  });
});

describe('GET /bitacora', () => {
  it('responde el sobre completo, con ruido que el contrato tolera', async () => {
    const { status, cuerpo } = await cambios();
    expect(status).toBe(200);
    expect(cuerpo).toMatchObject({
      pagina: 1,
      limite: 50,
      total: CAMBIOS_INICIALES.length,
    });
    const { datos } = respuestaBitacoraCruda.parse(cuerpo);
    expect(datos).toHaveLength(CAMBIOS_INICIALES.length);
    const validos = extraerCambiosTolerancia(datos);
    expect(validos.length).toBeGreaterThan(0);
    expect(validos.length).toBeLessThan(datos.length);
  });

  it('filtra por entidad y por accion como el servidor', async () => {
    const otra = eventoAjeno(50, { entidad: 'conciliaciones' });
    const otraAccion = eventoAjeno(51, { accion: 'confirmar' });
    tolerancia.establecerCambios([...CAMBIOS_INICIALES, otra, otraAccion]);
    const todo = respuestaBitacoraCruda.parse((await cambios()).cuerpo);
    expect(todo.datos).toHaveLength(CAMBIOS_INICIALES.length);
    const sinFiltro = respuestaBitacoraCruda.parse(
      (await cambios('limite=50')).cuerpo,
    );
    expect(sinFiltro.datos).toHaveLength(CAMBIOS_INICIALES.length + 2);
  });

  it('honra limite y lo devuelve en el sobre, con total del filtro', async () => {
    const { cuerpo } = await cambios('entidad=companies&limite=2');
    expect(cuerpo).toMatchObject({
      limite: 2,
      total: CAMBIOS_INICIALES.length,
    });
    expect((cuerpo as { datos: unknown[] }).datos).toHaveLength(2);
  });

  it('sin limite usa el valor por defecto del servidor (50)', async () => {
    const { cuerpo } = await cambios('entidad=companies');
    expect((cuerpo as { limite: number }).limite).toBe(50);
  });

  it('un limite sobre el máximo del servidor (200) es 400', async () => {
    expect((await cambios('limite=201')).status).toBe(400);
  });

  it('sirve el más nuevo primero aunque se fijen en otro orden', async () => {
    const [a, b, c] = CAMBIOS_INICIALES;
    if (!a || !b || !c) throw new Error('fixture inválida');
    tolerancia.establecerCambios([c, a, b]);
    const { datos } = respuestaBitacoraCruda.parse((await cambios()).cuerpo);
    expect(datos).toEqual([a, b, c]);
  });
});

describe('fixture ruidosa de cincuenta eventos', () => {
  it('cabe en el limite de la consulta y solo diez son de tolerancia', async () => {
    tolerancia.establecerCambios(CAMBIOS_RUIDOSOS);
    const { datos } = respuestaBitacoraCruda.parse((await cambios()).cuerpo);
    expect(datos).toHaveLength(50);
    expect(extraerCambiosTolerancia(datos, 50)).toHaveLength(10);
    expect(extraerCambiosTolerancia(datos)).toHaveLength(5);
  });
});

describe('registro de peticiones', () => {
  it('anota método, ruta, consulta y cuerpo de cada petición', async () => {
    await pedir('/empresa/tolerancia');
    await guardar({ toleranciaMonto: '0.0050' });
    await cambios();
    expect(tolerancia.peticiones()).toEqual([
      {
        metodo: 'GET',
        ruta: '/api/empresa/tolerancia',
        consulta: {},
        cuerpo: null,
      },
      {
        metodo: 'PUT',
        ruta: '/api/empresa/tolerancia',
        consulta: {},
        cuerpo: { toleranciaMonto: '0.0050' },
      },
      {
        metodo: 'GET',
        ruta: '/api/bitacora',
        consulta: { entidad: 'companies', accion: 'actualizar', limite: '50' },
        cuerpo: null,
      },
    ]);
  });

  it('el cuerpo se registra como llegó: la cadena, no un número', async () => {
    await guardar({ toleranciaMonto: '0.0050' });
    const [put] = tolerancia.peticiones();
    expect(
      typeof (put?.cuerpo as { toleranciaMonto: unknown }).toleranciaMonto,
    ).toBe('string');
  });
});

describe('compuertas', () => {
  it.each([
    ['valor', () => pedir('/empresa/tolerancia')],
    ['guardar', () => guardar({ toleranciaMonto: '0.75' })],
    ['cambios', () => cambios()],
  ] as const)(
    'retiene la respuesta de %s hasta abrir la compuerta',
    async (nombre, pedirAlgo) => {
      const compuerta = crearCompuerta();
      tolerancia.compuertas({ [nombre]: compuerta.promesa });
      let resuelta = false;
      const respuesta = pedirAlgo().then((r) => {
        resuelta = true;
        return r;
      });
      await expect
        .poll(() => tolerancia.peticiones().length, { timeout: 3_000 })
        .toBe(1);
      expect(resuelta).toBe(false);
      compuerta.abrir();
      expect((await respuesta).status).toBe(200);
    },
  );

  it('el PUT retenido todavía no cambia el valor ni la bitácora', async () => {
    const compuerta = crearCompuerta();
    tolerancia.compuertas({ guardar: compuerta.promesa });
    const respuesta = guardar({ toleranciaMonto: '0.75' });
    await expect
      .poll(() => tolerancia.peticiones().length, { timeout: 3_000 })
      .toBe(1);
    expect(tolerancia.valor()).toBe('0.5000');
    compuerta.abrir();
    await respuesta;
    expect(tolerancia.valor()).toBe('0.7500');
  });
});

describe('ayudas de fallo', () => {
  it('valorFalla responde el estado indicado', async () => {
    servidor.use(valorFalla(500));
    expect((await pedir('/empresa/tolerancia')).status).toBe(500);
    servidor.use(valorFalla(403));
    expect((await pedir('/empresa/tolerancia')).status).toBe(403);
  });

  it('valorRedDeFallo corta la conexión', async () => {
    servidor.use(valorRedDeFallo());
    await expect(pedir('/empresa/tolerancia')).rejects.toThrow();
  });

  it('guardarFalla responde con una oración o con un arreglo de oraciones', async () => {
    servidor.use(
      guardarFalla(400, 'toleranciaMonto must not be greater than 100'),
    );
    const una = await guardar({ toleranciaMonto: '1' });
    expect(una.status).toBe(400);
    expect((una.cuerpo as { message: unknown }).message).toBe(
      'toleranciaMonto must not be greater than 100',
    );
    servidor.use(guardarFalla(400, ['toleranciaMonto a', 'toleranciaMonto b']));
    const varias = await guardar({ toleranciaMonto: '1' });
    expect((varias.cuerpo as { message: unknown }).message).toEqual([
      'toleranciaMonto a',
      'toleranciaMonto b',
    ]);
  });

  it('guardarRedDeFallo corta la conexión', async () => {
    servidor.use(guardarRedDeFallo());
    await expect(guardar({ toleranciaMonto: '1' })).rejects.toThrow();
  });

  it('guardarFueraDeContrato responde 200 con un cuerpo que el contrato rechaza', async () => {
    servidor.use(guardarFueraDeContrato());
    const { status, cuerpo } = await guardar({ toleranciaMonto: '1' });
    expect(status).toBe(200);
    expect(respuestaTolerancia.safeParse(cuerpo).success).toBe(false);
  });

  it('cambiosFalla y cambiosFueraDeContrato fallan solo la bitácora', async () => {
    servidor.use(cambiosFalla(500));
    expect((await cambios()).status).toBe(500);
    servidor.use(cambiosFueraDeContrato());
    const { status, cuerpo } = await cambios();
    expect(status).toBe(200);
    expect(respuestaBitacoraCruda.safeParse(cuerpo).success).toBe(false);
    expect((await pedir('/empresa/tolerancia')).status).toBe(200);
  });
});

describe('reiniciar y peticiones sin manejador', () => {
  it('reiniciar devuelve valor, bitácora, registro y compuertas al arranque', async () => {
    await guardar({ toleranciaMonto: '9' });
    tolerancia.compuertas({ valor: crearCompuerta().promesa });
    tolerancia.reiniciar();
    expect(tolerancia.valor()).toBe('0.5000');
    expect(tolerancia.peticiones()).toEqual([]);
    expect(tolerancia.cambios()).toEqual(CAMBIOS_INICIALES);
    // Sin compuerta vigente: responde sin esperar.
    expect((await pedir('/empresa/tolerancia')).status).toBe(200);
  });

  it('una petición sin manejador sigue fallando', async () => {
    await expect(pedir('/empresa/otra-ruta-inexistente')).rejects.toThrow();
  });
});
