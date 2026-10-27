import { beforeEach, describe, expect, it } from 'vitest';
import {
  respuestaListadoBitacora,
  respuestaUsuariosBitacora,
} from '@/shared/api/contratos';
import { crearCompuerta } from '@/test/compuerta';
import {
  EVENTOS_MAQUETA,
  USUARIOS_BITACORA,
  eventoDeBitacora,
  generarEventos,
  idUsuario,
} from '@/test/fixturesBitacora';
import {
  type AlmacenBitacora,
  crearHandlersBitacora,
  listaFalla,
  listaFueraDeContrato,
  listaRedDeFallo,
  usuariosFalla,
  usuariosFueraDeContrato,
  usuariosRedDeFallo,
} from '@/test/handlersBitacora';
import { servidor } from '@/test/servidor';

// Un almacén propio por prueba, registrado por encima de los manejadores por
// defecto: aquí se prueba el mock de la bitácora solo; su integración con el de
// la tolerancia está en handlersBitacoraTolerancia.test.ts.
let bitacora: AlmacenBitacora;

beforeEach(() => {
  bitacora = crearHandlersBitacora([]);
  servidor.use(...bitacora.handlers);
});

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

interface Sobre {
  datos: { id: string; accion: string; createdAt: string }[];
  pagina: number;
  limite: number;
  total: number;
}

const lista = (consulta = '') =>
  pedir(consulta === '' ? '/bitacora' : `/bitacora?${consulta}`);
const usuarios = () => pedir('/bitacora/usuarios');
const ids = (cuerpo: unknown) => (cuerpo as Sobre).datos.map((e) => e.id);

describe('GET /bitacora: sobre y forma del evento', () => {
  it('responde { datos, pagina, limite, total } con los eventos de la maqueta', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    const { status, cuerpo } = await lista();
    expect(status).toBe(200);
    expect(cuerpo).toMatchObject({ pagina: 1, limite: 50, total: 7 });
    expect((cuerpo as Sobre).datos).toHaveLength(7);
  });

  it('los eventos traen ip, userAgent y correo; el contrato los descarta', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    const { cuerpo } = await lista();
    const [primero] = (cuerpo as { datos: Record<string, unknown>[] }).datos;
    expect(primero).toMatchObject({
      ip: expect.any(String),
      userAgent: expect.any(String),
      usuario: { nombre: 'Luis Reyes', email: 'luis.reyes@despacho.mx' },
    });
    const parseado = respuestaListadoBitacora.parse(cuerpo);
    expect(parseado.datos[0]).not.toHaveProperty('ip');
    expect(parseado.datos[0]).not.toHaveProperty('userAgent');
    expect(parseado.datos[0]?.usuario).toEqual({ nombre: 'Luis Reyes' });
  });

  it('sin parámetros usa pagina 1 y limite 50', async () => {
    bitacora.establecer(generarEventos(60));
    const { cuerpo } = await lista();
    expect(cuerpo).toMatchObject({ pagina: 1, limite: 50, total: 60 });
    expect((cuerpo as Sobre).datos).toHaveLength(50);
  });
});

describe('GET /bitacora: orden', () => {
  it('createdAt descendente y, a igual instante, id descendente', async () => {
    const a = eventoDeBitacora(1, { createdAt: '2026-09-18T10:00:00.000Z' });
    const b = eventoDeBitacora(2, { createdAt: '2026-09-18T10:00:00.000Z' });
    const c = eventoDeBitacora(3, { createdAt: '2026-09-18T11:00:00.000Z' });
    const d = eventoDeBitacora(4, { createdAt: '2026-09-17T09:00:00.000Z' });
    bitacora.establecer([a, d, b, c]);
    const { cuerpo } = await lista();
    expect(ids(cuerpo)).toEqual([c.id, b.id, a.id, d.id]);
  });
});

describe('GET /bitacora: filtros', () => {
  it('filtra por entidad', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    const { cuerpo } = await lista('entidad=companies');
    expect((cuerpo as Sobre).total).toBe(2);
    expect(ids(cuerpo)).toEqual([
      EVENTOS_MAQUETA[1]!.id,
      EVENTOS_MAQUETA[5]!.id,
    ]);
  });

  it('una entidad que nadie escribió da una página vacía, no un 400', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    const { status, cuerpo } = await lista('entidad=nadie_la_escribio');
    expect(status).toBe(200);
    expect(cuerpo).toMatchObject({ datos: [], total: 0 });
  });

  it('una entidad de más de 64 caracteres es 400', async () => {
    expect((await lista(`entidad=${'x'.repeat(65)}`)).status).toBe(400);
    expect((await lista(`entidad=${'x'.repeat(64)}`)).status).toBe(200);
  });

  it('filtra por entidadId y rechaza uno que no es uuid', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    const objetivo = EVENTOS_MAQUETA[0]!;
    const { cuerpo } = await lista(`entidadId=${objetivo.entidadId}`);
    expect(ids(cuerpo)).toEqual([objetivo.id]);
    expect((await lista('entidadId=123')).status).toBe(400);
  });

  it('filtra por accion', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    const { cuerpo } = await lista('accion=rechazar');
    expect((cuerpo as Sobre).total).toBe(2);
    expect((cuerpo as Sobre).datos.every((e) => e.accion === 'rechazar')).toBe(
      true,
    );
  });

  it('una accion fuera de la lista es 400', async () => {
    expect((await lista('accion=cargas')).status).toBe(400);
    expect((await lista('accion=')).status).toBe(400);
  });

  it('combina entidad y accion', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    const { cuerpo } = await lista('entidad=companies&accion=actualizar');
    expect(ids(cuerpo)).toEqual([EVENTOS_MAQUETA[5]!.id]);
  });
});

describe('GET /bitacora: filtro de usuario (userId)', () => {
  it('traduce el id del usuario a sus eventos por correo', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    const luis = USUARIOS_BITACORA.find((u) => u.nombre === 'Luis Reyes')!;
    const { cuerpo } = await lista(`userId=${luis.id}`);
    expect((cuerpo as Sobre).total).toBe(2);
    expect(ids(cuerpo)).toEqual([
      EVENTOS_MAQUETA[0]!.id,
      EVENTOS_MAQUETA[2]!.id,
    ]);
  });

  it('los eventos sin usuario no coinciden con nadie', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    let suma = 0;
    for (const u of USUARIOS_BITACORA) {
      suma += ((await lista(`userId=${u.id}`)).cuerpo as Sobre).total;
    }
    // 7 eventos: 2 del Sistema no los trae ningún usuario.
    expect(suma).toBe(5);
  });

  it('un uuid que no es de nadie da una página vacía', async () => {
    bitacora.establecer(EVENTOS_MAQUETA);
    const { status, cuerpo } = await lista(`userId=${idUsuario(99)}`);
    expect(status).toBe(200);
    expect(cuerpo).toMatchObject({ datos: [], total: 0 });
  });

  it('un userId que no es uuid es 400', async () => {
    expect((await lista('userId=abc')).status).toBe(400);
    expect((await lista('userId=')).status).toBe(400);
  });
});

describe('GET /bitacora: rango de fechas [desde, hasta)', () => {
  const lunes = eventoDeBitacora(1, { createdAt: '2026-09-14T06:00:00.000Z' });
  const martes = eventoDeBitacora(2, { createdAt: '2026-09-15T06:00:00.000Z' });
  const miercoles = eventoDeBitacora(3, {
    createdAt: '2026-09-16T06:00:00.000Z',
  });

  it('desde es inclusivo y hasta es exclusivo', async () => {
    bitacora.establecer([lunes, martes, miercoles]);
    const { cuerpo } = await lista(
      'desde=2026-09-15T06:00:00.000Z&hasta=2026-09-16T06:00:00.000Z',
    );
    expect(ids(cuerpo)).toEqual([martes.id]);
  });

  it('solo desde y solo hasta', async () => {
    bitacora.establecer([lunes, martes, miercoles]);
    expect(ids((await lista('desde=2026-09-15T06:00:00.000Z')).cuerpo)).toEqual(
      [miercoles.id, martes.id],
    );
    expect(ids((await lista('hasta=2026-09-15T06:00:00.000Z')).cuerpo)).toEqual(
      [lunes.id],
    );
  });

  it('desde igual a hasta no da eventos pero no es un error', async () => {
    bitacora.establecer([lunes, martes, miercoles]);
    const { status, cuerpo } = await lista(
      'desde=2026-09-15T06:00:00.000Z&hasta=2026-09-15T06:00:00.000Z',
    );
    expect(status).toBe(200);
    expect(cuerpo).toMatchObject({ datos: [], total: 0 });
  });

  it('desde posterior a hasta es 400', async () => {
    const { status } = await lista(
      'desde=2026-09-16T06:00:00.000Z&hasta=2026-09-15T06:00:00.000Z',
    );
    expect(status).toBe(400);
  });

  it.each([
    ['una fecha que no existe', '2026-02-31'],
    ['un mes 13', '2026-13-01'],
    ['texto', 'ayer'],
    ['una hora 25', '2026-09-15T25:00:00Z'],
    ['una cadena vacía', ''],
  ])('%s en desde o en hasta es 400', async (_n, valor) => {
    expect((await lista(`desde=${valor}`)).status).toBe(400);
    expect((await lista(`hasta=${valor}`)).status).toBe(400);
  });

  it('acepta un día sin hora y un instante con desfase', async () => {
    bitacora.establecer([lunes, martes, miercoles]);
    expect((await lista('desde=2026-09-15')).status).toBe(200);
    expect(
      ids((await lista('desde=2026-09-15T00:00:00-06:00')).cuerpo),
    ).toEqual([miercoles.id, martes.id]);
  });
});

describe('GET /bitacora: pagina y limite', () => {
  it('pagina y limite recortan sobre el orden y el total no cambia', async () => {
    bitacora.establecer(generarEventos(312));
    const todos = ids((await lista('limite=200')).cuerpo);
    const { cuerpo } = await lista('pagina=2&limite=50');
    expect(cuerpo).toMatchObject({ pagina: 2, limite: 50, total: 312 });
    expect(ids(cuerpo)).toEqual(todos.slice(50, 100));
  });

  it('la última página trae el resto', async () => {
    bitacora.establecer(generarEventos(312));
    const { cuerpo } = await lista('pagina=7&limite=50');
    expect((cuerpo as Sobre).datos).toHaveLength(12);
    expect(cuerpo).toMatchObject({ pagina: 7, total: 312 });
  });

  it('una página más allá del final da datos vacíos con el total', async () => {
    bitacora.establecer(generarEventos(312));
    const { status, cuerpo } = await lista('pagina=99&limite=50');
    expect(status).toBe(200);
    expect(cuerpo).toMatchObject({ datos: [], pagina: 99, total: 312 });
  });

  it.each(['0', '-1', '1.5', 'abc', ''])('pagina=%s es 400', async (valor) => {
    expect((await lista(`pagina=${valor}`)).status).toBe(400);
  });

  it.each(['0', '201', '1.5', 'abc', ''])('limite=%s es 400', async (valor) => {
    expect((await lista(`limite=${valor}`)).status).toBe(400);
  });

  it('limite 1 y 200 son los extremos válidos', async () => {
    bitacora.establecer(generarEventos(312));
    expect(((await lista('limite=1')).cuerpo as Sobre).datos).toHaveLength(1);
    expect(((await lista('limite=200')).cuerpo as Sobre).datos).toHaveLength(
      200,
    );
  });
});

describe('GET /bitacora/usuarios', () => {
  it('responde { datos: [{ id, nombre }] } y cumple el contrato', async () => {
    const { status, cuerpo } = await usuarios();
    expect(status).toBe(200);
    expect(respuestaUsuariosBitacora.parse(cuerpo).datos).toHaveLength(3);
    expect(cuerpo).toEqual({
      datos: USUARIOS_BITACORA.map(({ id, nombre }) => ({ id, nombre })),
    });
  });

  it('no expone el correo', async () => {
    const { cuerpo } = await usuarios();
    expect(JSON.stringify(cuerpo)).not.toContain('@');
  });

  it('establecerUsuarios cambia lo que sirve y respeta el orden dado', async () => {
    bitacora.establecerUsuarios([
      { id: idUsuario(7), nombre: 'Zoe', email: 'zoe@despacho.mx' },
      { id: idUsuario(8), nombre: 'Abel', email: 'abel@despacho.mx' },
    ]);
    const { cuerpo } = await usuarios();
    expect(cuerpo).toEqual({
      datos: [
        { id: idUsuario(7), nombre: 'Zoe' },
        { id: idUsuario(8), nombre: 'Abel' },
      ],
    });
  });
});

describe('registro de peticiones', () => {
  it('anota método, ruta y consulta de cada petición a ambos endpoints', async () => {
    await lista('pagina=2&limite=10');
    await usuarios();
    expect(bitacora.peticiones()).toEqual([
      {
        metodo: 'GET',
        ruta: '/api/bitacora',
        consulta: { pagina: '2', limite: '10' },
      },
      { metodo: 'GET', ruta: '/api/bitacora/usuarios', consulta: {} },
    ]);
  });

  it('también anota la petición que respondió 400', async () => {
    await lista('limite=0');
    expect(bitacora.peticiones()).toHaveLength(1);
  });
});

describe('compuertas', () => {
  it.each([
    ['lista', () => lista()],
    ['usuarios', () => usuarios()],
  ] as const)(
    'retiene la respuesta de %s hasta abrir la compuerta',
    async (nombre, pedirAlgo) => {
      const compuerta = crearCompuerta();
      bitacora.compuertas({ [nombre]: compuerta.promesa });
      let resuelta = false;
      const respuesta = pedirAlgo().then((r) => {
        resuelta = true;
        return r;
      });
      await expect
        .poll(() => bitacora.peticiones().length, { timeout: 3_000 })
        .toBe(1);
      expect(resuelta).toBe(false);
      compuerta.abrir();
      expect((await respuesta).status).toBe(200);
    },
  );

  it('la compuerta de la lista no retiene a usuarios', async () => {
    bitacora.compuertas({ lista: crearCompuerta().promesa });
    expect((await usuarios()).status).toBe(200);
  });
});

describe('ayudas de fallo', () => {
  it('listaFalla responde 403 o 500 con un cuerpo que la pantalla no debe mostrar', async () => {
    servidor.use(listaFalla(403));
    expect((await lista()).status).toBe(403);
    servidor.use(listaFalla(500, 'boom'));
    const { status, cuerpo } = await lista();
    expect(status).toBe(500);
    expect(JSON.stringify(cuerpo)).toContain('boom');
  });

  it('listaRedDeFallo corta la conexión', async () => {
    servidor.use(listaRedDeFallo());
    await expect(lista()).rejects.toThrow();
  });

  it('listaFueraDeContrato responde 200 con un sobre que el contrato rechaza', async () => {
    servidor.use(listaFueraDeContrato());
    const { status, cuerpo } = await lista();
    expect(status).toBe(200);
    expect(respuestaListadoBitacora.safeParse(cuerpo).success).toBe(false);
  });

  it('usuariosFalla, usuariosRedDeFallo y usuariosFueraDeContrato fallan solo a los usuarios', async () => {
    servidor.use(usuariosFalla(500));
    expect((await usuarios()).status).toBe(500);
    expect((await lista()).status).toBe(200);
    servidor.use(usuariosRedDeFallo());
    await expect(usuarios()).rejects.toThrow();
    servidor.use(usuariosFueraDeContrato());
    const { status, cuerpo } = await usuarios();
    expect(status).toBe(200);
    expect(respuestaUsuariosBitacora.safeParse(cuerpo).success).toBe(false);
  });
});

describe('reiniciar', () => {
  it('devuelve eventos, usuarios, registro y compuertas al arranque', async () => {
    expect(bitacora.eventos()).toEqual([]);
    bitacora.establecer(EVENTOS_MAQUETA);
    bitacora.establecerUsuarios([]);
    bitacora.compuertas({ lista: crearCompuerta().promesa });
    await usuarios();
    bitacora.reiniciar();
    expect(bitacora.eventos()).toEqual([]);
    expect(bitacora.usuarios()).toEqual(USUARIOS_BITACORA);
    expect(bitacora.peticiones()).toEqual([]);
    // Sin compuerta vigente: responde sin esperar.
    expect((await lista()).status).toBe(200);
  });
});
