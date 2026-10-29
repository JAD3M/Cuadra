import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { DataSource } from 'typeorm';
import { ColaCargas } from './cola-cargas';
import * as extractor from '../bancos/pdf/extraer-texto-pdf';
import { construirPdfSintetico } from '../bancos/pdf/pdf-sintetico';
import { filas, una } from '../database/testing/base-de-pruebas';
import request from '../testing/supertest-con-origen';
import {
  ANA,
  type AppDeCargas,
  CARMEN,
  FERRETERIA,
  JORGE,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from './testing/app-de-cargas';

/**
 * Historias 3.2 y 3.3: POST /cargas/estado-cuenta/pdf lee el PDF, comprueba
 * que los saldos cuadran y guarda lo que cuadra en la zona de espera; lo
 * demás se rechaza y deja bitácora. SINTÉTICO: el PDF de BBVA es el fixture
 * de la historia, no un estado de cuenta real.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
}, 60_000);

/**
 * La base de pruebas se comparte y la prueba de reversibilidad de migraciones
 * falla si quedan cargas en el estado nuevo o bitácoras sin entidad: cada
 * prueba parte de cero y la suite deja todo limpio.
 */
async function limpiar(): Promise<void> {
  await ds.query(`DELETE FROM movimientos_pendientes`);
  await ds.query(
    `DELETE FROM bitacora WHERE entidad = 'cargas'
        AND accion IN ('cargar', 'rechazar')`,
  );
  await ds.query(`DELETE FROM cargas WHERE estado = 'pendiente_vista_previa'`);
}

beforeEach(async () => {
  await limpiar();
});

afterAll(async () => {
  if (ds?.isInitialized) await limpiar();
  await entorno?.cerrar();
});

const BBVA = readFileSync(
  join(__dirname, '..', 'bancos', 'fixtures', 'bbva-sintetico.pdf'),
);

const ENCABEZADO = (moneda: string) => [
  'Periodo DEL 01/10/2026 AL 31/10/2026',
  `Moneda ${moneda}`,
  'Saldo Anterior 10,000.00',
  'Saldo Final 11,250.50',
];

function subir(
  token: string | null,
  nombre: string,
  contenido: Buffer,
  banco: string | null = 'bbva',
) {
  let req = request(entorno.app.getHttpServer()).post(
    '/cargas/estado-cuenta/pdf',
  );
  if (token) req = req.set('Cookie', token);
  if (banco !== null) req = req.field('banco', banco);
  return req.attach('archivo', contenido, nombre);
}

async function conteos() {
  return una<{
    cargas: number;
    movimientos: number;
    pendientes: number;
    bitacora: number;
  }>(
    ds,
    `SELECT (SELECT count(*)::int FROM cargas) AS cargas,
            (SELECT count(*)::int FROM movimientos) AS movimientos,
            (SELECT count(*)::int FROM movimientos_pendientes) AS pendientes,
            (SELECT count(*)::int FROM bitacora
               WHERE accion NOT IN ('acceso_denegado')) AS bitacora`,
  );
}

/** La bitácora de cargas de una empresa, la más vieja primero. */
function bitacoraDeCargas(accion: string, companyId?: string) {
  return filas<{
    user_id: string;
    entidad_id: string | null;
    datos: Record<string, unknown>;
  }>(
    ds,
    `SELECT user_id, entidad_id, datos FROM bitacora
      WHERE entidad = 'cargas' AND accion = $1
        AND ($2::uuid IS NULL OR company_id = $2)
      ORDER BY created_at, id`,
    [accion, companyId ?? null],
  );
}

// SINTÉTICO: variantes del fixture. Los saldos del encabezado son 10,000.00 y
// 11,250.50; el saldo corrido de las líneas decide el signo de cada monto.
const pdf = (...lineas: string[]) =>
  construirPdfSintetico([...ENCABEZADO('MXN'), ...lineas]);
const NO_CUADRA = pdf(
  '02/OCT 02/OCT PAGO PROVEEDOR 2,000.00 8,000.00',
  '15/OCT 15/OCT DEPOSITO CLIENTE 3,000.00 11,000.00',
);
const CON_LINEA_SUELTA = pdf(
  '02/OCT 02/OCT PAGO PROVEEDOR 2,000.00 8,000.00',
  'texto-suelto-SECRETO-123 que no es movimiento',
  '15/OCT 15/OCT DEPOSITO CLIENTE 3,250.50 11,250.50',
);

const cuerpo = (res: { body: unknown }) =>
  res.body as { message: string; error?: string };

describe('POST /cargas/estado-cuenta/pdf (historia 3.2)', () => {
  it('el PDF sintético cuadra: lo guarda en la zona de espera', async () => {
    const cola = entorno.app.get(ColaCargas);
    const encolar = jest.spyOn(cola, 'encolar');
    try {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'bbva.pdf',
        BBVA,
      ).expect(200);

      expect(res.body).toEqual({
        banco: 'bbva',
        saldoInicial: '10000.00',
        saldoFinal: '11250.50',
        movimientosLeidos: 2,
        lineasNoLeidas: 0,
        cargaId: expect.any(String) as unknown,
        estado: 'pendiente_vista_previa',
        yaExistia: false,
      });
      const { cargaId } = res.body as { cargaId: string };
      const carga = await una<Record<string, unknown>>(
        ds,
        `SELECT * FROM cargas WHERE id = $1`,
        [cargaId],
      );
      expect(carga).toMatchObject({
        company_id: entorno.empresa(FERRETERIA),
        tipo: 'estado_cuenta',
        estado: 'pendiente_vista_previa',
        nombre_archivo: 'bbva.pdf',
        hash_archivo: createHash('sha256').update(BBVA).digest('hex'),
        total_registros: 2,
        registros_ok: 0,
        registros_existentes: 0,
        registros_error: 0,
        subido_por_id: entorno.persona(LUIS),
        banco: 'bbva',
      });
      const pendientes = await filas<Record<string, unknown>>(
        ds,
        `SELECT company_id, linea_numero, fecha::text AS fecha, descripcion,
                referencia, monto::text AS monto, moneda, banco, cuenta
           FROM movimientos_pendientes WHERE carga_id = $1
          ORDER BY linea_numero`,
        [cargaId],
      );
      expect(pendientes).toEqual([
        {
          company_id: entorno.empresa(FERRETERIA),
          linea_numero: 1,
          fecha: '2026-10-02',
          descripcion: 'PAGO PROVEEDOR SINTETICO',
          referencia: null,
          monto: '-250.0000',
          moneda: 'MXN',
          banco: 'bbva',
          cuenta: null,
        },
        {
          company_id: entorno.empresa(FERRETERIA),
          linea_numero: 2,
          fecha: '2026-10-15',
          descripcion: 'DEPOSITO CLIENTE SINTETICO',
          referencia: 'SINT-0001',
          monto: '1500.5000',
          moneda: 'MXN',
          banco: 'bbva',
          cuenta: null,
        },
      ]);
      // Sin movimientos definitivos, sin carga_archivos (no se guarda el PDF)
      // y sin job: el worker no toma este estado.
      expect(
        await una<{ n: number }>(
          ds,
          `SELECT count(*)::int AS n FROM carga_archivos WHERE carga_id = $1`,
          [cargaId],
        ),
      ).toEqual({ n: 0 });
      expect((await conteos()).movimientos).toBe(0);
      expect(encolar).not.toHaveBeenCalled();

      const cargar = await bitacoraDeCargas('cargar');
      expect(cargar).toHaveLength(1);
      expect(cargar[0]).toMatchObject({
        user_id: entorno.persona(LUIS),
        entidad_id: cargaId,
        datos: {
          archivo: 'bbva.pdf',
          estado: 'pendiente_vista_previa',
          totalRegistros: 2,
        },
      });
    } finally {
      encolar.mockRestore();
    }
  });

  it('resubir el mismo PDF devuelve la carga existente, sin duplicar', async () => {
    const token = await entorno.token(LUIS, FERRETERIA);
    const primera = await subir(token, 'bbva.pdf', BBVA).expect(200);
    const antes = await conteos();
    const segunda = await subir(token, 'otro-nombre.pdf', BBVA).expect(200);

    expect(segunda.body).toMatchObject({
      cargaId: (primera.body as { cargaId: string }).cargaId,
      estado: 'pendiente_vista_previa',
      yaExistia: true,
    });
    expect(await conteos()).toEqual(antes);
  });

  it('dos subidas simultáneas del mismo PDF dejan una sola carga', async () => {
    const token = await entorno.token(LUIS, FERRETERIA);
    const [a, b] = await Promise.all([
      subir(token, 'bbva.pdf', BBVA).expect(200),
      subir(token, 'bbva.pdf', BBVA).expect(200),
    ]);
    const ids = [a, b].map((r) => (r.body as { cargaId: string }).cargaId);
    expect(ids[0]).toBe(ids[1]);
    expect(
      [a, b].filter((r) => (r.body as { yaExistia: boolean }).yaExistia),
    ).toHaveLength(1);
    const despues = await conteos();
    expect(despues.cargas).toBe(1);
    expect(despues.pendientes).toBe(2);
    expect(await bitacoraDeCargas('cargar')).toHaveLength(1);
  });

  it('otra empresa con los mismos bytes guarda su propia carga', async () => {
    const a = await subir(
      await entorno.token(LUIS, FERRETERIA),
      'bbva.pdf',
      BBVA,
    ).expect(200);
    const b = await subir(
      await entorno.token(CARMEN, TRANSPORTES),
      'bbva.pdf',
      BBVA,
    ).expect(200);
    const [idA, idB] = [a, b].map(
      (r) =>
        r.body as {
          cargaId: string;
          yaExistia: boolean;
        },
    );
    expect(idB.yaExistia).toBe(false);
    expect(idB.cargaId).not.toBe(idA.cargaId);
    const porEmpresa = await filas<{ company_id: string; n: number }>(
      ds,
      `SELECT company_id, count(*)::int AS n FROM movimientos_pendientes
        GROUP BY company_id`,
    );
    expect(porEmpresa).toHaveLength(2);
    expect(porEmpresa.every((f) => f.n === 2)).toBe(true);
  });

  describe('rechazo: sin carga ni movimientos, con bitácora', () => {
    it('saldos que no cuadran: 400 con motivo, líneas, esperado y diferencia', async () => {
      const antes = await conteos();
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'no-cuadra.pdf',
        NO_CUADRA,
      ).expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'saldos_no_cuadran',
        // Como en `cuadrarSaldos`: texto decimal sin ceros finales.
        saldoEsperado: '11000',
        diferencia: '250.5',
        lineasNoLeidas: [],
      });
      expect(cuerpo(res).message).toMatch(/saldos/i);
      const despues = await conteos();
      expect(despues.cargas).toBe(antes.cargas);
      expect(despues.pendientes).toBe(0);
      expect(despues.movimientos).toBe(antes.movimientos);

      // La petición terminó en 400 (su transacción se revirtió) y la entrada
      // sigue ahí: se escribió en una transacción propia.
      const rechazos = await bitacoraDeCargas('rechazar');
      expect(rechazos).toHaveLength(1);
      expect(rechazos[0]).toEqual({
        user_id: entorno.persona(LUIS),
        entidad_id: null,
        datos: {
          archivo: 'no-cuadra.pdf',
          banco: 'bbva',
          motivo: 'saldos_no_cuadran',
          movimientosLeidos: 2,
          lineasNoLeidas: 0,
        },
      });
    });

    it('saldos que cuadran pero con una línea no leída: 400 con la línea', async () => {
      const antes = await conteos();
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'suelta.pdf',
        CON_LINEA_SUELTA,
      ).expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'lineas_no_leidas',
        lineasNoLeidas: [
          { linea: 6, texto: 'texto-suelto-SECRETO-123 que no es movimiento' },
        ],
      });
      expect(res.body).not.toHaveProperty('diferencia');
      expect(await conteos()).toEqual({
        ...antes,
        bitacora: antes.bitacora + 1,
      });
      const [rechazo] = await bitacoraDeCargas('rechazar');
      expect(rechazo.datos).toEqual({
        archivo: 'suelta.pdf',
        banco: 'bbva',
        motivo: 'lineas_no_leidas',
        movimientosLeidos: 2,
        lineasNoLeidas: 1,
      });
      // Nunca el contenido del archivo en la bitácora.
      expect(JSON.stringify(rechazo.datos)).not.toMatch(/SECRETO|PROVEEDOR/);
    });

    it.each([
      ['pdf_sin_texto', 'a.pdf', () => construirPdfSintetico([])],
      ['pdf_ilegible', 'b.pdf', () => Buffer.from('%PDF-1.4 roto')],
      [
        'moneda_no_mxn',
        'c.pdf',
        () => construirPdfSintetico(ENCABEZADO('USD')),
      ],
    ])(
      'el rechazo de lectura %s también queda en la bitácora',
      async (codigo, nombre, armar) => {
        const antes = await conteos();
        await subir(
          await entorno.token(LUIS, FERRETERIA),
          nombre,
          armar(),
        ).expect(400);
        const despues = await conteos();
        expect(despues.cargas).toBe(antes.cargas);
        expect(despues.pendientes).toBe(0);
        const rechazos = await bitacoraDeCargas('rechazar');
        expect(rechazos).toHaveLength(1);
        expect(rechazos[0]).toMatchObject({
          user_id: entorno.persona(LUIS),
          entidad_id: null,
          datos: { archivo: nombre, banco: 'bbva', motivo: codigo },
        });
      },
    );

    it('un PDF rechazado se puede volver a subir', async () => {
      const token = await entorno.token(LUIS, FERRETERIA);
      await subir(token, 'no-cuadra.pdf', NO_CUADRA).expect(400);
      await subir(token, 'no-cuadra.pdf', NO_CUADRA).expect(400);
      expect(await bitacoraDeCargas('rechazar')).toHaveLength(2);
      expect((await conteos()).cargas).toBe(0);
    });

    it('la bitácora del rechazo es de la empresa de quien sube', async () => {
      await subir(
        await entorno.token(CARMEN, TRANSPORTES),
        'no-cuadra.pdf',
        NO_CUADRA,
      ).expect(400);
      expect(
        await bitacoraDeCargas('rechazar', entorno.empresa(FERRETERIA)),
      ).toEqual([]);
      expect(
        await bitacoraDeCargas('rechazar', entorno.empresa(TRANSPORTES)),
      ).toHaveLength(1);
    });
  });

  it('un admin también lee', async () => {
    await subir(await entorno.token(ANA, FERRETERIA), 'bbva.pdf', BBVA).expect(
      200,
    );
  });

  it('sin sesión: 401', async () => {
    await subir(null, 'bbva.pdf', BBVA).expect(401);
  });

  it('un revisor no sube: 403', async () => {
    await subir(
      await entorno.token(JORGE, TRANSPORTES),
      'bbva.pdf',
      BBVA,
    ).expect(403);
  });

  it('un auditor no sube: 403', async () => {
    const empresa = entorno.empresa(FERRETERIA);
    const cambiar = (rol: string) =>
      ds.query(
        `UPDATE user_company_roles SET rol = $3
          WHERE user_id = $1 AND company_id = $2`,
        [entorno.persona(LUIS), empresa, rol],
      );
    const token = await entorno.token(LUIS, FERRETERIA);
    await cambiar('auditor');
    try {
      await subir(token, 'bbva.pdf', BBVA).expect(403);
    } finally {
      await cambiar('contador');
    }
  });

  describe('rechazos con código estable → 400', () => {
    it('PDF sin texto (escaneado): pdf_sin_texto', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'escaneado.pdf',
        construirPdfSintetico([]),
      ).expect(400);
      expect(cuerpo(res).error).toBe('pdf_sin_texto');
      expect(cuerpo(res).message).toMatch(/portal del banco/);
    });

    it('bytes que no son PDF con nombre .pdf: pdf_ilegible', async () => {
      const antes = await conteos();
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'falso.pdf',
        Buffer.from('fecha,descripcion,referencia,monto\n'),
      ).expect(400);
      expect(cuerpo(res).error).toBe('pdf_ilegible');
      expect(await conteos()).toEqual(antes);
    });

    it('archivo de 3 bytes (más corto que la firma): pdf_ilegible', async () => {
      const antes = await conteos();
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'corto.pdf',
        Buffer.from('%PD'),
      ).expect(400);
      expect(cuerpo(res).error).toBe('pdf_ilegible');
      expect(await conteos()).toEqual(antes);
    });

    it('archivo vacío (0 bytes): 400, nunca 5xx', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'vacio0.pdf',
        Buffer.alloc(0),
      ).expect(400);
      expect(cuerpo(res).message).toMatch(/archivo|PDF/i);
    });

    it('PDF truncado con la firma correcta: pdf_ilegible', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'truncado.pdf',
        BBVA.subarray(0, 120),
      ).expect(400);
      expect(cuerpo(res).error).toBe('pdf_ilegible');
    });

    it('moneda distinta de MXN: moneda_no_mxn', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'usd.pdf',
        construirPdfSintetico(ENCABEZADO('USD')),
      ).expect(400);
      expect(cuerpo(res).error).toBe('moneda_no_mxn');
    });

    it('sin periodo ni saldos: 400 con su mensaje, sin código', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'vacio.pdf',
        construirPdfSintetico(['Moneda MXN', 'Hola']),
      ).expect(400);
      expect(cuerpo(res).message).toMatch(/periodo o los saldos/);
    });
  });

  describe('límites → 400', () => {
    it('extensión .csv', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'estado.csv',
        BBVA,
      ).expect(400);
      expect(cuerpo(res).message).toMatch(/\.pdf/);
    });

    it('más de un archivo', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'a.pdf',
        BBVA,
      )
        .attach('archivo', BBVA, 'b.pdf')
        .expect(400);
      expect(cuerpo(res).message).toMatch(/Máximo 1 archivo/);
    });

    it('sin archivo', async () => {
      await request(entorno.app.getHttpServer())
        .post('/cargas/estado-cuenta/pdf')
        .set('Cookie', await entorno.token(LUIS, FERRETERIA))
        .field('banco', 'bbva')
        .expect(400);
    });

    it('más de 10 MB', async () => {
      const grande = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.alloc(10 * 1024 * 1024 + 1, 0x20),
      ]);
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'grande.pdf',
        grande,
      ).expect(400);
      expect(cuerpo(res).message).toMatch(/10 MB/);
    });

    it('banco desconocido', async () => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'bbva.pdf',
        BBVA,
        'banamex',
      ).expect(400);
      expect(cuerpo(res).message).toMatch(/Banco no soportado.*bbva/);
    });

    it.each([
      ['vacío', ''],
      ['solo espacios', '   '],
    ])('banco %s: 400 "falta el banco"', async (_nombre, banco) => {
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'bbva.pdf',
        BBVA,
        banco,
      ).expect(400);
      expect(JSON.stringify(cuerpo(res).message)).toMatch(/Falta el banco/);
    });

    it('sin banco', async () => {
      await subir(
        await entorno.token(LUIS, FERRETERIA),
        'bbva.pdf',
        BBVA,
        null,
      ).expect(400);
    });
  });

  it('error inesperado del lector: 500 genérico, sin filtrar nada ni guardar', async () => {
    const secreto = 'SECRETO-INTERNO-del-lector';
    const espia = jest
      .spyOn(extractor, 'extraerTextoPdf')
      .mockRejectedValueOnce(new Error(secreto));
    try {
      const antes = await conteos();
      const res = await subir(
        await entorno.token(LUIS, FERRETERIA),
        'bbva.pdf',
        BBVA,
      ).expect(500);
      expect(espia).toHaveBeenCalledTimes(1);
      const texto = JSON.stringify(res.body) + res.text;
      expect(texto).not.toContain(secreto);
      expect(texto).not.toMatch(/stack|at .*\.ts|BBVA/i);
      expect(res.body).toEqual({
        statusCode: 500,
        message: 'Internal server error',
      });
      expect(await conteos()).toEqual(antes);
    } finally {
      espia.mockRestore();
    }
  });
});
