// src/database/esquema.spec.ts
import { DataSource, QueryRunner } from 'typeorm';
import { opcionesDataSource } from './data-source';
import { sembrar } from './seeds/seed';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlDePruebas,
} from './testing/base-de-pruebas';

/**
 * CU-02: esquema, migración y semilla. Las pruebas corren contra Postgres real
 * porque casi todo lo que hay que verificar (uuidv7, CHECK, índices parciales,
 * exactitud de NUMERIC) vive en el motor y no en el ORM.
 */

const TABLAS_DOMINIO = [
  'cargas',
  'cfdi',
  'movimientos',
  'conciliaciones',
  'bitacora',
  'user_company_roles',
  'carga_archivos',
  'sugerencias_ia',
] as const;

const TODAS_LAS_TABLAS = [
  'companies',
  'users',
  'sesiones',
  ...TABLAS_DOMINIO,
] as const;

interface Conteos {
  empresas: number;
  usuarios: number;
  roles: number;
}

const SQL_CONTEOS = `
  SELECT (SELECT count(*)::int FROM companies)          AS empresas,
         (SELECT count(*)::int FROM users)              AS usuarios,
         (SELECT count(*)::int FROM user_company_roles) AS roles`;

let ds: DataSource;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  ds = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await ds.runMigrations();
  await sembrar(ds);
}, 60_000);

afterAll(async () => {
  if (ds?.isInitialized) await ds.destroy();
});

/** Ejecuta el cuerpo en una transacción que siempre se revierte. */
async function enTransaccion(
  cuerpo: (qr: QueryRunner) => Promise<void>,
): Promise<void> {
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await cuerpo(qr);
  } finally {
    await qr.rollbackTransaction();
    await qr.release();
  }
}

async function idEmpresa(qr: QueryRunner, rfc: string): Promise<string> {
  const { id } = await una<{ id: string }>(
    qr,
    `SELECT id FROM companies WHERE rfc = $1`,
    [rfc],
  );
  return id;
}

describe('migración inicial', () => {
  it('crea todas las tablas', async () => {
    const tablas = await filas<{ table_name: string }>(
      ds,
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const nombres = tablas.map((t) => t.table_name);
    for (const tabla of TODAS_LAS_TABLAS) expect(nombres).toContain(tabla);
  });

  it('deja el esquema idéntico a las entidades', async () => {
    const pendiente = await ds.driver.createSchemaBuilder().log();
    expect(pendiente.upQueries.map((q) => q.query)).toEqual([]);
  });

  it('corre sobre Postgres 18 o superior, que trae uuidv7() nativo', async () => {
    const { v } = await una<{ v: string }>(
      ds,
      `SELECT current_setting('server_version_num') AS v`,
    );
    expect(Number(v)).toBeGreaterThanOrEqual(180000);
  });
});

describe('convenciones no negociables', () => {
  it('nombra todas las columnas en snake_case', async () => {
    const columnas = await filas<{ table_name: string; column_name: string }>(
      ds,
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name <> 'migrations'`,
    );
    const infractoras = columnas
      .filter((c) => !/^[a-z][a-z0-9_]*$/.test(c.column_name))
      .map((c) => `${c.table_name}.${c.column_name}`);
    expect(infractoras).toEqual([]);
  });

  it('pone company_id, con FK e índice, en toda tabla de dominio', async () => {
    for (const tabla of TABLAS_DOMINIO) {
      const columna = await una<{ is_nullable: string } | undefined>(
        ds,
        `SELECT is_nullable FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1 AND column_name='company_id'`,
        [tabla],
      );
      expect(columna).toBeDefined();
      expect(columna?.is_nullable).toBe('NO');

      const fks = await filas<{ ok: number }>(
        ds,
        `SELECT 1 AS ok FROM pg_constraint c
          WHERE c.conrelid = $1::regclass AND c.contype = 'f'
            AND 'company_id' = ANY (
              SELECT a.attname FROM pg_attribute a
               WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey))`,
        [tabla],
      );
      expect(fks.length).toBeGreaterThan(0);

      // company_id debe encabezar algún índice: es lo que lo vuelve utilizable
      // como filtro de empresa.
      const indices = await filas<{ indexdef: string }>(
        ds,
        `SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1`,
        [tabla],
      );
      expect(indices.some((i) => /\(company_id[,)]/.test(i.indexdef))).toBe(
        true,
      );
    }
  });

  it('guarda todo monto en NUMERIC(18,4), nunca en flotante', async () => {
    const flotantes = await filas<{ table_name: string; column_name: string }>(
      ds,
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema='public'
          AND data_type IN ('real','double precision','money')`,
    );
    expect(flotantes).toEqual([]);

    const montos = await filas<{
      column_name: string;
      p: number;
      s: number;
    }>(
      ds,
      `SELECT column_name, numeric_precision AS p, numeric_scale AS s
         FROM information_schema.columns
        WHERE table_schema='public'
          AND column_name IN ('total','subtotal','descuento','monto','diferencia_monto')`,
    );
    expect(montos.length).toBeGreaterThan(0);
    for (const m of montos) {
      expect({ columna: m.column_name, p: m.p, s: m.s }).toEqual({
        columna: m.column_name,
        p: 18,
        s: 4,
      });
    }
  });

  it('genera las PK como UUIDv7, ordenadas por tiempo', async () => {
    for (const tabla of TODAS_LAS_TABLAS) {
      const { column_default } = await una<{ column_default: string }>(
        ds,
        `SELECT column_default FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1 AND column_name='id'`,
        [tabla],
      );
      expect(column_default).toBe('uuidv7()');
    }

    const { v } = await una<{ v: number }>(
      ds,
      `SELECT DISTINCT uuid_extract_version(id) AS v FROM companies`,
    );
    expect(Number(v)).toBe(7);

    const { ordenadas } = await una<{ ordenadas: boolean }>(
      ds,
      `SELECT bool_and(id > previo) AS ordenadas FROM (
         SELECT id, lag(id) OVER (ORDER BY created_at, id) AS previo FROM users
       ) t WHERE previo IS NOT NULL`,
    );
    expect(ordenadas).toBe(true);
  });

  it('no arrastra error de redondeo en los montos', async () => {
    const { exacto } = await una<{ exacto: boolean }>(
      ds,
      `SELECT (0.1::numeric(18,4) + 0.2::numeric(18,4)) = 0.3::numeric(18,4) AS exacto`,
    );
    expect(exacto).toBe(true);
  });
});

describe('integridad del CFDI', () => {
  const XML = JSON.stringify({ _xml: '<cfdi:Comprobante Total="116.00"/>' });

  async function insertarCfdi(
    qr: QueryRunner,
    companyId: string,
    uuidFiscal: string,
    xmlRaw = XML,
  ): Promise<string> {
    const { id } = await una<{ id: string }>(
      qr,
      `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor,
                         fecha_emision, tipo_comprobante, subtotal, total, xml_raw)
       VALUES ($1,$2,'AAA010101AAA','FDB190215QK4','2026-09-01T10:00:00','I',
               100, 116, $3::jsonb)
       RETURNING id`,
      [companyId, uuidFiscal, xmlRaw],
    );
    return id;
  }

  it('rechaza el mismo folio fiscal dos veces en una empresa', async () => {
    await enTransaccion(async (qr) => {
      const emp = await idEmpresa(qr, 'FDB190215QK4');
      const folio = '11111111-1111-7111-8111-111111111111';
      await insertarCfdi(qr, emp, folio);
      await expect(insertarCfdi(qr, emp, folio)).rejects.toThrow(
        /ux_cfdi_company_id_uuid_fiscal/,
      );
    });
  });

  it('acepta el mismo folio fiscal en dos empresas distintas', async () => {
    await enTransaccion(async (qr) => {
      const folio = '22222222-2222-7222-8222-222222222222';
      await insertarCfdi(qr, await idEmpresa(qr, 'FDB190215QK4'), folio);
      await insertarCfdi(qr, await idEmpresa(qr, 'TCU170830R52'), folio);
      const { n } = await una<{ n: number }>(
        qr,
        `SELECT count(*)::int AS n FROM cfdi WHERE uuid_fiscal = $1`,
        [folio],
      );
      expect(n).toBe(2);
    });
  });

  it('exige que xml_raw conserve el XML original', async () => {
    await enTransaccion(async (qr) => {
      const emp = await idEmpresa(qr, 'FDB190215QK4');
      await expect(
        insertarCfdi(
          qr,
          emp,
          '33333333-3333-7333-8333-333333333333',
          '{"parsed":{}}',
        ),
      ).rejects.toThrow(/ck_cfdi_xml_raw_integro/);
    });
  });

  it('devuelve el XML original tal cual se guardó', async () => {
    await enTransaccion(async (qr) => {
      const emp = await idEmpresa(qr, 'FDB190215QK4');
      const id = await insertarCfdi(
        qr,
        emp,
        '44444444-4444-7444-8444-444444444444',
      );
      const { xml } = await una<{ xml: string }>(
        qr,
        `SELECT xml_raw->>'_xml' AS xml FROM cfdi WHERE id = $1`,
        [id],
      );
      expect(xml).toBe('<cfdi:Comprobante Total="116.00"/>');
    });
  });

  it('usa el índice parcial al buscar CFDI abiertas por emisor', async () => {
    await enTransaccion(async (qr) => {
      const emp = await idEmpresa(qr, 'FDB190215QK4');
      // Sin esto el plan depende de las filas que dejan otras suites en la
      // base compartida: con estadísticas de una tabla chica y casi toda
      // coincidente, Postgres elige Seq Scan. Se prueba que el índice sirve.
      await qr.query('SET LOCAL enable_seqscan = off');
      const plan = await filas<Record<string, string>>(
        qr,
        `EXPLAIN (COSTS OFF) SELECT id FROM cfdi
          WHERE company_id = $1 AND rfc_emisor = 'AAA010101AAA' AND estado = 'abierta'`,
        [emp],
      );
      const texto = plan.map((f) => Object.values(f)[0]).join('\n');
      expect(texto).toContain('ix_cfdi_company_id_rfc_emisor_abierta');
    });
  });

  it('rechaza un estado fuera del catálogo', async () => {
    await enTransaccion(async (qr) => {
      const emp = await idEmpresa(qr, 'FDB190215QK4');
      const id = await insertarCfdi(
        qr,
        emp,
        '55555555-5555-7555-8555-555555555555',
      );
      await expect(
        qr.query(`UPDATE cfdi SET estado = 'pagada' WHERE id = $1`, [id]),
      ).rejects.toThrow(/ck_cfdi_estado/);
    });
  });
});

describe('conciliaciones', () => {
  interface Escenario {
    emp: string;
    usr: string;
    cfdiId: string;
    movimientos: string[];
  }

  async function escenario(qr: QueryRunner): Promise<Escenario> {
    const emp = await idEmpresa(qr, 'FDB190215QK4');
    const { id: usr } = await una<{ id: string }>(
      qr,
      `SELECT id FROM users WHERE email = 'ana.reyes@fdb.mx'`,
    );
    const { id: cfdiId } = await una<{ id: string }>(
      qr,
      `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor,
                         fecha_emision, tipo_comprobante, subtotal, total, xml_raw)
       VALUES ($1,'66666666-6666-7666-8666-666666666666','AAA010101AAA',
               'FDB190215QK4','2026-09-01T10:00:00','I',100,116,'{"_xml":"<x/>"}'::jsonb)
       RETURNING id`,
      [emp],
    );
    const movimientos: string[] = [];
    for (const linea of [0, 1]) {
      const { id } = await una<{ id: string }>(
        qr,
        `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto)
         VALUES ($1,$2,'2026-09-02','SPEI RECIBIDO',116) RETURNING id`,
        [emp, linea],
      );
      movimientos.push(id);
    }
    return { emp, usr, cfdiId, movimientos };
  }

  it('no deja que el LLM cierre un caso', async () => {
    await enTransaccion(async (qr) => {
      const { emp, cfdiId, movimientos } = await escenario(qr);
      await expect(
        qr.query(
          `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado,
                                       origen, score)
           VALUES ($1,$2,$3,'confirmada','llm',0.99)`,
          [emp, cfdiId, movimientos[0]],
        ),
      ).rejects.toThrow(/ck_conciliaciones_confirmada_requiere_persona/);
    });
  });

  it('deja que el motor de reglas proponga y que una persona confirme', async () => {
    await enTransaccion(async (qr) => {
      const { emp, usr, cfdiId, movimientos } = await escenario(qr);
      const { id } = await una<{ id: string }>(
        qr,
        `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado,
                                     origen, regla, score)
         VALUES ($1,$2,$3,'propuesta','regla','monto_exacto',1.0) RETURNING id`,
        [emp, cfdiId, movimientos[0]],
      );
      await qr.query(
        `UPDATE conciliaciones
            SET estado='confirmada', confirmada_por_id=$2, confirmada_at=now()
          WHERE id = $1`,
        [id, usr],
      );
      const { estado } = await una<{ estado: string }>(
        qr,
        `SELECT estado FROM conciliaciones WHERE id = $1`,
        [id],
      );
      expect(estado).toBe('confirmada');
    });
  });

  it('confirma un CFDI una sola vez, aunque sean movimientos distintos', async () => {
    await enTransaccion(async (qr) => {
      const { emp, usr, cfdiId, movimientos } = await escenario(qr);
      const confirmar = (movimientoId: string) =>
        qr.query(
          `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado,
                                       origen, confirmada_por_id, confirmada_at)
           VALUES ($1,$2,$3,'confirmada','manual',$4,now())`,
          [emp, cfdiId, movimientoId, usr],
        );
      await confirmar(movimientos[0]);
      await expect(confirmar(movimientos[1])).rejects.toThrow(
        /ux_conciliaciones_cfdi_confirmada/,
      );
    });
  });

  it('permite varias propuestas abiertas para el mismo CFDI', async () => {
    await enTransaccion(async (qr) => {
      const { emp, cfdiId, movimientos } = await escenario(qr);
      for (const movimientoId of movimientos) {
        await qr.query(
          `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, estado,
                                       origen, score)
           VALUES ($1,$2,$3,'propuesta','llm',0.8)`,
          [emp, cfdiId, movimientoId],
        );
      }
      const { n } = await una<{ n: number }>(
        qr,
        `SELECT count(*)::int AS n FROM conciliaciones WHERE cfdi_id = $1`,
        [cfdiId],
      );
      expect(n).toBe(2);
    });
  });

  it('rechaza un score fuera de [0,1]', async () => {
    await enTransaccion(async (qr) => {
      const { emp, cfdiId, movimientos } = await escenario(qr);
      await expect(
        qr.query(
          `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, origen, score)
           VALUES ($1,$2,$3,'llm',1.5)`,
          [emp, cfdiId, movimientos[0]],
        ),
      ).rejects.toThrow(/ck_conciliaciones_score_rango/);
    });
  });

  describe('llaves foráneas compuestas con company_id', () => {
    const INSERTAR = `INSERT INTO conciliaciones (company_id, cfdi_id, movimiento_id, origen)
                      VALUES ($1,$2,$3,'regla')`;

    /** Un CFDI y un movimiento de la otra empresa (TCU170830R52). */
    async function ajenos(qr: QueryRunner) {
      const otra = await idEmpresa(qr, 'TCU170830R52');
      const { id: cfdiId } = await una<{ id: string }>(
        qr,
        `INSERT INTO cfdi (company_id, uuid_fiscal, rfc_emisor, rfc_receptor,
                           fecha_emision, tipo_comprobante, subtotal, total, xml_raw)
         VALUES ($1,'77777777-7777-7777-8777-777777777777','AAA010101AAA',
                 'TCU170830R52','2026-09-01T10:00:00','I',100,116,'{"_xml":"<x/>"}'::jsonb)
         RETURNING id`,
        [otra],
      );
      const { id: movimientoId } = await una<{ id: string }>(
        qr,
        `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, monto)
         VALUES ($1,0,'2026-09-02','SPEI RECIBIDO',116) RETURNING id`,
        [otra],
      );
      return { otra, cfdiId, movimientoId };
    }

    it('acepta el cruce entre un CFDI y un movimiento de la misma empresa', async () => {
      await enTransaccion(async (qr) => {
        const { emp, cfdiId, movimientos } = await escenario(qr);
        await qr.query(INSERTAR, [emp, cfdiId, movimientos[0]]);
      });
    });

    it('rechaza, incluso al dueño, un CFDI de otra empresa', async () => {
      await enTransaccion(async (qr) => {
        const { emp, movimientos } = await escenario(qr);
        const { cfdiId } = await ajenos(qr);
        await expect(
          qr.query(INSERTAR, [emp, cfdiId, movimientos[0]]),
        ).rejects.toThrow(/fk_conciliaciones_cfdi/);
      });
    });

    it('rechaza, incluso al dueño, un movimiento de otra empresa', async () => {
      await enTransaccion(async (qr) => {
        const { emp, cfdiId } = await escenario(qr);
        const { movimientoId } = await ajenos(qr);
        await expect(
          qr.query(INSERTAR, [emp, cfdiId, movimientoId]),
        ).rejects.toThrow(/fk_conciliaciones_movimiento/);
      });
    });

    it('rechaza un cruce declarado con la empresa del CFDI ajeno pero movimiento propio', async () => {
      await enTransaccion(async (qr) => {
        const { movimientos } = await escenario(qr);
        const { otra, cfdiId } = await ajenos(qr);
        await expect(
          qr.query(INSERTAR, [otra, cfdiId, movimientos[0]]),
        ).rejects.toThrow(/fk_conciliaciones_movimiento/);
      });
    });

    it('borra en cascada las conciliaciones al borrar el CFDI', async () => {
      await enTransaccion(async (qr) => {
        const { emp, cfdiId, movimientos } = await escenario(qr);
        await qr.query(INSERTAR, [emp, cfdiId, movimientos[0]]);
        await qr.query(`DELETE FROM cfdi WHERE id = $1`, [cfdiId]);
        const { n } = await una<{ n: number }>(
          qr,
          `SELECT count(*)::int AS n FROM conciliaciones WHERE company_id = $1`,
          [emp],
        );
        expect(n).toBe(0);
      });
    });
  });
});

describe('tolerancia de monto por empresa (CU-12)', () => {
  it('nace estricta: toda empresa sembrada tiene 0', async () => {
    const empresas = await filas<{ tolerancia: string }>(
      ds,
      `SELECT tolerancia_monto::text AS tolerancia FROM companies`,
    );
    expect(empresas.length).toBeGreaterThan(0);
    for (const e of empresas) expect(e.tolerancia).toBe('0.0000');
  });

  it('guarda 4 decimales exactos y acepta los extremos 0 y 100', async () => {
    await enTransaccion(async (qr) => {
      const emp = await idEmpresa(qr, 'FDB190215QK4');
      for (const [valor, texto] of [
        ['12.5', '12.5000'],
        ['0.1234', '0.1234'],
        ['100', '100.0000'],
        ['0', '0.0000'],
      ]) {
        await qr.query(
          `UPDATE companies SET tolerancia_monto = $2 WHERE id = $1`,
          [emp, valor],
        );
        const { t } = await una<{ t: string }>(
          qr,
          `SELECT tolerancia_monto::text AS t FROM companies WHERE id = $1`,
          [emp],
        );
        expect(t).toBe(texto);
      }
    });
  });

  it.each(['-0.01', '100.0001', '1000'])(
    'el CHECK rechaza %s',
    async (valor) => {
      await enTransaccion(async (qr) => {
        const emp = await idEmpresa(qr, 'FDB190215QK4');
        await expect(
          qr.query(`UPDATE companies SET tolerancia_monto = $2 WHERE id = $1`, [
            emp,
            valor,
          ]),
        ).rejects.toThrow(/ck_companies_tolerancia_monto_rango/);
      });
    },
  );

  it('cuadra_app puede actualizar solo esa columna de companies', async () => {
    const privilegio = (columna: string) =>
      una<{ ok: boolean }>(
        ds,
        `SELECT has_column_privilege('cuadra_app', 'companies', $1, 'UPDATE') AS ok`,
        [columna],
      );
    expect(await privilegio('tolerancia_monto')).toEqual({ ok: true });
    for (const otra of ['rfc', 'razon_social', 'activa']) {
      expect(await privilegio(otra)).toEqual({ ok: false });
    }
  });
});

describe('semilla', () => {
  it('deja dos empresas, cuatro usuarios y cinco asignaciones de rol', async () => {
    expect(await una<Conteos>(ds, SQL_CONTEOS)).toEqual({
      empresas: 2,
      usuarios: 4,
      roles: 5,
    });
  });

  it('es idempotente', async () => {
    await sembrar(ds);
    await sembrar(ds);
    expect(await una<Conteos>(ds, SQL_CONTEOS)).toEqual({
      empresas: 2,
      usuarios: 4,
      roles: 5,
    });
  });

  it('nunca guarda la contraseña en claro', async () => {
    const usuarios = await filas<{ password_hash: string }>(
      ds,
      `SELECT password_hash FROM users`,
    );
    expect(usuarios).toHaveLength(4);
    for (const u of usuarios) {
      expect(u.password_hash).toMatch(/^scrypt\$/);
      expect(u.password_hash).not.toContain('cuadra-dev-2026');
    }
  });

  it('da a un mismo usuario roles distintos en dos empresas', async () => {
    const asignaciones = await filas<{ rfc: string; rol: string }>(
      ds,
      `SELECT c.rfc, r.rol FROM user_company_roles r
         JOIN users u ON u.id = r.user_id
         JOIN companies c ON c.id = r.company_id
        WHERE u.email = 'jorge.tapia@despacho.mx'
        ORDER BY c.rfc`,
    );
    expect(asignaciones).toEqual([
      { rfc: 'FDB190215QK4', rol: 'contador' },
      { rfc: 'TCU170830R52', rol: 'revisor' },
    ]);
  });
});

// Tablas propias de TypeORM, no del esquema. `typeorm_metadata` la recrea su
// ejecutor en cada corrida en cuanto una entidad declara una columna generada
// (`generatedType`), así que ninguna migración puede dejarla ausente.
const TABLAS_DE_TYPEORM = `('migrations', 'typeorm_metadata')`;

// Va al final: vacía la base y la vuelve a levantar.
describe('reversibilidad', () => {
  it('revierte sin dejar rastro y se puede volver a aplicar', async () => {
    // cuadra_test sobrevive entre suites: una fila 'acceso_denegado' que dejó
    // otra impide revertir AccesoDenegadoEnBitacora.
    await ds.query('TRUNCATE bitacora');

    // Todas, de la más nueva a la más vieja: cada `down` debe dejar a la
    // anterior en condiciones de revertirse.
    for (let i = 0; i < ds.migrations.length; i++) {
      await ds.undoLastMigration();
    }

    const tablas = await filas<{ table_name: string }>(
      ds,
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name NOT IN ${TABLAS_DE_TYPEORM}`,
    );
    expect(tablas).toEqual([]);

    const indices = await filas<{ indexname: string }>(
      ds,
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename NOT IN ${TABLAS_DE_TYPEORM}`,
    );
    expect(indices).toEqual([]);

    await ds.runMigrations();
    const pendiente = await ds.driver.createSchemaBuilder().log();
    expect(pendiente.upQueries.map((q) => q.query)).toEqual([]);
  }, 60_000);
});
