import { DataSource, QueryRunner } from 'typeorm';
import { opcionesDataSource } from '../database/data-source';
import {
  crearBaseDePruebas,
  filas,
  una,
  urlAppDePruebas,
  urlDePruebas,
} from '../database/testing/base-de-pruebas';

/**
 * Historia 1.3 (AD-2, AD-5). Tablas de clase 3 y la separación de sujetos en
 * `sesiones`. Corre contra Postgres real: el CHECK, la FK y los GRANTs viven
 * en el motor.
 */

let duenio: DataSource;
let app: DataSource;

beforeAll(async () => {
  const url = urlDePruebas();
  await crearBaseDePruebas(url);
  duenio = await new DataSource({ ...opcionesDataSource, url }).initialize();
  await duenio.runMigrations();
  app = await new DataSource({
    type: 'postgres',
    url: urlAppDePruebas(),
  }).initialize();
}, 60_000);

afterAll(async () => {
  if (app?.isInitialized) await app.destroy();
  if (duenio?.isInitialized) await duenio.destroy();
});

/** Cuerpo dentro de una transacción del dueño que siempre se revierte. */
async function enTransaccion(
  cuerpo: (qr: QueryRunner) => Promise<void>,
): Promise<void> {
  const qr = duenio.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    await cuerpo(qr);
  } finally {
    await qr.rollbackTransaction();
    await qr.release();
  }
}

interface Ids {
  userId: string;
  companyId: string;
  plataformaId: string;
}

async function sembrarIds(qr: QueryRunner): Promise<Ids> {
  const { id: companyId } = await una<{ id: string }>(
    qr,
    `INSERT INTO companies (rfc, razon_social) VALUES ('PLT010101AAA', 'Empresa de prueba')
     RETURNING id`,
  );
  const { id: userId } = await una<{ id: string }>(
    qr,
    `INSERT INTO users (email, nombre, password_hash)
     VALUES ('persona@example.com', 'Persona', 'hash') RETURNING id`,
  );
  const { id: plataformaId } = await una<{ id: string }>(
    qr,
    `INSERT INTO plataforma_usuarios (correo, password_hash)
     VALUES ('dueno@cuadra.test', 'hash') RETURNING id`,
  );
  return { userId, companyId, plataformaId };
}

function insertarSesion(
  qr: QueryRunner,
  tipo: string,
  userId: string | null,
  plataformaId: string | null,
  companyId: string | null,
): Promise<unknown> {
  return qr.query(
    `INSERT INTO sesiones (user_id, plataforma_usuario_id, token_hash, tipo, company_id,
                           ultima_actividad, expira_en)
     VALUES ($1, $2, md5(random()::text), $3, $4, now(), now() + interval '1 hour')`,
    [userId, plataformaId, tipo, companyId],
  );
}

/** Un INSERT que falla aborta la transacción: cada caso usa un savepoint. */
async function rechazada(
  qr: QueryRunner,
  fn: () => Promise<unknown>,
): Promise<string> {
  await qr.query('SAVEPOINT intento');
  try {
    await fn();
  } catch (e) {
    await qr.query('ROLLBACK TO SAVEPOINT intento');
    return (e as { constraint?: string }).constraint ?? String(e);
  }
  await qr.query('RELEASE SAVEPOINT intento');
  return 'aceptada';
}

describe('sesiones: sujeto según el tipo (CHECK ck_sesiones_sujeto_por_tipo)', () => {
  it('acepta empresa con user_id y plataforma con plataforma_usuario_id', async () => {
    await enTransaccion(async (qr) => {
      const { userId, plataformaId, companyId } = await sembrarIds(qr);
      await insertarSesion(qr, 'empresa', userId, null, null);
      await insertarSesion(qr, 'empresa', userId, null, companyId);
      await insertarSesion(qr, 'plataforma', null, plataformaId, null);
    });
  });

  it.each([
    ['empresa con plataforma_usuario_id', 'empresa', false, true, false],
    ['empresa con ambos sujetos', 'empresa', true, true, false],
    ['empresa sin sujeto', 'empresa', false, false, false],
    ['plataforma con user_id', 'plataforma', true, false, false],
    ['plataforma con ambos sujetos', 'plataforma', true, true, false],
    ['plataforma con company_id', 'plataforma', false, true, true],
    ['plataforma sin sujeto', 'plataforma', false, false, false],
  ])(
    'rechaza %s',
    async (_nombre, tipo, conUser, conPlataforma, conEmpresa) => {
      await enTransaccion(async (qr) => {
        const ids = await sembrarIds(qr);
        const resultado = await rechazada(qr, () =>
          insertarSesion(
            qr,
            tipo,
            conUser ? ids.userId : null,
            conPlataforma ? ids.plataformaId : null,
            conEmpresa ? ids.companyId : null,
          ),
        );
        expect(resultado).toBe('ck_sesiones_sujeto_por_tipo');
      });
    },
  );

  it('exige que plataforma_usuario_id exista (FK)', async () => {
    await enTransaccion(async (qr) => {
      const resultado = await rechazada(qr, () =>
        insertarSesion(
          qr,
          'plataforma',
          null,
          '019a0000-0000-7000-8000-000000000000',
          null,
        ),
      );
      expect(resultado).toBe('fk_sesiones_plataforma_usuario');
    });
  });
});

describe('plataforma_usuarios', () => {
  it('guarda el correo normalizado y único', async () => {
    await enTransaccion(async (qr) => {
      await sembrarIds(qr);
      expect(
        await rechazada(qr, () =>
          qr.query(
            `INSERT INTO plataforma_usuarios (correo, password_hash) VALUES ('Otro@Cuadra.test', 'h')`,
          ),
        ),
      ).toBe('ck_plataforma_usuarios_correo_normalizado');
      expect(
        await rechazada(qr, () =>
          qr.query(
            `INSERT INTO plataforma_usuarios (correo, password_hash) VALUES ('dueno@cuadra.test', 'h')`,
          ),
        ),
      ).toBe('ux_plataforma_usuarios_correo');
    });
  });
});

describe('permisos de cuadra_app sobre las tablas de clase 3', () => {
  const privilegio = async (tabla: string, p: string): Promise<boolean> =>
    (
      await una<{ ok: boolean }>(
        app,
        `SELECT has_table_privilege('cuadra_app', $1, $2) AS ok`,
        [tabla, p],
      )
    ).ok;

  it.each([
    ['SELECT', true],
    ['INSERT', true],
    ['UPDATE', false],
    ['DELETE', false],
    ['TRUNCATE', false],
  ])('bitacora_plataforma %s = %s', async (p, esperado) => {
    expect(await privilegio('bitacora_plataforma', p)).toBe(esperado);
  });

  it.each([
    ['SELECT', true],
    ['INSERT', true],
    ['UPDATE', true],
    ['DELETE', false],
  ])('plataforma_usuarios %s = %s', async (p, esperado) => {
    expect(await privilegio('plataforma_usuarios', p)).toBe(esperado);
  });

  it('cuadra_app inserta en bitacora_plataforma y no puede actualizarla ni borrarla', async () => {
    await app.query(
      `INSERT INTO bitacora_plataforma (accion, detalle) VALUES ('acceso_denegado', '{"a":1}')`,
    );
    await expect(
      app.query(`UPDATE bitacora_plataforma SET accion = 'x'`),
    ).rejects.toThrow(/permission denied/);
    await expect(app.query(`DELETE FROM bitacora_plataforma`)).rejects.toThrow(
      /permission denied/,
    );
  });

  it('no tienen RLS ni company_id con FK (clase 3)', async () => {
    const rls = await filas<{ relname: string; relrowsecurity: boolean }>(
      app,
      `SELECT relname, relrowsecurity FROM pg_class
        WHERE relname IN ('plataforma_usuarios', 'bitacora_plataforma')`,
    );
    expect(rls).toHaveLength(2);
    for (const r of rls) expect(r.relrowsecurity).toBe(false);

    const fks = await filas<{ conname: string }>(
      app,
      `SELECT conname FROM pg_constraint
        WHERE conrelid = 'bitacora_plataforma'::regclass AND contype = 'f'`,
    );
    expect(fks.map((f) => f.conname)).toEqual([
      'fk_bitacora_plataforma_usuario',
    ]);
  });
});

describe('migración reversible', () => {
  it('down y up de CambiarQuitarRoles, InvitacionesCancelables, InvitacionesMultirol, RolAuditor, TokensRecuperacion, Invitaciones, CrearEmpresas, PlataformaUsuarios y AccionesBitacoraPlataforma dejan el esquema intacto', async () => {
    // La última es CambiarQuitarRoles: quita el DELETE de `user_company_roles`
    // y las acciones `cambiar_rol` y `quitar_rol` del CHECK de la bitácora.
    await duenio.undoLastMigration();
    const { borra } = await una<{ borra: boolean }>(
      duenio,
      `SELECT has_table_privilege('cuadra_app', 'user_company_roles', 'DELETE') AS borra`,
    );
    expect(borra).toBe(false);
    await expect(
      duenio.query(
        `INSERT INTO bitacora (company_id, entidad, entidad_id, accion)
         SELECT id, 'companies', id, 'quitar_rol' FROM companies LIMIT 1`,
      ),
    ).rejects.toThrow(/ck_bitacora_accion/);
    // Luego InvitacionesCancelables: quita `cancelada_en` y las dos
    // acciones de invitación del CHECK de la bitácora.
    await duenio.undoLastMigration();
    const { n: columnaCancelada } = await una<{ n: number }>(
      duenio,
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_name = 'invitaciones' AND column_name = 'cancelada_en'`,
    );
    expect(columnaCancelada).toBe(0);
    await expect(
      duenio.query(
        `INSERT INTO bitacora (company_id, entidad, entidad_id, accion)
         SELECT id, 'companies', id, 'cancelar_invitacion' FROM companies LIMIT 1`,
      ),
    ).rejects.toThrow(/ck_bitacora_accion/);
    // Luego InvitacionesMultirol: vuelve `rol` y quita `roles` y el
    // invitador de empresa.
    await duenio.undoLastMigration();
    const { n: columnasMultirol } = await una<{ n: number }>(
      duenio,
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_name = 'invitaciones'
          AND column_name IN ('roles', 'invitada_por_user_id')`,
    );
    expect(columnasMultirol).toBe(0);
    const { n: columnaRol } = await una<{ n: number }>(
      duenio,
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_name = 'invitaciones' AND column_name = 'rol'`,
    );
    expect(columnaRol).toBe(1);
    // Luego RolAuditor: devuelve los CHECK de rol a tres valores.
    await duenio.undoLastMigration();
    const { n: checkRol } = await una<{ n: number }>(
      duenio,
      `SELECT count(*)::int AS n FROM pg_constraint
        WHERE conname IN ('ck_user_company_roles_rol', 'ck_invitaciones_rol')
          AND pg_get_constraintdef(oid) LIKE '%auditor%'`,
    );
    expect(checkRol).toBe(0);
    // Luego TokensRecuperacion: quita la tabla, el GRANT por columna
    // sobre users y `restablecer_contrasena` del CHECK de plataforma.
    await duenio.undoLastMigration();
    const { n: tokens } = await una<{ n: number }>(
      duenio,
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema='public' AND table_name = 'tokens_recuperacion'`,
    );
    expect(tokens).toBe(0);
    await expect(
      duenio.query(
        `INSERT INTO bitacora_plataforma (accion) VALUES ('restablecer_contrasena')`,
      ),
    ).rejects.toThrow(/ck_bitacora_plataforma_accion/);
    // Luego Invitaciones: quita la tabla, los GRANT por columna y `invitar`
    // de los dos CHECK.
    await duenio.undoLastMigration();
    const { n: invitaciones } = await una<{ n: number }>(
      duenio,
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema='public' AND table_name = 'invitaciones'`,
    );
    expect(invitaciones).toBe(0);
    const { ok: insertaUsuario } = await una<{ ok: boolean }>(
      duenio,
      `SELECT has_column_privilege('cuadra_app', 'users', 'email', 'INSERT') AS ok`,
    );
    expect(insertaUsuario).toBe(false);
    await expect(
      duenio.query(
        `INSERT INTO bitacora_plataforma (accion) VALUES ('invitar')`,
      ),
    ).rejects.toThrow(/ck_bitacora_plataforma_accion/);
    // Luego CrearEmpresas: quita la columna, el GRANT y `crear_empresa`.
    await duenio.undoLastMigration();
    const { n: columnas } = await una<{ n: number }>(
      duenio,
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_name = 'companies' AND column_name = 'separacion_funciones'`,
    );
    expect(columnas).toBe(0);
    const { ok: insertaRfc } = await una<{ ok: boolean }>(
      duenio,
      `SELECT has_column_privilege('cuadra_app', 'companies', 'rfc', 'INSERT') AS ok`,
    );
    expect(insertaRfc).toBe(false);
    await expect(
      duenio.query(
        `INSERT INTO bitacora_plataforma (accion) VALUES ('crear_empresa')`,
      ),
    ).rejects.toThrow(/ck_bitacora_plataforma_accion/);
    // Luego, el CHECK de acciones; la anterior, las tablas.
    await duenio.undoLastMigration();
    const { n: checks } = await una<{ n: number }>(
      duenio,
      `SELECT count(*)::int AS n FROM pg_constraint
        WHERE conname = 'ck_bitacora_plataforma_accion'`,
    );
    expect(checks).toBe(0);
    await duenio.undoLastMigration();
    // Tras revertir las dos, ya no hay tablas de plataforma.
    const { n } = await una<{ n: number }>(
      duenio,
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema='public' AND table_name IN ('plataforma_usuarios','bitacora_plataforma')`,
    );
    expect(n).toBe(0);
    const { nullable } = await una<{ nullable: string }>(
      duenio,
      `SELECT is_nullable AS nullable FROM information_schema.columns
        WHERE table_name='sesiones' AND column_name='user_id'`,
    );
    expect(nullable).toBe('NO');
    await duenio.runMigrations();
    const pendiente = await duenio.driver.createSchemaBuilder().log();
    expect(pendiente.upQueries.map((q) => q.query)).toEqual([]);
  });
});
