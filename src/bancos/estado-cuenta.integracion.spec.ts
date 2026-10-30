import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from '../testing/supertest-con-origen';
import { UnrecoverableError, type Job } from 'bullmq';
import type { DataSource } from 'typeorm';
import type { ResultadoDeFila } from '../cargas/carga.entity';
import type { RespuestaDeCarga } from '../cargas/cargas.service';
import {
  ANA,
  type AppDeCargas,
  CARMEN,
  FERRETERIA,
  JORGE,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { MENSAJE_FALLIDA, ProcesadorCargas } from '../cargas/procesador-cargas';
import type { TrabajoDeCarga } from '../cargas/cola-cargas';
import { filas, una } from '../database/testing/base-de-pruebas';
import { huellaMovimiento } from './huella-movimiento';
import { MENSAJE_MONEDA_FALTANTE_AL_REANUDAR } from './guardar-movimientos';

/**
 * CU-09 de punta a punta: POST /cargas/estado-cuenta, la cola y el worker
 * con Postgres real y RLS. Estados de cuenta sintéticos en
 * src/bancos/fixtures; nunca datos reales.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
/** Dueño: verifica sin RLS. */
let ds: DataSource;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
}, 60_000);

afterAll(async () => {
  await entorno?.cerrar();
});

function fixture(nombre: string): Buffer {
  return readFileSync(join(__dirname, 'fixtures', nombre));
}

/** Campos de texto del multipart. */
interface Campos {
  banco?: string;
  cuenta?: string;
  perfil?: string;
}

function subir(
  token: string,
  nombre: string,
  contenido: Buffer,
  campos: Campos = {},
) {
  let req = request(entorno.app.getHttpServer())
    .post('/cargas/estado-cuenta')
    .set('Cookie', token);
  for (const campo of ['banco', 'cuenta', 'perfil'] as const) {
    const valor = campos[campo];
    if (valor !== undefined) req = req.field(campo, valor);
  }
  return req.attach('archivo', contenido, nombre);
}

async function cargarYEsperar(
  token: string,
  nombre: string,
  campos: Campos = {},
) {
  const res = await subir(token, nombre, fixture(nombre), campos).expect(202);
  const recibida = res.body as RespuestaDeCarga;
  expect(recibida).toMatchObject({ estado: 'pendiente', yaExistia: false });
  return entorno.esperarFin(token, recibida.id);
}

interface FilaMovimiento {
  linea_numero: number;
  fecha: string;
  descripcion: string;
  referencia: string | null;
  monto: string;
  banco: string | null;
  cuenta: string | null;
}

function movimientosDe(cargaId: string) {
  // ::text para ver el valor exacto guardado, sin pasar por number.
  return filas<FilaMovimiento>(
    ds,
    `SELECT linea_numero, fecha::text AS fecha, descripcion, referencia,
            monto::text AS monto, banco, cuenta
       FROM movimientos WHERE carga_id = $1 ORDER BY linea_numero`,
    [cargaId],
  );
}

async function conteos() {
  return una<{ cargas: number; movimientos: number }>(
    ds,
    `SELECT (SELECT count(*)::int FROM cargas) AS cargas,
            (SELECT count(*)::int FROM movimientos) AS movimientos`,
  );
}

function mensaje(res: { body: unknown }): string {
  return (res.body as { message: string }).message;
}

describe('POST /cargas/estado-cuenta (CU-09)', () => {
  it('CSV válido de 5 filas: procesada, 5 movimientos con sus montos exactos', async () => {
    const carga = await cargarYEsperar(
      await entorno.token(LUIS, FERRETERIA),
      'valido-5.csv',
      { banco: 'BANCO SINTETICO', cuenta: '****1234' },
    );

    expect(carga).toMatchObject({
      estado: 'procesada',
      totalRegistros: 5,
      registrosOk: 5,
      registrosError: 0,
      resultados: [],
    });
    expect(await movimientosDe(carga.id)).toEqual([
      {
        linea_numero: 2,
        fecha: '2026-09-01',
        descripcion: 'DEPOSITO SPEI FERRETERIA DEL BAJIO',
        referencia: 'A1001',
        monto: '4466.5800',
        banco: 'BANCO SINTETICO',
        cuenta: '****1234',
      },
      expect.objectContaining({
        linea_numero: 3,
        referencia: null,
        monto: '-12.5000',
      }),
      expect.objectContaining({ linea_numero: 4, monto: '-1500.0000' }),
      expect.objectContaining({ linea_numero: 5, monto: '0.0001' }),
      expect.objectContaining({ linea_numero: 6, monto: '123456789.1234' }),
    ]);
  });

  it('1 fila malformada de 5: con_errores, 4 movimientos y la fila reportada con su línea', async () => {
    const carga = await cargarYEsperar(
      await entorno.token(ANA, FERRETERIA),
      'una-malformada.csv',
    );

    expect(carga).toMatchObject({
      estado: 'con_errores',
      totalRegistros: 5,
      registrosOk: 4,
      registrosError: 1,
    });
    const [error] = carga.resultados as ResultadoDeFila[];
    expect(carga.resultados).toHaveLength(1);
    // Línea 4 del archivo: encabezado en la 1, tercera fila de datos.
    expect(error).toMatchObject({ fila: 4, resultado: 'error' });
    expect(error.motivo).toMatch(/Fecha inválida: "2026-02-30"/);
    expect((await movimientosDe(carga.id)).map((m) => m.linea_numero)).toEqual([
      2, 3, 5, 6,
    ]);
  });

  it('encabezados incorrectos: 400 y cero cargas', async () => {
    const antes = await conteos();
    const res = await subir(
      await entorno.token(ANA, FERRETERIA),
      'encabezados-incorrectos.csv',
      fixture('encabezados-incorrectos.csv'),
    ).expect(400);

    expect(mensaje(res)).toMatch(
      /se esperan exactamente "fecha,descripcion,referencia,monto"/,
    );
    expect(await conteos()).toEqual(antes);
  });

  it('archivo en Latin-1: 400 con motivo de codificación y cero cargas', async () => {
    const antes = await conteos();
    const res = await subir(
      await entorno.token(ANA, FERRETERIA),
      'latin1.csv',
      fixture('latin1.csv'),
    ).expect(400);

    expect(mensaje(res)).toMatch(/UTF-8/);
    expect(await conteos()).toEqual(antes);
  });

  // Un \0 en un CSV de banco es archivo corrupto, no fila malformada: se
  // rechaza entero, antes de guardar nada, con la línea para encontrarlo.
  it('un byte nulo en una descripción: 400 con su línea y cero cargas', async () => {
    const antes = await conteos();
    const csv = Buffer.from(
      [
        'fecha,descripcion,referencia,monto',
        `2026-09-01,DEPOSITO UNO,${randomUUID()},100.00`,
        '2026-09-02,DEPOSITO\u0000DOS,R2,200.00',
        '2026-09-03,DEPOSITO TRES,R3,300.00',
        '',
      ].join('\n'),
    );

    const res = await subir(
      await entorno.token(ANA, FERRETERIA),
      'con-nulo.csv',
      csv,
    ).expect(400);

    expect(mensaje(res)).toMatch(/^Línea 3: el archivo trae bytes nulos/);
    expect(await conteos()).toEqual(antes);
  });

  it('el mismo archivo dos veces: 200 yaExistia, sin movimientos duplicados', async () => {
    // Otra empresa que el primer test: el hash es por empresa.
    const token = await entorno.token(CARMEN, TRANSPORTES);
    const original = await cargarYEsperar(token, 'valido-5.csv');
    const antes = await conteos();

    const segunda = (
      await subir(token, 'valido-5.csv', fixture('valido-5.csv')).expect(200)
    ).body as RespuestaDeCarga;

    expect(segunda).toEqual({ ...original, yaExistia: true });
    expect(await conteos()).toEqual(antes);
  });

  it('dos filas idénticas son dos movimientos', async () => {
    const carga = await cargarYEsperar(
      await entorno.token(ANA, FERRETERIA),
      'filas-identicas.csv',
    );

    expect(carga).toMatchObject({ estado: 'procesada', registrosOk: 2 });
    const movimientos = await movimientosDe(carga.id);
    expect(movimientos.map((m) => m.linea_numero)).toEqual([2, 3]);
    const [a, b] = movimientos;
    expect({ ...a, linea_numero: 0 }).toEqual({ ...b, linea_numero: 0 });
  });

  it('una descripción con comas entre comillas se carga entera', async () => {
    const carga = await cargarYEsperar(
      await entorno.token(ANA, FERRETERIA),
      'descripcion-con-comas.csv',
    );

    expect(carga.estado).toBe('procesada');
    expect(await movimientosDe(carga.id)).toEqual([
      expect.objectContaining({
        descripcion: 'PAGO FACTURA A-1001, A-1002 Y A-1003, CLIENTE "EL NORTE"',
        referencia: 'F-1001',
        monto: '3000.0000',
      }),
    ]);
  });

  it('un revisor no sube: 403', async () => {
    await subir(
      await entorno.token(JORGE, TRANSPORTES),
      'valido-5.csv',
      fixture('valido-5.csv'),
    ).expect(403);
  });

  describe('límites → 400', () => {
    it('un archivo que no es .csv', async () => {
      const res = await subir(
        await entorno.token(ANA, FERRETERIA),
        'estado.txt',
        fixture('valido-5.csv'),
      ).expect(400);
      expect(mensaje(res)).toMatch(/\.csv/);
    });

    it('más de un archivo', async () => {
      const res = await subir(
        await entorno.token(ANA, FERRETERIA),
        'a.csv',
        fixture('valido-5.csv'),
      )
        .attach('archivo', fixture('filas-identicas.csv'), 'b.csv')
        .expect(400);
      expect(mensaje(res)).toMatch(/Máximo 1 archivo/);
    });

    // banco y cuenta se guardan en la carga durante el POST: lo que no cabe
    // en su columna tiene que ser 400 aquí, no un 500 de la base.
    it.each([
      ['banco', 'B'.repeat(129), /banco must be shorter than or equal to 128/],
      ['cuenta', '9'.repeat(33), /cuenta must be shorter than or equal to 32/],
      ['banco', 'BANCO\u0000X', /banco no puede traer bytes nulos/],
      ['cuenta', '****\u00001234', /cuenta no puede traer bytes nulos/],
    ])('%s = %j → 400 y cero cargas', async (campo, valor, esperado) => {
      const antes = await conteos();
      const res = await subir(
        await entorno.token(ANA, FERRETERIA),
        'unico.csv',
        // Un CSV que nunca se ha subido: con uno repetido, la idempotencia
        // respondería antes de guardar nada y el test no probaría el INSERT.
        Buffer.from(
          `fecha,descripcion,referencia,monto,moneda\n2026-09-01,DEPOSITO,${randomUUID()},1,MXN\n`,
        ),
        { [campo]: valor },
      ).expect(400);

      expect(JSON.stringify(res.body)).toMatch(esperado);
      expect(await conteos()).toEqual(antes);
    });
  });
});

describe('perfiles de banco (CU-10)', () => {
  /** Lo que queda de un movimiento al quitarle de dónde vino. */
  const normalizados = async (cargaId: string) =>
    (await movimientosDe(cargaId)).map(
      ({ fecha, descripcion, referencia, monto }) => ({
        fecha,
        descripcion,
        referencia,
        monto,
      }),
    );

  it('banco-norte: cargo negativo, abono positivo, montos exactos', async () => {
    const carga = await cargarYEsperar(
      await entorno.token(ANA, FERRETERIA),
      'norte-valido.csv',
      { perfil: 'banco-norte' },
    );

    expect(carga).toMatchObject({
      estado: 'procesada',
      totalRegistros: 4,
      registrosOk: 4,
    });
    expect(await normalizados(carga.id)).toEqual([
      {
        fecha: '2026-09-01',
        descripcion: 'DEPOSITO SPEI, CLIENTE NORTE',
        referencia: 'N-100',
        monto: '1234.5600',
      },
      expect.objectContaining({ fecha: '2026-09-02', monto: '-12.5000' }),
      expect.objectContaining({ fecha: '2026-09-03', monto: '-10000.0000' }),
      expect.objectContaining({ referencia: null, monto: '0.0100' }),
    ]);
    const { perfil } = await una<{ perfil: string }>(
      ds,
      'SELECT perfil FROM cargas WHERE id = $1',
      [carga.id],
    );
    expect(perfil).toBe('banco-norte');
  });

  it('banco-sur: windows-1252 con acentos bien decodificados y montos exactos', async () => {
    const carga = await cargarYEsperar(
      await entorno.token(ANA, FERRETERIA),
      'sur-valido.csv',
      { perfil: 'banco-sur' },
    );

    expect(carga).toMatchObject({ estado: 'procesada', registrosOk: 3 });
    const movimientos = await movimientosDe(carga.id);
    // Las líneas cuentan las 3 de preámbulo y el encabezado.
    expect(movimientos.map((m) => m.linea_numero)).toEqual([5, 6, 7]);
    expect(movimientos.map((m) => [m.descripcion, m.monto])).toEqual([
      ['Depósito en efectivo sucursal Mérida', '1234.5600'],
      ['Comisión por manejo de cuenta', '-99.9000'],
      ['Transferencia a Ñandú Logística', '-12000.0000'],
    ]);
  });

  it('el mismo contenido en los tres perfiles da los mismos movimientos', async () => {
    const token = await entorno.token(ANA, FERRETERIA);
    const resultados: Array<Awaited<ReturnType<typeof normalizados>>> = [];
    // Historia 3.5: el mismo contenido en la misma empresa y cuenta ya no se
    // vuelve a importar; una cuenta distinta por perfil lo mantiene separado.
    for (const [archivo, perfil, cuenta] of [
      ['logico-cuadra.csv', 'cuadra', 'P-1'],
      ['logico-norte.csv', 'banco-norte', 'P-2'],
      ['logico-sur.csv', 'banco-sur', 'P-3'],
    ]) {
      const carga = await cargarYEsperar(token, archivo, { perfil, cuenta });
      expect(carga.estado).toBe('procesada');
      resultados.push(await normalizados(carga.id));
    }

    const [cuadra, norte, sur] = resultados;
    expect(cuadra).toHaveLength(3);
    expect(norte).toEqual(cuadra);
    expect(sur).toEqual(cuadra);
    expect(cuadra[0]).toEqual({
      fecha: '2026-09-01',
      descripcion: 'Depósito de cliente, factura A-1',
      referencia: null,
      monto: '1234.5600',
    });
  });

  it('una fila con cargo y abono llenos es error de esa fila; el resto entra', async () => {
    const carga = await cargarYEsperar(
      await entorno.token(ANA, FERRETERIA),
      'norte-cargo-y-abono.csv',
      { perfil: 'banco-norte' },
    );

    expect(carga).toMatchObject({
      estado: 'con_errores',
      registrosOk: 2,
      registrosError: 1,
      resultados: [
        {
          fila: 3,
          resultado: 'error',
          motivo: 'La fila trae Cargo y Abono; debe traer solo uno',
        },
      ],
    });
    expect(
      (await movimientosDe(carga.id)).map((m) => [m.linea_numero, m.monto]),
    ).toEqual([
      [2, '100.0000'],
      [4, '-25.0000'],
    ]);
  });

  it('un error en banco-sur reporta la línea física, contando el preámbulo', async () => {
    const carga = await cargarYEsperar(
      await entorno.token(ANA, FERRETERIA),
      'sur-una-malformada.csv',
      { perfil: 'banco-sur' },
    );

    expect(carga).toMatchObject({ estado: 'con_errores', registrosOk: 2 });
    const [error] = carga.resultados as ResultadoDeFila[];
    // 3 de preámbulo + encabezado en la 4 + primera fila en la 5.
    expect(error).toMatchObject({ fila: 6, resultado: 'error' });
    expect(error.motivo).toMatch(
      /Fecha inválida: "31-09-2026"; se espera DD-MM-AAAA/,
    );
  });

  it('un perfil que no existe: 400 y cero cargas', async () => {
    const antes = await conteos();
    const res = await subir(
      await entorno.token(ANA, FERRETERIA),
      'norte-valido.csv',
      fixture('norte-valido.csv'),
      { perfil: 'banco-que-no-existe' },
    ).expect(400);

    expect(mensaje(res)).toMatch(
      /Perfil de banco desconocido: "banco-que-no-existe"\. Disponibles: .*banco-norte/,
    );
    expect(await conteos()).toEqual(antes);
  });

  it('encabezados que no coinciden con el perfil: 400 y cero cargas', async () => {
    const antes = await conteos();
    const res = await subir(
      await entorno.token(ANA, FERRETERIA),
      'norte-encabezados-mal.csv',
      fixture('norte-encabezados-mal.csv'),
      { perfil: 'banco-norte' },
    ).expect(400);

    expect(mensaje(res)).toMatch(
      /Encabezados inválidos para el perfil "banco-norte": se esperan exactamente "Fecha,Concepto,Referencia,Cargo,Abono,Saldo"/,
    );
    expect(await conteos()).toEqual(antes);
  });

  it('banco-sur guardado en UTF-8: 400 en vez de acentos rotos, y cero cargas', async () => {
    const antes = await conteos();
    const res = await subir(
      await entorno.token(ANA, FERRETERIA),
      'sur-valido-utf8.csv',
      fixture('sur-valido-utf8.csv'),
      { perfil: 'banco-sur' },
    ).expect(400);

    expect(mensaje(res)).toBe(
      'El archivo parece estar en UTF-8; el perfil banco-sur espera windows-1252',
    );
    expect(await conteos()).toEqual(antes);
  });

  it('un archivo de banco-sur subido sin perfil no pasa por el canónico', async () => {
    // Sin `perfil` se usa 'cuadra', que exige UTF-8: el 1252 de banco-sur
    // no se decodifica. Mejor 400 que acentos rotos.
    const res = await subir(
      await entorno.token(ANA, FERRETERIA),
      'sur-valido.csv',
      fixture('sur-valido.csv'),
    ).expect(400);
    expect(mensaje(res)).toMatch(/UTF-8/);
  });

  it('GET /bancos/perfiles: {id, nombre} de cada perfil, para quien puede cargar', async () => {
    // Ana es admin en Ferretería: sube, así que ve los perfiles.
    const res = await request(entorno.app.getHttpServer())
      .get('/bancos/perfiles')
      .set('Cookie', await entorno.token(ANA, FERRETERIA))
      .expect(200);

    expect(res.body).toEqual([
      { id: 'banco-norte', nombre: 'Banco del Norte (sintético)' },
      { id: 'banco-sur', nombre: 'Banco del Sur (sintético)' },
      { id: 'cuadra', nombre: 'Formato canónico de Cuadra' },
    ]);
  });

  it('GET /bancos/perfiles: un revisor no sube, así que 403 (cargas.cargar)', async () => {
    await request(entorno.app.getHttpServer())
      .get('/bancos/perfiles')
      .set('Cookie', await entorno.token(JORGE, TRANSPORTES))
      .expect(403);
  });
});

describe('POST /cargas/estado-cuenta, moneda obligatoria (historia 3.1)', () => {
  it('con la columna y todo en MXN (sin importar mayúsculas ni espacios): se procesa como siempre', async () => {
    const carga = await cargarYEsperar(
      await entorno.token(LUIS, FERRETERIA),
      'con-moneda-mxn.csv',
      // Otra cuenta: sus filas coinciden con las de valido-5.csv (3.5).
      { cuenta: 'MONEDA-1' },
    );

    expect(carga).toMatchObject({
      estado: 'procesada',
      totalRegistros: 3,
      registrosOk: 3,
      registrosError: 0,
    });
    expect((await movimientosDe(carga.id)).map((m) => m.monto)).toEqual([
      '4466.5800',
      '-12.5000',
      '-1500.0000',
    ]);
  });

  it('una fila que no es MXN: 400 con el motivo, sin carga ni movimientos', async () => {
    const antes = await conteos();

    const res = await subir(
      await entorno.token(LUIS, FERRETERIA),
      'con-moneda-usd.csv',
      fixture('con-moneda-usd.csv'),
    ).expect(400);

    expect(res.body).toMatchObject({
      statusCode: 400,
      error: 'moneda_no_mxn',
      message:
        'El estado de cuenta no está en MXN. Cuadra solo procesa estados de cuenta en pesos mexicanos.',
    });
    expect(await conteos()).toEqual(antes);
  });

  it('sin la columna en el encabezado: 400 moneda_faltante, sin carga ni movimientos', async () => {
    const antes = await conteos();

    const res = await subir(
      await entorno.token(LUIS, FERRETERIA),
      'sin-moneda.csv',
      Buffer.from(
        `fecha,descripcion,referencia,monto\n2026-09-06,SIN MONEDA,${randomUUID()},1.00\n`,
      ),
    ).expect(400);

    expect(res.body).toMatchObject({
      statusCode: 400,
      error: 'moneda_faltante',
    });
    expect(mensaje(res)).toMatch(/moneda/);
    expect(await conteos()).toEqual(antes);
  });

  it('una celda de moneda vacía: 400 moneda_faltante, sin carga ni movimientos', async () => {
    const antes = await conteos();

    const res = await subir(
      await entorno.token(LUIS, FERRETERIA),
      'moneda-vacia.csv',
      Buffer.from(
        `fecha,descripcion,referencia,monto,moneda\n2026-09-06,A,${randomUUID()},1.00,MXN\n2026-09-07,B,,2.00,\n`,
      ),
    ).expect(400);

    expect(res.body).toMatchObject({ error: 'moneda_faltante' });
    expect(await conteos()).toEqual(antes);
  });

  it('un MXN repetido responde yaExistia', async () => {
    const token = await entorno.token(LUIS, FERRETERIA);
    // Ya lo subió la primera prueba de este bloque.
    const repetida = await subir(
      token,
      'con-moneda-mxn.csv',
      fixture('con-moneda-mxn.csv'),
    ).expect(200);

    expect(repetida.body).toMatchObject({ yaExistia: true });
  });
});

describe('bitácora `cargar` del estado de cuenta (FR-52)', () => {
  it('una entrada con la persona, el archivo y los conteos; la repetida no suma otra', async () => {
    const token = await entorno.token(LUIS, FERRETERIA);
    const contenido = Buffer.from(
      `${fixture('una-malformada.csv').toString('utf8')}2026-09-07,PARA LA BITACORA,,2.00,MXN\n`,
    );
    const campos = { cuenta: 'BITACORA-1' };
    const res = await subir(
      token,
      'una-malformada.csv',
      contenido,
      campos,
    ).expect(202);
    const carga = await entorno.esperarFin(
      token,
      (res.body as RespuestaDeCarga).id,
    );
    await subir(token, 'una-malformada.csv', contenido, campos).expect(200);

    const entradas = await filas<{
      company_id: string;
      user_id: string;
      entidad: string;
      datos: Record<string, unknown>;
    }>(
      ds,
      `SELECT company_id, user_id, entidad, datos FROM bitacora
        WHERE accion = 'cargar' AND entidad_id = $1`,
      [carga.id],
    );
    expect(entradas).toEqual([
      {
        company_id: entorno.empresa(FERRETERIA),
        user_id: entorno.persona(LUIS),
        entidad: 'cargas',
        datos: {
          cargaId: carga.id,
          tipo: 'estado_cuenta',
          archivo: 'una-malformada.csv',
          estado: 'con_errores',
          registrosOk: carga.registrosOk,
          registrosExistentes: 0,
          registrosError: carga.registrosError,
          totalRegistros: carga.totalRegistros,
        },
      },
    ]);
  });
});

describe('reanudar una carga guardada sin la columna moneda (historia 3.1)', () => {
  /** Carga de estado de cuenta en espera, creada por fuera de la cola. */
  async function cargaSinMoneda(): Promise<string> {
    const [{ id }] = await filas<{ id: string }>(
      ds,
      `INSERT INTO cargas (company_id, tipo, estado, nombre_archivo,
         hash_archivo, total_registros, perfil)
       VALUES ($1, 'estado_cuenta', 'pendiente', 'sin-moneda.csv', $2, 1, 'cuadra')
       RETURNING id`,
      [entorno.empresa(FERRETERIA), randomUUID().replace(/-/g, '').repeat(2)],
    );
    await ds.query(
      `INSERT INTO carga_archivos (company_id, carga_id, orden, nombre, hash, contenido)
       VALUES ($1, $2, 0, 'sin-moneda.csv', $3, $4)`,
      [
        entorno.empresa(FERRETERIA),
        id,
        'b'.repeat(64),
        `fecha,descripcion,referencia,monto\n2026-09-01,DEPOSITO,${randomUUID()},1.00\n`,
      ],
    );
    return id;
  }

  function trabajo(cargaId: string, attemptsMade: number) {
    return {
      data: { cargaId, companyId: entorno.empresa(FERRETERIA) },
      attemptsMade,
      opts: { attempts: 3 },
    } as unknown as Job<TrabajoDeCarga>;
  }

  async function carga(id: string) {
    const [fila] = await filas<{
      estado: string;
      error_mensaje: string | null;
    }>(ds, 'SELECT estado, error_mensaje FROM cargas WHERE id = $1', [id]);
    return fila;
  }

  it('queda fallida de inmediato con el mensaje de moneda y sin reintentar', async () => {
    const id = await cargaSinMoneda();

    // Primer intento de tres: un error genérico no la marcaría fallida aún.
    await expect(
      entorno.app.get(ProcesadorCargas).process(trabajo(id, 0)),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    expect(await carga(id)).toEqual({
      estado: 'fallida',
      error_mensaje: MENSAJE_MONEDA_FALTANTE_AL_REANUDAR,
    });
    expect(MENSAJE_MONEDA_FALTANTE_AL_REANUDAR).toMatch(/moneda/);
    const [{ n }] = await filas<{ n: number }>(
      ds,
      'SELECT count(*)::int AS n FROM movimientos WHERE carga_id = $1',
      [id],
    );
    expect(n).toBe(0);
  });

  it('un error genérico sigue reintentando y termina con el mensaje genérico', async () => {
    const id = await cargaSinMoneda();
    const procesador = entorno.app.get(ProcesadorCargas);
    const espia = jest
      .spyOn(procesador, 'procesar')
      .mockRejectedValue(new Error('la base se cayó'));
    try {
      await expect(procesador.process(trabajo(id, 0))).rejects.toThrow(
        'la base se cayó',
      );
      expect((await carga(id)).estado).toBe('pendiente');

      await expect(procesador.process(trabajo(id, 2))).rejects.toThrow(
        'la base se cayó',
      );
      expect(await carga(id)).toEqual({
        estado: 'fallida',
        error_mensaje: MENSAJE_FALLIDA,
      });
    } finally {
      espia.mockRestore();
    }
  });
});

describe('movimientos repetidos entre archivos (historia 3.5, T5)', () => {
  const sufijo = () => randomUUID().slice(0, 8).toUpperCase();

  /** CSV canónico; la descripción cambia por archivo para que el hash difiera. */
  function csv(descripcion: string, filas: Array<[string, string, string]>) {
    return Buffer.from(
      [
        'fecha,descripcion,referencia,monto,moneda',
        ...filas.map(([f, ref, m]) => `${f},${descripcion},${ref},${m},MXN`),
        '',
      ].join('\n'),
    );
  }

  async function cargar(nombre: string, contenido: Buffer, cuenta?: string) {
    const token = await entorno.token(CARMEN, TRANSPORTES);
    const res = await subir(
      token,
      nombre,
      contenido,
      cuenta ? { cuenta } : {},
    ).expect(202);
    return entorno.esperarFin(token, (res.body as RespuestaDeCarga).id);
  }

  const estados = (cargaId: string) =>
    filas<{ estado: string; huella: string; referencia: string | null }>(
      ds,
      `SELECT estado, huella, referencia FROM movimientos
        WHERE carga_id = $1 ORDER BY linea_numero`,
      [cargaId],
    );

  it('otro archivo con filas ya cargadas: las cuenta como existentes y no las duplica', async () => {
    const [r1, r2, r3, r4] = [1, 2, 3, 4].map((i) => `T5A${i}-${sufijo()}`);
    const d = '2031-01-10';
    const uno = await cargar(
      `t5a-1-${r1}.csv`,
      csv('PRIMERO', [
        [d, r1, '10.00'],
        [d, r2, '20.00'],
        [d, r3, '30.00'],
      ]),
    );
    expect(uno).toMatchObject({ registrosOk: 3, registrosExistentes: 0 });

    const dos = await cargar(
      `t5a-2-${r1}.csv`,
      csv('SEGUNDO', [
        [d, r2, '20.00'],
        [d, r3, '30.00'],
        [d, r4, '40.00'],
      ]),
    );
    expect(dos).toMatchObject({
      estado: 'procesada',
      totalRegistros: 3,
      registrosOk: 1,
      registrosExistentes: 2,
      registrosError: 0,
      dudosos: 0,
    });
    expect((await estados(dos.id)).map((m) => m.referencia)).toEqual([r4]);
    const { n } = await una<{ n: number }>(
      ds,
      `SELECT count(*)::int AS n FROM movimientos
        WHERE company_id = $1 AND referencia = ANY($2)`,
      [entorno.empresa(TRANSPORTES), [r1, r2, r3, r4]],
    );
    expect(n).toBe(4);
  });

  it('misma huella con referencia cruda distinta: entra como pendiente_revision', async () => {
    const s = sufijo();
    const d = '2031-02-10';
    await cargar(`t5b-1-${s}.csv`, csv('PRIMERO', [[d, `AB-${s}`, '55.00']]));
    const dos = await cargar(
      `t5b-2-${s}.csv`,
      csv('SEGUNDO', [[d, `ab ${s.toLowerCase()}`, '55.00']]),
    );
    expect(dos).toMatchObject({
      registrosOk: 1,
      registrosExistentes: 0,
      dudosos: 1,
    });
    const [m] = await estados(dos.id);
    expect(m.estado).toBe('pendiente_revision');
    expect(m.huella).toBe(
      huellaMovimiento({
        cuenta: null,
        fecha: d,
        monto: '55.00',
        referencia: `ab ${s.toLowerCase()}`,
      }),
    );
  });

  it('dos filas idénticas con nada en la base entran las dos; luego 3 contra 2 deja 1 nueva', async () => {
    const s = `T5C-${sufijo()}`;
    const d = '2031-03-10';
    const fila: [string, string, string] = [d, s, '77.00'];
    const uno = await cargar(`t5c-1-${s}.csv`, csv('PRIMERO', [fila, fila]));
    expect(uno).toMatchObject({ registrosOk: 2, registrosExistentes: 0 });
    expect((await estados(uno.id)).map((m) => m.estado)).toEqual([
      'abierto',
      'abierto',
    ]);

    const dos = await cargar(
      `t5c-2-${s}.csv`,
      csv('SEGUNDO', [fila, fila, fila]),
    );
    expect(dos).toMatchObject({ registrosOk: 1, registrosExistentes: 2 });
  });

  it('la cuenta distingue: el mismo movimiento de otra cuenta es nuevo', async () => {
    const s = `T5D-${sufijo()}`;
    const fila: [string, string, string] = ['2031-04-10', s, '12.00'];
    await cargar(`t5d-1-${s}.csv`, csv('PRIMERO', [fila]), '1111');
    const dos = await cargar(`t5d-2-${s}.csv`, csv('SEGUNDO', [fila]), '2222');
    expect(dos).toMatchObject({ registrosOk: 1, registrosExistentes: 0 });
  });

  it('dos archivos distintos con los mismos movimientos a la vez: sin duplicar', async () => {
    const [r1, r2] = [1, 2].map((i) => `T5E${i}-${sufijo()}`);
    const d = '2031-05-10';
    const filasComunes: Array<[string, string, string]> = [
      [d, r1, '5.00'],
      [d, r2, '6.00'],
    ];
    const token = await entorno.token(CARMEN, TRANSPORTES);
    const respuestas = await Promise.all(
      ['UNO', 'DOS'].map((quien) =>
        subir(token, `t5e-${quien}-${r1}.csv`, csv(quien, filasComunes)),
      ),
    );
    const cargas = await Promise.all(
      respuestas.map((r) => {
        expect(r.status).toBe(202);
        return entorno.esperarFin(token, (r.body as RespuestaDeCarga).id);
      }),
    );
    expect(cargas.reduce((t, c) => t + c.registrosOk, 0)).toBe(2);
    expect(cargas.reduce((t, c) => t + c.registrosExistentes, 0)).toBe(2);
    const { n } = await una<{ n: number }>(
      ds,
      `SELECT count(*)::int AS n FROM movimientos
        WHERE company_id = $1 AND referencia = ANY($2)`,
      [entorno.empresa(TRANSPORTES), [r1, r2]],
    );
    expect(n).toBe(2);
  });
});
