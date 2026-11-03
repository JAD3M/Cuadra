import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DataSource } from 'typeorm';
import { PasswordHasher } from '../auth/password';
import { filas, una } from '../database/testing/base-de-pruebas';
import {
  type AppDeCargas,
  FERRETERIA,
  levantarAppDeCargas,
  LUIS,
  TRANSPORTES,
} from '../cargas/testing/app-de-cargas';
import { cookieDe } from '../testing/sesion-de-pruebas';
import request from '../testing/supertest-con-origen';
import { MINIMO_CARGAS_ACEPTADAS } from './bancos-vista-previa.service';

/**
 * Historia 3.6, cableado de punta a punta SIN spy: el dueño levanta un banco
 * por el endpoint real y una empresa sube un PDF de ese banco. Nada se
 * sustituye: ni `estaLevantado` ni la conciliación. Vive en `plataforma/`
 * porque `cargas` no puede nombrar las tablas de clase 3 (arquitectura.spec).
 * SINTÉTICO: el PDF de BBVA es el fixture de la historia.
 */

jest.setTimeout(30_000);

const CORREO_DUENO = 'dueno-cableado@cuadra.test';
const PASSWORD_DUENO = 'una-contraseña-larga-123';
const BANCO = 'bbva';
const PREFIJO = 'vp36e2e-';

let entorno: AppDeCargas;
let ds: DataSource;
let duenoId: string;
let contador = 0;

const BBVA = readFileSync(
  join(__dirname, '..', 'bancos', 'fixtures', 'bbva-sintetico.pdf'),
);

function hash(texto: string): string {
  return createHash('sha256').update(texto).digest('hex');
}

async function sembrarAceptadas(n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    contador += 1;
    await ds.query(
      `INSERT INTO cargas (company_id, tipo, estado, nombre_archivo, hash_archivo,
                           banco, saldo_inicial, saldo_final)
       VALUES ($1, 'estado_cuenta', 'procesada', $2, $3, $4, '0.0000', '0.0000')`,
      [
        entorno.empresa(i % 2 === 0 ? FERRETERIA : TRANSPORTES),
        `${PREFIJO}seed-${contador}.pdf`,
        hash(`${PREFIJO}${contador}`),
        BANCO,
      ],
    );
  }
}

async function limpiar(): Promise<void> {
  const propias = `(SELECT id FROM cargas WHERE nombre_archivo LIKE '${PREFIJO}%')`;
  await ds.query(
    `DELETE FROM conciliaciones WHERE movimiento_id IN
       (SELECT id FROM movimientos WHERE carga_id IN ${propias})`,
  );
  await ds.query(`DELETE FROM movimientos WHERE carga_id IN ${propias}`);
  await ds.query(
    `DELETE FROM movimientos_pendientes WHERE carga_id IN ${propias}`,
  );
  await ds.query(
    `DELETE FROM bitacora WHERE entidad = 'cargas' AND entidad_id IN ${propias}`,
  );
  await ds.query(`DELETE FROM cargas WHERE nombre_archivo LIKE '${PREFIJO}%'`);
  await ds.query('DELETE FROM bancos_vista_previa');
  await ds.query(
    `DELETE FROM bitacora_plataforma WHERE accion = 'levantar_vista_previa'`,
  );
}

beforeAll(async () => {
  entorno = await levantarAppDeCargas();
  ({ ds } = entorno);
  const hashPw = await new PasswordHasher().hashear(PASSWORD_DUENO);
  await ds.query(
    `INSERT INTO plataforma_usuarios (correo, password_hash)
     VALUES ($1, $2) ON CONFLICT (correo) DO UPDATE SET password_hash = $2, activo = true`,
    [CORREO_DUENO, hashPw],
  );
  duenoId = (
    await una<{ id: string }>(
      ds,
      'SELECT id FROM plataforma_usuarios WHERE correo = $1',
      [CORREO_DUENO],
    )
  ).id;
}, 60_000);

beforeEach(limpiar);

afterAll(async () => {
  if (ds?.isInitialized) {
    await limpiar();
    await ds.query('DELETE FROM sesiones WHERE plataforma_usuario_id = $1', [
      duenoId,
    ]);
    await ds.query(
      'DELETE FROM bitacora_plataforma WHERE plataforma_usuario_id = $1',
      [duenoId],
    );
    await ds.query('DELETE FROM plataforma_usuarios WHERE correo = $1', [
      CORREO_DUENO,
    ]);
  }
  await entorno?.cerrar();
});

const http = () => request(entorno.app.getHttpServer());

async function loginDueno(): Promise<string> {
  const res = await http()
    .post('/plataforma/auth/login')
    .send({ email: CORREO_DUENO, password: PASSWORD_DUENO })
    .expect(200);
  return cookieDe(res);
}

async function subirComoEmpresa() {
  const res = await http()
    .post('/cargas/estado-cuenta/pdf')
    .set('Cookie', await entorno.token(LUIS, FERRETERIA))
    .field('banco', BANCO)
    .attach('archivo', BBVA, `${PREFIJO}bbva.pdf`)
    .expect(200);
  return res.body as { cargaId: string; estado: string };
}

const movimientosDe = (cargaId: string) =>
  filas<{ estado: string }>(
    ds,
    'SELECT estado FROM movimientos WHERE carga_id = $1',
    [cargaId],
  );

describe('3.6 de punta a punta: plataforma levanta, cargas lo respeta', () => {
  it('con el banco levantado por el dueño, el PDF que cuadra entra a movimientos', async () => {
    await sembrarAceptadas(MINIMO_CARGAS_ACEPTADAS);
    const cookieDueno = await loginDueno();
    await http()
      .post(`/plataforma/bancos/${BANCO}/levantar-vista-previa`)
      .set('Cookie', cookieDueno)
      .expect(201);

    const { cargaId, estado } = await subirComoEmpresa();

    expect(estado).not.toBe('pendiente_vista_previa');
    expect(estado).toBe('procesada');
    const carga = await una<{ estado: string }>(
      ds,
      'SELECT estado FROM cargas WHERE id = $1',
      [cargaId],
    );
    expect(carga.estado).toBe('procesada');
    expect(await movimientosDe(cargaId)).toHaveLength(2);

    const confirmar = await filas<{ datos: Record<string, unknown> }>(
      ds,
      `SELECT datos FROM bitacora
        WHERE entidad = 'cargas' AND entidad_id = $1 AND accion = 'confirmar'`,
      [cargaId],
    );
    expect(confirmar).toHaveLength(1);
    expect(confirmar[0].datos).toMatchObject({ via: 'banco_levantado' });
  });

  it('control: con el banco sin levantar, el mismo PDF queda en vista previa y no escribe movimientos', async () => {
    await sembrarAceptadas(MINIMO_CARGAS_ACEPTADAS);

    const { cargaId, estado } = await subirComoEmpresa();

    expect(estado).toBe('pendiente_vista_previa');
    const carga = await una<{ estado: string }>(
      ds,
      'SELECT estado FROM cargas WHERE id = $1',
      [cargaId],
    );
    expect(carga.estado).toBe('pendiente_vista_previa');
    expect(await movimientosDe(cargaId)).toEqual([]);
  });
});
