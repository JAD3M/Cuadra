import { randomUUID } from 'crypto';
import request from '../testing/supertest-con-origen';
import type { DataSource } from 'typeorm';
import {
  ANA,
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import type { RespuestaCasoDto } from '../casos/dto/caso.dto';
import { sembrarDecision } from '../conciliacion/siembra-decisiones';
import type { ComentarioDto } from './dto/comentar.dto';
import { filas, una } from '../database/testing/base-de-pruebas';

/**
 * Historia 5.9 (FR-68) de punta a punta contra Postgres real con RLS:
 * POST /conciliaciones/:id/comentarios y los comentarios de GET /casos/:id.
 * Luis es contador en Ferretería; las pruebas lo vuelven revisor o auditor.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let B: string;
let tokenAna: string;
let tokenLuis: string;
let linea = 0;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  B = entorno.empresa(TRANSPORTES);
  tokenAna = await entorno.token(ANA, FERRETERIA);
  tokenLuis = await entorno.token(LUIS, FERRETERIA);
}, 60_000);

afterAll(async () => {
  await restaurar();
  await entorno?.cerrar();
});

beforeEach(async () => {
  await restaurar();
  await ds.query(
    'TRUNCATE cfdi, cargas, movimientos, decisiones, decision_lineas, decision_comentarios, bitacora CASCADE',
  );
});

async function restaurar() {
  if (!ds?.isInitialized) return;
  await ds.query(
    `UPDATE user_company_roles SET rol = 'contador'
      WHERE user_id = $1 AND company_id = $2`,
    [entorno.persona(LUIS), A],
  );
}

async function comoRol(rol: string) {
  await ds.query(
    `UPDATE user_company_roles SET rol = $3
      WHERE user_id = $1 AND company_id = $2`,
    [entorno.persona(LUIS), A, rol],
  );
}

async function confirmada(empresa = A) {
  const { id: movimientoId } = await una<{ id: string }>(
    ds,
    `INSERT INTO movimientos (company_id, carga_id, linea_numero, fecha, descripcion, monto, estado)
     VALUES ($1,NULL,$2,'2026-09-02','SPEI RECIBIDO','1160.00','conciliado') RETURNING id`,
    [empresa, linea++],
  );
  const { id: cfdiId } = await una<{ id: string }>(
    ds,
    `INSERT INTO cfdi (company_id, carga_id, uuid_fiscal, rfc_emisor, rfc_receptor, serie, folio,
                       fecha_emision, tipo_comprobante, moneda, subtotal, total, estado,
                       metodo_pago, xml_raw)
     VALUES ($1,NULL,$2,$3,'XAXX010101000','A','1001','2026-09-01T10:00:00','I','MXN',
             1160,1160,'conciliada','PUE','{"_xml":"<x/>"}'::jsonb) RETURNING id`,
    [empresa, randomUUID(), FERRETERIA],
  );
  const id = await sembrarDecision(ds, {
    companyId: empresa,
    movimientoId,
    cfdiId,
    estado: 'confirmada',
    origen: 'regla',
    regla: 'monto_unico',
    score: '0.9000',
    diferenciaMonto: '0.0000',
    motivo: 'Motivo de la propuesta',
    confirmadaPorId: entorno.persona(LUIS),
  });
  return { id, cfdiId, movimientoId };
}

const comentar = (
  id: string,
  token = tokenAna,
  cuerpo: object = { texto: 'x' },
) =>
  request(entorno.app.getHttpServer())
    .post(`/conciliaciones/${id}/comentarios`)
    .set('Cookie', token)
    .send(cuerpo);

const caso = (movimientoId: string, token = tokenAna) =>
  request(entorno.app.getHttpServer())
    .get(`/casos/${movimientoId}`)
    .set('Cookie', token);

const leerCaso = async (movimientoId: string, token = tokenAna) =>
  (await caso(movimientoId, token).expect(200)).body as RespuestaCasoDto;

const comentarios = () =>
  filas<{
    company_id: string;
    decision_id: string;
    autor_id: string;
    texto: string;
  }>(
    ds,
    `SELECT company_id, decision_id, autor_id, texto FROM decision_comentarios ORDER BY created_at`,
  );

const bitacora = () =>
  filas<{
    user_id: string;
    entidad: string;
    entidad_id: string;
    datos: Record<string, unknown>;
  }>(
    ds,
    `SELECT user_id, entidad, entidad_id, datos FROM bitacora WHERE accion = 'comentar'`,
  );

const mensajes = (cuerpo: { message?: string | string[] }) =>
  ([] as string[]).concat(cuerpo.message ?? []);

describe('POST /conciliaciones/:id/comentarios', () => {
  it('guarda el comentario con persona y fecha, lo deja en la bitácora y no cambia nada de la decisión', async () => {
    const { id, cfdiId, movimientoId } = await confirmada();

    const res = await comentar(id, tokenAna, {
      texto: '  Creo que esta factura no corresponde  ',
    }).expect(201);
    const creado = res.body as ComentarioDto;

    const ana = await una<{ nombre: string }>(
      ds,
      `SELECT nombre FROM users WHERE id = $1`,
      [entorno.persona(ANA)],
    );
    expect(Object.keys(creado).sort()).toEqual([
      'decisionId',
      'fecha',
      'id',
      'por',
      'texto',
    ]);
    expect(creado.decisionId).toBe(id);
    expect(creado.texto).toBe('Creo que esta factura no corresponde');
    expect(creado.por).toBe(ana.nombre);
    expect(Number.isNaN(Date.parse(creado.fecha))).toBe(false);
    expect(await comentarios()).toEqual([
      {
        company_id: A,
        decision_id: id,
        autor_id: entorno.persona(ANA),
        texto: 'Creo que esta factura no corresponde',
      },
    ]);
    const auditoria = await bitacora();
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({
      user_id: entorno.persona(ANA),
      entidad: 'decisiones',
      entidad_id: id,
    });
    expect(auditoria[0].datos).toMatchObject({
      comentarioId: creado.id,
      texto: 'Creo que esta factura no corresponde',
    });

    // No reabre, rechaza ni edita nada.
    const decision = await una<{ estado: string; motivo: string }>(
      ds,
      `SELECT estado, motivo FROM decisiones WHERE id = $1`,
      [id],
    );
    expect(decision).toEqual({
      estado: 'confirmada',
      motivo: 'Motivo de la propuesta',
    });
    expect(
      (
        await una<{ estado: string }>(
          ds,
          `SELECT estado FROM cfdi WHERE id = $1`,
          [cfdiId],
        )
      ).estado,
    ).toBe('conciliada');
    expect(
      (
        await una<{ estado: string }>(
          ds,
          `SELECT estado FROM movimientos WHERE id = $1`,
          [movimientoId],
        )
      ).estado,
    ).toBe('conciliado');
  });

  it('un revisor también puede comentar la confirmación de otra persona', async () => {
    const { id } = await confirmada();
    await comoRol('revisor');

    await comentar(id, tokenLuis, { texto: 'No me convence' }).expect(201);

    expect(await comentarios()).toHaveLength(1);
  });

  it.each([[''], ['   '], ['\n\t']])(
    'un texto vacío (%j) se rechaza con un mensaje claro y no guarda nada',
    async (texto) => {
      const { id } = await confirmada();

      const res = await comentar(id, tokenAna, { texto }).expect(400);

      expect(mensajes(res.body as { message?: string | string[] })).toContain(
        'El comentario no puede estar vacío',
      );
      expect(await comentarios()).toEqual([]);
      expect(await bitacora()).toEqual([]);
    },
  );

  it('rechaza un texto de más de 1000 caracteres y uno que no es texto', async () => {
    const { id } = await confirmada();

    await comentar(id, tokenAna, { texto: 'a'.repeat(1001) }).expect(400);
    await comentar(id, tokenAna, { texto: 42 }).expect(400);
    await comentar(id, tokenAna, {}).expect(400);

    await comentar(id, tokenAna, { texto: 'a'.repeat(1000) }).expect(201);
    expect(await comentarios()).toHaveLength(1);
  });

  it('un auditor recibe 403 con acceso denegado y no se guarda nada', async () => {
    const { id } = await confirmada();
    await comoRol('auditor');

    await comentar(id, tokenLuis, { texto: 'Hola' }).expect(403);

    expect(await comentarios()).toEqual([]);
    expect(await bitacora()).toEqual([]);
    const denegados = await filas<{ user_id: string }>(
      ds,
      `SELECT user_id FROM bitacora WHERE accion = 'acceso_denegado' AND company_id = $1`,
      [A],
    );
    expect(denegados.map((d) => d.user_id)).toEqual([entorno.persona(LUIS)]);
  });

  it('una decisión que no existe o es de otra empresa da 404 y no guarda nada', async () => {
    const ajena = await confirmada(B);

    await comentar(randomUUID()).expect(404);
    await comentar(ajena.id).expect(404);
    await comentar('no-es-un-uuid').expect(400);

    expect(await comentarios()).toEqual([]);
    expect(await bitacora()).toEqual([]);
  });

  it('cuadra_app solo puede leer y agregar: un comentario no se edita ni se borra', async () => {
    const privilegios = await filas<{ privilege_type: string }>(
      ds,
      `SELECT privilege_type FROM information_schema.role_table_grants
        WHERE grantee = 'cuadra_app' AND table_name = 'decision_comentarios'
        ORDER BY privilege_type`,
    );
    expect(privilegios.map((p) => p.privilege_type)).toEqual([
      'INSERT',
      'SELECT',
    ]);
  });
});

describe('GET /casos/:movimientoId con comentarios', () => {
  it('trae los comentarios en orden, con quién y cuándo, y puedeComentar según el rol', async () => {
    const { id, movimientoId } = await confirmada();
    await comentar(id, tokenAna, { texto: 'Primero' }).expect(201);
    await comentar(id, tokenAna, { texto: 'Segundo' }).expect(201);

    const admin = await leerCaso(movimientoId);
    expect(admin.comentarios.map((c) => c.texto)).toEqual([
      'Primero',
      'Segundo',
    ]);
    const primero = admin.comentarios[0];
    expect(Object.keys(primero).sort()).toEqual([
      'decisionId',
      'fecha',
      'id',
      'por',
      'texto',
    ]);
    expect(primero.decisionId).toBe(id);
    expect(primero.por.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(primero.fecha))).toBe(false);
    expect(admin.puedeComentar).toBe(true);

    await comoRol('auditor');
    const auditor = await leerCaso(movimientoId, tokenLuis);
    expect(auditor.comentarios).toHaveLength(2);
    expect(auditor.puedeComentar).toBe(false);
  });

  it('un caso sin comentarios trae una lista vacía y los de otra empresa no se ven', async () => {
    const propio = await confirmada();
    const ajeno = await confirmada(B);
    await ds.query(
      `INSERT INTO decision_comentarios (company_id, decision_id, autor_id, texto)
       VALUES ($1,$2,$3,'De otra empresa')`,
      [B, ajeno.id, entorno.persona(ANA)],
    );

    const res = await leerCaso(propio.movimientoId);

    expect(res.comentarios).toEqual([]);
    await caso(ajeno.movimientoId).expect(404);
  });
});

describe('inyecciones en el texto del comentario (5.9)', () => {
  const CARGAS_HOSTILES = [
    "'); DROP TABLE decision_comentarios; --",
    "' OR '1'='1",
    "x'; UPDATE decisiones SET estado = 'rechazada'; --",
    '$1 $2 $$ \\ \' "',
    '<script>alert(1)</script>',
    '<img src=x onerror="alert(document.cookie)">',
    'javascript:alert(1)',
    '{{7*7}} ${7*7} #{7*7} %s %n',
    '../../../etc/passwd',
    'a\u202Eb\u2028c\u2029d',
    '{"texto":"anidado","autorId":"x"}',
  ];

  it.each(CARGAS_HOSTILES.map((c) => [c]))(
    'se guarda y se devuelve literal, sin ejecutarse: %j',
    async (carga) => {
      const { id, movimientoId } = await confirmada();

      const res = await comentar(id, tokenAna, { texto: carga }).expect(201);

      expect((res.body as ComentarioDto).texto).toBe(carga.trim());
      expect(res.headers['content-type']).toMatch(/^application\/json/);
      // La tabla sigue ahí y la decisión no cambió.
      expect(await comentarios()).toHaveLength(1);
      expect(
        (
          await una<{ estado: string }>(
            ds,
            `SELECT estado FROM decisiones WHERE id = $1`,
            [id],
          )
        ).estado,
      ).toBe('confirmada');
      // La bitácora lo guarda literal en el JSON.
      const auditoria = await bitacora();
      expect(auditoria).toHaveLength(1);
      expect(auditoria[0].datos.texto).toBe(carga.trim());
      // Y el detalle del caso lo devuelve igual.
      const detalle = await leerCaso(movimientoId);
      expect(detalle.comentarios.map((c) => c.texto)).toEqual([carga.trim()]);
    },
  );

  it('un carácter nulo (\\u0000) es un 400 claro, no un 500, y no guarda nada', async () => {
    const { id } = await confirmada();

    const res = await comentar(id, tokenAna, { texto: 'a\u0000b' }).expect(400);

    expect(mensajes(res.body as { message?: string | string[] })).toContain(
      'El comentario contiene caracteres no válidos',
    );
    expect(await comentarios()).toEqual([]);
    expect(await bitacora()).toEqual([]);
  });

  it('campos de más (autor, empresa, decisión) se rechazan: no se pueden falsear', async () => {
    const { id } = await confirmada();
    const ajena = await confirmada(B);

    await comentar(id, tokenAna, {
      texto: 'hola',
      autorId: entorno.persona(LUIS),
    }).expect(400);
    await comentar(id, tokenAna, { texto: 'hola', companyId: B }).expect(400);
    await comentar(id, tokenAna, {
      texto: 'hola',
      decisionId: ajena.id,
    }).expect(400);
    await comentar(id, tokenAna, {
      texto: 'hola',
      createdAt: '2000-01-01T00:00:00Z',
    }).expect(400);

    expect(await comentarios()).toEqual([]);
  });

  it.each([
    [{ texto: ['a'] }],
    [{ texto: { $ne: '' } }],
    [{ texto: null }],
    [{ texto: true }],
    [JSON.parse('{"__proto__": {"texto": "x"}}') as object],
    [[]],
  ])(
    'un cuerpo que no es el esperado (%j) da 400 y no guarda nada',
    async (cuerpo) => {
      const { id } = await confirmada();

      await comentar(id, tokenAna, cuerpo).expect(400);

      expect(await comentarios()).toEqual([]);
      expect(await bitacora()).toEqual([]);
    },
  );

  it('un id con SQL en la ruta da 400 antes de tocar la base', async () => {
    await comentar("x'; DROP TABLE decisiones; --").expect(400);
    await comentar('0192a3f4-8c1e-7b2d-9f10-3e5c41a2d7b8%27%20OR%201=1').expect(
      400,
    );
    expect(await comentarios()).toEqual([]);
  });

  it('el comentario de una empresa no aparece en otra, aunque el texto sea hostil', async () => {
    const propio = await confirmada();
    const ajeno = await confirmada(B);
    await ds.query(
      `INSERT INTO decision_comentarios (company_id, decision_id, autor_id, texto)
       VALUES ($1,$2,$3,$4)`,
      [B, ajeno.id, entorno.persona(ANA), "' OR company_id IS NOT NULL --"],
    );

    const res = await leerCaso(propio.movimientoId);

    expect(res.comentarios).toEqual([]);
  });
});
