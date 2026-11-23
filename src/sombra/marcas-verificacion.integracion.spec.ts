import type { DataSource } from 'typeorm';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
} from '../cargas/testing/app-de-cargas';
import { una } from '../database/testing/base-de-pruebas';

/**
 * Historia 9.4 (FR-63, AD-7, AD-10): la tabla `muestras_verificacion` sigue
 * siendo de solo agregar; cada marca es una fila nueva y el sorteo sigue siendo
 * único por empresa, mes y decisión.
 */

jest.setTimeout(30_000);

let entorno: AppDeCargas;
let ds: DataSource;
let A: string;
let persona: string;
let decision: string;

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  A = entorno.empresa(FERRETERIA);
  persona = (await una<{ id: string }>(ds, `SELECT id FROM users LIMIT 1`)).id;
}, 60_000);

afterAll(async () => {
  await limpiar();
  await entorno?.cerrar();
});

async function limpiar() {
  if (!ds?.isInitialized) return;
  await ds.query(
    'TRUNCATE muestras_verificacion, evidencia_sombra, decision_lineas, decisiones, movimientos CASCADE',
  );
}

beforeEach(async () => {
  await limpiar();
  const [m] = await ds.query<{ id: string }[]>(
    `INSERT INTO movimientos (company_id, linea_numero, fecha, descripcion, referencia, monto, moneda, banco)
     VALUES ($1, 1, '2026-09-02', 'SPEI RECIBIDO', 'R1', '100.00', 'MXN', 'bbva') RETURNING id`,
    [A],
  );
  const [d] = await ds.query<{ id: string }[]>(
    `INSERT INTO decisiones (company_id, movimiento_id, tipo, estado, origen, regla, huella_conjunto,
                             confirmada_por_id, confirmada_at, lote_id)
     VALUES ($1, $2, 'conciliacion', 'confirmada', 'regla', 'referencia_monto_exacto', 'h1',
             $3, '2026-09-15T12:00:00Z', gen_random_uuid()) RETURNING id`,
    [A, m.id, persona],
  );
  decision = d.id;
});

const sortear = () =>
  ds.query(
    `INSERT INTO muestras_verificacion (company_id, mes, decision_id) VALUES ($1, '2026-09-01', $2)`,
    [A, decision],
  );

const marcar = (resultado: string | null, verificador: string | null) =>
  ds.query(
    `INSERT INTO muestras_verificacion (company_id, mes, decision_id, verificador_id, resultado)
     VALUES ($1, '2026-09-01', $2, $3, $4)`,
    [A, decision, verificador, resultado],
  );

describe('marcas de la muestra de verificación (9.4)', () => {
  it('cada marca es una fila nueva con persona y fecha, y se puede cambiar la marca (S4)', async () => {
    await sortear();
    await marcar('desacuerdo', persona);
    await marcar('conforme', persona);

    const filas = await ds.query<
      { resultado: string | null; verificador_id: string | null }[]
    >(
      `SELECT resultado, verificador_id FROM muestras_verificacion
        WHERE decision_id = $1 ORDER BY created_at, id`,
      [decision],
    );
    expect(filas.map((f) => f.resultado)).toEqual([
      null,
      'desacuerdo',
      'conforme',
    ]);
    expect(filas[1].verificador_id).toBe(persona);
  });

  it('el sorteo sigue siendo único por empresa, mes y decisión', async () => {
    await sortear();
    await expect(sortear()).rejects.toThrow(
      /ux_muestras_verificacion_empresa_mes_decision/,
    );
  });

  it('el resultado solo puede ser conforme o desacuerdo, y la persona va con él', async () => {
    await sortear();
    await expect(marcar('quizas', persona)).rejects.toThrow(
      /ck_muestras_verificacion_marca/,
    );
    await expect(marcar('conforme', null)).rejects.toThrow(
      /ck_muestras_verificacion_marca/,
    );
    await expect(marcar(null, persona)).rejects.toThrow(
      /ck_muestras_verificacion_marca/,
    );
  });

  it('la bitácora acepta la acción verificar_muestra (S8)', async () => {
    await expect(
      ds.query(
        `INSERT INTO bitacora (company_id, user_id, entidad, entidad_id, accion, datos)
         VALUES ($1, $2, 'decisiones', $3, 'verificar_muestra', '{}'::jsonb)`,
        [A, persona, decision],
      ),
    ).resolves.toBeDefined();
  });

  it('cuadra_app sigue sin poder actualizar ni borrar', async () => {
    const permisos = await ds.query<{ privilegio: string }[]>(
      `SELECT privilege_type AS privilegio FROM information_schema.role_table_grants
        WHERE table_name = 'muestras_verificacion' AND grantee = 'cuadra_app'
        ORDER BY privilege_type`,
    );
    expect(permisos.map((p) => p.privilegio)).toEqual(['INSERT', 'SELECT']);
  });
});
